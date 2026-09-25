# Mejoras de rendimiento y latencia

Rama: `feature/improvements` · Base: `main` (`820c4e5`)
Commits: `5dc0312` (reserva atómica + compresión) · `8813b2e` (paginación, caché, pool, cabeceras, CORS, SQL)

Punto de partida: las pruebas de carga de [`throughput/note.md`](throughput/note.md) (autocannon contra Render).
A 10 conexiones la latencia era ~130 ms; a 500 conexiones subía a 1.3–1.7 s con ~300–370 RPS. Como
`/api/salud` no toca la base de datos y tenía el mismo techo, el cuello de botella era la instancia de
Render (cola de peticiones), no Supabase.

## Resumen por tipo de ajuste

| Tipo | Cambio | Beneficio principal |
|---|---|---|
| Base de datos | `INSERT ... ON CONFLICT` + `UNIQUE (profesional_id, fecha_hora)` | 1 viaje a la DB en vez de 2 en el POST; sin duplicados por concurrencia |
| Base de datos | Índice `(fecha_hora, id)` | El listado paginado lee solo las filas de la página |
| Base de datos | `setup.sql` en transacción e `IDENTITY` | Esquema atómico; sintaxis actual de Postgres |
| Red / transferencia | `compression()` | HTML de 5.3 kB a 2.2 kB (gzip) |
| Caché | Estáticos con ETag y `max-age=300` | El navegador revalida sin descargar |
| Caché | Profesionales en memoria 60 s + `Cache-Control` | Cero consultas a la DB en esa ruta |
| API | Paginación de `GET /api/citas` | Respuesta y consulta acotadas |
| Conexiones | Ajuste del pool de `pg` | Falla rápido bajo carga; no se cae por errores de conexión |
| Cliente | Carga inicial en paralelo | 1 viaje de ida y vuelta en vez de 3 |
| Cabeceras | `no-store`, sin `X-Powered-By`, sin ETag en JSON | Menos bytes y trabajo por respuesta |
| CORS | Solo en `/api`, orígenes configurables, preflight cacheado | Un `OPTIONS` menos por cada POST cross-origin |

---

## 1. Base de datos

### 1.1 Reserva atómica (`POST /api/citas`)
- **Antes:** `SELECT` para ver si el horario estaba libre y luego `INSERT` (2 viajes; dos peticiones simultáneas
  podían pasar el `SELECT` y duplicar la cita).
- **Ahora:** un único `INSERT ... ON CONFLICT (profesional_id, fecha_hora) DO NOTHING RETURNING id`.
  Si no devuelve fila, el horario estaba ocupado y responde 409.
- **Archivos:** [`citaRepository.js`](src/persistencia/citaRepository.js) (`existeEnHorario` y `guardar` se reemplazan
  por `guardarSiLibre`), [`citaService.js`](src/aplicacion/citaService.js) (pasa `id === null` a
  `validarAgendaLibre`, la regla sigue en el dominio), [`setup.sql`](db/setup.sql).
- **Contrato HTTP:** sin cambios (201 / 400 / 409).

### 1.2 Índice para el listado
- `CREATE INDEX citas_fecha_hora_id_idx ON citas (fecha_hora, id)`: sirve el `ORDER BY fecha_hora, id` y el
  filtro `desde`.

### 1.3 Mejoras a `setup.sql`
- Todo el script dentro de `BEGIN; ... COMMIT;`.
- `SERIAL` reemplazado por `INTEGER GENERATED ALWAYS AS IDENTITY`.
- Restricción `UNIQUE` con nombre (`citas_profesional_hora_uq`) e índice de listado.

### 1.4 Migraciones para bases ya creadas
`setup.sql` borra las tablas, así que la base existente usa estos scripts (no borran datos):

| Script | Qué hace | Nota |
|---|---|---|
| [`db/migracion-01-unique-cita.sql`](db/migracion-01-unique-cita.sql) | Agrega la restricción `UNIQUE` | **Obligatoria antes de desplegar**: sin ella, cada POST falla con 500. Falla si ya hay duplicados (el script incluye la consulta para hallarlos). |
| [`db/migracion-02-indice-citas.sql`](db/migracion-02-indice-citas.sql) | Crea el índice del listado | Idempotente (`IF NOT EXISTS`). |

## 2. Red y transferencia
- `compression()` en [`server.js`](server.js). Verificado en local: `index.html` pasa de 5286 a 2166 bytes.

## 3. Caché
- **Estáticos:** `express.static` con `maxAge: '5m'` y ETag (por defecto). El navegador reutiliza o revalida con 304.
- **`GET /api/profesionales`:** caché en memoria de 60 s en [`citaService.js`](src/aplicacion/citaService.js).
  Se guarda la promesa, no el resultado, para que peticiones simultáneas compartan una sola consulta; los
  fallos no se cachean. La respuesta lleva `Cache-Control: public, max-age=60`.
  Verificado: 5 llamadas simultáneas ejecutan 1 consulta.
- **Límite conocido:** la caché vive en el proceso. Con Render free (1 instancia) es correcto; se pierde cuando
  la instancia se duerme o reinicia, lo cual es inocuo porque solo cuesta una consulta.

## 4. API
### Paginación de `GET /api/citas`
```
GET /api/citas?limite=50&pagina=1&desde=2026-10-01T00:00:00Z
```
| Parámetro | Por defecto | Regla |
|---|---|---|
| `limite` | 50 | Máximo 100; valores inválidos usan el defecto |
| `pagina` | 1 | Máximo 10000; valores inválidos usan 1 |
| `desde` | sin filtro | ISO 8601; si no es una fecha, responde **400** |

- El cuerpo **sigue siendo un arreglo**, así que los clientes existentes no se rompen.
- La paginación viaja en cabeceras: `X-Pagina`, `X-Limite`, `X-Hay-Mas`.
- Se pide `limite + 1` filas para calcular `X-Hay-Mas` sin ejecutar un `COUNT(*)`.
- Las reglas de normalización viven en el dominio: `normalizarPaginacion` en
  [`reglasDeAgenda.js`](src/dominio/reglasDeAgenda.js).

## 5. Conexiones (pool de Postgres)
En [`db.js`](src/persistencia/db.js):

| Opción | Valor | Motivo |
|---|---|---|
| `max` | 10 (o `PG_POOL_MAX`) | Sobra para una instancia pequeña y cabe en el límite del Transaction Pooler |
| `idleTimeoutMillis` | 30 s | Devuelve conexiones ociosas al pooler |
| `connectionTimeoutMillis` | 5 s | Bajo carga falla rápido en vez de colgarse |
| `statement_timeout` | 10 s | Una consulta lenta no retiene la conexión |
| `keepAlive` | `true` | Evita que el NAT corte conexiones ociosas |
| `pool.on('error')` | manejador | Sin él, una conexión ociosa cerrada por el pooler tumbaba el proceso |

Sin `cluster` ni instancias adicionales: se mantiene la configuración por defecto del plan gratuito.

## 6. Cliente
En [`public/index.html`](public/index.html), `iniciar()` lanza `salud`, `profesionales` y `citas` con
`Promise.all` en lugar de hacerlas en fila. La página espera al más lento y no a la suma
(~130 ms en vez de ~400 ms con el RTT medido).

## 7. Cabeceras HTTP
- `Cache-Control: no-store` en `/api/salud` y `/api/citas` (cambian en cada petición o al reservar).
- `X-Powered-By` desactivado.
- ETag desactivado para los JSON de la API (calcular el hash no ahorraba trabajo en la DB); los estáticos
  conservan el suyo.

## 8. CORS y cuerpo de la petición
- `cors()` se aplica solo a `/api`, no a los estáticos.
- Orígenes desde la variable `CORS_ORIGIN` (lista separada por comas); por defecto `*`, como antes.
- `methods: GET, POST`, `exposedHeaders` con las cabeceras de paginación y `maxAge: 86400`
  (el navegador recuerda el preflight 24 h).
- `express.json({ limit: '10kb' })`.
- Con el cliente servido por el mismo servidor (mismo origen) CORS no interviene.

## 9. Documentación
- [`README.md`](README.md): tabla de API con los parámetros nuevos y la nota de concurrencia actualizada
  (la condición de carrera ya no se conserva a propósito).

---

## Configuración nueva

| Variable | Obligatoria | Por defecto | Uso |
|---|---|---|---|
| `CORS_ORIGIN` | No | `*` | Orígenes permitidos para la API |
| `PG_POOL_MAX` | No | `10` | Tamaño máximo del pool |

Nueva dependencia: `compression`.

## Pasos de despliegue
1. Ejecutar `db/migracion-01-unique-cita.sql` y `db/migracion-02-indice-citas.sql` en el SQL Editor de Supabase.
2. Fusionar/desplegar la rama en Render.
3. Repetir las 4 pruebas de autocannon de `throughput/note.md` y comparar.

## Verificación realizada
Contra un Postgres 15 local (no contra Supabase ni Render):
- `setup.sql` ejecuta completo; las migraciones aplican sobre el esquema antiguo de `main`.
- 20 POST simultáneos al mismo horario: **1 × 201, 19 × 409, 1 fila** en la tabla.
- POST duplicado 409, fecha pasada 400, datos faltantes 400.
- Paginación: páginas, `X-Hay-Mas`, `desde` inválido (400), límite absurdo (recortado a 100).
- Preflight CORS 204 con `Access-Control-Max-Age: 86400`; cabeceras de caché correctas.
- Caché de profesionales: 5 llamadas simultáneas, 1 consulta; los fallos no se cachean.

**No verificado:** rendimiento real bajo carga en Render/Supabase.

## Pendiente
- Escapar el HTML en el cliente (`innerHTML` con `paciente` y `nombre` permite XSS).
- Validar `paciente` (vacío o muy largo) en el dominio y luego agregar un `CHECK` en la base.
- Estrategias con tecnología intermedia (CDN, microcaché); ver la conversación de la sesión.

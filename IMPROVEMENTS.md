# Mejoras de rendimiento y latencia

Rama: `feature/improvements` · Base: `main` (`820c4e5`)
Commits: `5dc0312` (reserva atómica + compresión) · `8813b2e` (paginación, caché, pool, cabeceras, CORS, SQL) ·
`47affd8` (este documento) · microcaché del listado (ver §3)

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
| Caché | Microcaché de 3 s para `GET /api/citas`, invalidada al reservar | Cientos de GET comparten una consulta; ~2× de throughput medido en local |
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

### 1.4 Datos por defecto (`seed.sql`)
- [`db/seed.sql`](db/seed.sql) carga 5 profesionales y 8 citas. `setup.sql` quedó solo con el esquema
  (una única fuente de los datos).
- Vacía las tablas con `TRUNCATE ... RESTART IDENTITY` antes de insertar, por lo que se puede re-ejecutar y deja
  siempre el mismo estado; **no lo uses en una base con citas reales**.
- Las fechas son relativas a hoy (siempre a futuro) y el profesional se busca por nombre, no por id, para no
  depender del orden de inserción. Respeta el `UNIQUE (profesional_id, fecha_hora)`.
- La guía del blog ([`blog-semana-7.html`](public/blog-semana-7.html)) se actualizó: ahora hay un paso extra
  (ejecutar `seed.sql`) y las cifras esperadas son 5 profesionales y 8 citas.

### 1.5 Migraciones para bases ya creadas
`setup.sql` borra las tablas, así que la base existente usa estos scripts (no borran datos):

| Script | Qué hace | Nota |
|---|---|---|
| [`db/migracion-01-unique-cita.sql`](db/migracion-01-unique-cita.sql) | Agrega la restricción `UNIQUE` | **Obligatoria antes de desplegar**: sin ella, cada POST falla con 500. Falla si ya hay duplicados (el script incluye la consulta para hallarlos). |
| [`db/migracion-02-indice-citas.sql`](db/migracion-02-indice-citas.sql) | Crea el índice del listado | Idempotente (`IF NOT EXISTS`). |

## 2. Red y transferencia
- `compression()` en [`server.js`](server.js). Verificado en local: `index.html` pasa de 5286 a 2166 bytes.

## 3. Caché
- **Estáticos:** `express.static` con `maxAge: '5m'` y ETag (por defecto). El navegador reutiliza o revalida con 304.
- **Módulo común:** [`cacheTTL.js`](src/infraestructura/cacheTTL.js), `crearCacheTTL({ ttlMs, maxEntradas })`.
  Guarda la promesa (no el resultado), de modo que las peticiones simultáneas a la misma clave comparten una
  sola carga; los fallos no se cachean; con `ttlMs <= 0` queda desactivada; y acota la memoria descartando la
  entrada más antigua al llegar a `maxEntradas` (las claves salen de parámetros del usuario).
- **`GET /api/profesionales`:** caché de 60 s en [`profesionalService.js`](src/aplicacion/profesionalService.js) y
  `Cache-Control: public, max-age=60` hacia el navegador.
- **`GET /api/citas` (microcaché):** 3 s por combinación `limite|offset|desde`, hasta 100 combinaciones. Vive en el
  decorador [`citaRepositoryConCache.js`](src/persistencia/citaRepositoryConCache.js), que envuelve al repositorio.
  `guardarSiLibre` la invalida entera al insertar, así quien reserva ve su cita de inmediato. El navegador
  no la guarda (`no-store`).
- **Desactivar/ajustar:** `CACHE_CITAS_MS=0` la apaga; cualquier otro valor cambia el TTL en milisegundos.
  Sirve para medir con y sin caché.
- **Límites conocidos:**
  - La caché vive en el proceso: es correcta con una sola instancia (Render free). Con varias instancias
    la invalidación no se propaga y el dato puede tener hasta `CACHE_CITAS_MS` de retraso; ahí toca Redis.
  - Un cambio hecho directamente en la base (SQL Editor) tarda hasta 3 s en verse.
  - Se pierde al dormirse o reiniciarse la instancia, lo cual es inocuo: cuesta una consulta.
- **Verificado:** 50 GET simultáneos ejecutan 1 consulta; reservar invalida; cada página tiene su clave.

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
  [`paginacion.js`](src/dominio/paginacion.js).

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
| `CACHE_CITAS_MS` | No | `3000` | TTL de la microcaché del listado; `0` la desactiva |

Nueva dependencia: `compression`.

## Orden de ejecución de los scripts SQL
| Situación | Orden |
|---|---|
| Base nueva o reiniciable (borra datos) | `setup.sql` → `seed.sql` |
| Base existente, conservando las citas | (revisar duplicados) → `migracion-01-unique-cita.sql` → `migracion-02-indice-citas.sql`; **no** correr `setup.sql` ni `seed.sql` |
| Base existente, reiniciando con datos por defecto | migraciones 01 y 02 → `seed.sql`, o directamente `setup.sql` → `seed.sql` |

Nunca ejecutes las migraciones después de `setup.sql`: la 01 falla porque la restricción ya existe.

## Pasos de despliegue
1. Preparar la base según la tabla anterior (las migraciones 01 y 02 si se conservan los datos).
2. Fusionar/desplegar la rama en Render.
3. Repetir las 4 pruebas de autocannon de `throughput/note.md` y comparar.

## Verificación realizada
Contra un Postgres 15 local (no contra Supabase ni Render):
- `setup.sql` ejecuta completo; las migraciones aplican sobre el esquema antiguo de `main`.
- `setup.sql` → `seed.sql` deja 5 profesionales y 8 citas, todas a futuro; `seed.sql` se puede re-ejecutar y también
  funciona sobre una base migrada.
- 20 POST simultáneos al mismo horario: **1 × 201, 19 × 409, 1 fila** en la tabla.
- POST duplicado 409, fecha pasada 400, datos faltantes 400.
- Paginación: páginas, `X-Hay-Mas`, `desde` inválido (400), límite absurdo (recortado a 100).
- Preflight CORS 204 con `Access-Control-Max-Age: 86400`; cabeceras de caché correctas.
- Caché de profesionales: 5 llamadas simultáneas, 1 consulta; los fallos no se cachean.

- Microcaché, medida en local (Postgres 15, 2 000 citas, `GET /api/citas?limite=100`, autocannon 200 conexiones,
  8 s, cliente y servidor en la misma máquina):

  | | RPS | Latencia prom. | p97.5 | p99 | Errores |
  |---|---:|---:|---:|---:|---:|
  | Sin caché (`CACHE_CITAS_MS=0`) | 4 554 | 43 ms | 47 ms | 49 ms | 0 |
  | Con caché (3 s) | 9 282 | 21 ms | 36 ms | 39 ms | 0 |

  Solo sirve para comparar la mejora relativa (~2×); no es comparable con las cifras de Render de
  `throughput/note.md`, que incluyen la red. Con la caché activa, las pruebas sobre `GET /api/citas` miden la
  caché y no la base de datos: conviene reportar ambas cifras.
- Integración: leer, reservar y volver a leer muestra la cita nueva de inmediato.

**No verificado:** rendimiento real bajo carga en Render/Supabase.

## Pendiente
- Escapar el HTML en el cliente (`innerHTML` con `paciente` y `nombre` permite XSS).
- Validar `paciente` (vacío o muy largo) en el dominio y luego agregar un `CHECK` en la base.
- CDN (Cloudflare) delante de Render: requiere dominio propio.
- Redis: solo si se escala a más de una instancia.
- Evitar el cold start de Render free (ping externo): pendiente de decisión.

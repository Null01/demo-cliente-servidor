# Demo en Capas: Reserva de Citas (refactorización)

**Arquitectura de Sistemas I · 2026-2 · Semana 8**

Este proyecto es **el mismo sistema de la Semana 7** (demo Cliente-Servidor), con una diferencia deliberada: el interior del servidor fue **reorganizado en capas**. El comportamiento es idéntico — mismos endpoints, mismas reglas, mismas respuestas — y por eso:

- `public/index.html` (el cliente) **no cambió ni una línea**.
- `db/setup.sql` (la base de datos) **no cambió ni una línea**.
- El despliegue en Render y Supabase es **exactamente el mismo** (ver README de la Semana 7).

Ese es el mensaje central de la clase: la vista por capas organiza el **interior** de una aplicación; la vista cliente-servidor (quién habla con quién por la red) queda intacta. Son vistas complementarias.

> **Actualización (rama `refactor/architecture`):** además de las capas, la aplicación ahora depende de un **contrato de repositorios** (`src/contratos/repositorios.js`) en lugar de importar los repositorios concretos, y `server.js` actúa como **raíz de composición** que crea e inyecta las implementaciones. Además se segregó más: `app.js` (Express) separado del arranque, servicios por agregado, dominio dividido en tres módulos, `config.js` como único lector del entorno, caché del listado como decorador del repositorio, `cacheTTL.js` en `infraestructura/` y respuestas HTTP (`"Cita creada"`) fuera del servicio. Las secciones de abajo ya reflejan esta estructura; el comportamiento externo sigue siendo idéntico. Los diagramas están en el [README](../README.md#arquitectura-de-componentes-inyección-de-dependencias).

---

## Antes y después

**Semana 7** — todo en un archivo:

```
server.js  (~130 líneas: rutas + reglas + SQL + conexión, todo mezclado)
```

**Semana 8** — una carpeta por capa:

```
server.js                              ← raíz de composición: lee la configuración, crea el pool y los repositorios y los inyecta
src/
├── config.js                          ← única lectura de variables de entorno
├── app.js                             ← Express: middlewares y rutas (no abre puerto; se puede probar sin base de datos)
├── presentacion/
│   └── citasRoutes.js                 ← traduce HTTP ↔ aplicación; decide códigos 400/409/500
├── aplicacion/
│   ├── citaService.js                 ← casos de uso de citas; recibe CitaRepository inyectado (sin caché ni mensajes HTTP)
│   └── profesionalService.js          ← caso de uso del catálogo; recibe ProfesionalRepository inyectado
├── infraestructura/
│   └── cacheTTL.js                    ← caché en memoria con vencimiento (utilidad técnica)
├── contratos/
│   └── repositorios.js                ← interfaces de acceso a datos (CitaRepository, ProfesionalRepository) y su verificación
├── dominio/
│   ├── errores.js                     ← ErrorDeNegocio con código simbólico
│   ├── validacionCita.js              ← reglas de reserva: datos completos, fecha futura, agenda libre
│   └── paginacion.js                  ← normalización de limite/pagina/desde (puras, sin Express ni SQL)
└── persistencia/
    ├── db.js                          ← crearPool(config): el pool de conexiones a Supabase
    ├── citaRepository.js              ← implementa CitaRepository: todo el SQL de citas
    ├── citaRepositoryConCache.js      ← decorador de CitaRepository: microcaché del listado
    └── profesionalRepository.js       ← implementa ProfesionalRepository: todo el SQL de profesionales
```

### ¿A dónde se fue cada pedazo del server.js original?

| En la Semana 7 estaba... | En la Semana 8 vive en... | ¿Por qué ahí? |
|---|---|---|
| `if (!paciente || ...)` — datos obligatorios | `dominio/validacionCita.js` | Es una regla del negocio |
| `if (new Date(fecha_hora) <= new Date())` — no citas en el pasado | `dominio/validacionCita.js` | Es una regla del negocio |
| Consulta de choque de agenda + rechazo | Verificar e insertar: `persistencia/citaRepository.guardarSiLibre` (una sola consulta atómica) · Decisión: `dominio/validarAgendaLibre` | Averiguar es persistencia; decidir es dominio |
| Todos los `pool.query(...)` (SQL) | `persistencia/*Repository.js` | Guardar y consultar es persistencia |
| `new Pool({...})` (conexión) | `persistencia/db.js` | Detalle técnico, un solo lugar |
| `res.status(400/409/500).json(...)` | `presentacion/citasRoutes.js` | Los códigos HTTP son asunto del protocolo, no del negocio |
| El orden de los pasos al reservar | `aplicacion/citaService.reservarCita` | Coordinar el caso de uso es aplicación |
| Qué implementación de base de datos se usa | `server.js` (crea los repositorios y los inyecta) · contrato en `contratos/repositorios.js` | Elegir implementaciones es cablear; el contrato mantiene a la aplicación ajena al SQL |
| Microcaché del listado de citas | `persistencia/citaRepositoryConCache.js` (decorador) sobre `infraestructura/cacheTTL.js` | La política de caché es un detalle de acceso a datos; el servicio no la conoce |
| Texto `"Cita creada"` de la respuesta | `presentacion/citasRoutes.js` | Es parte de la respuesta HTTP; el servicio solo devuelve el `id` |
| Middlewares, CORS, estáticos | `app.js` | Configurar Express no es lo mismo que componer dependencias |
| `app.listen`, variables de entorno | `server.js` y `config.js` | Arranque, cableado y configuración en un solo punto |

### El flujo de una solicitud (la diapositiva 7 del deck, en código real)

```
Cliente (navegador)
  → POST /api/citas
    → presentacion/citasRoutes.js      (extrae req.body, sin decidir nada)
      → aplicacion/citaService.js      (receta: validar datos → validar fecha → guardar si libre → validar agenda)
        → dominio/validacionCita.js    (¿cumple las reglas?)
        → contrato CitaRepository      (lo que el servicio pide; no sabe de SQL)
          → persistencia/citaRepository (implementación inyectada: SQL hacia Supabase)
          → Base de datos (Supabase)
  ← la respuesta regresa en sentido inverso:
    id nuevo → service → routes traduce a 201 + JSON → cliente
```

Y cuando una regla falla: el dominio lanza `ErrorDeNegocio('FECHA_PASADA')` → la aplicación lo deja subir → **la presentación** lo traduce a HTTP 400. El dominio nunca supo que existe HTTP.

---

## Cómo usarlo en clase

**Opción recomendada (ver el diff en GitHub):** suba esta versión al **mismo repositorio** de la Semana 7. Sin instalar nada: abra el repositorio en github.com → **Add file → Upload files** → arrastre **todos** los archivos y carpetas de este proyecto → **Commit changes**. Los archivos con el mismo nombre (como `server.js`) quedan reemplazados y la carpeta `src/` se agrega; eso crea un *commit* nuevo. Para ver el antes/después: pestaña del repositorio → historial de *commits* (el ícono de reloj junto al botón verde) → clic en el commit recién creado: GitHub muestra en rojo lo que salió y en verde lo que entró, archivo por archivo — la mejor visualización del refactor. Render redesplegará solo y el sistema seguirá funcionando igual: demuéstrelo recargando el cliente.

**Opción alternativa:** repositorio y servicio de Render nuevos (`demo-en-capas`), siguiendo los mismos 3 pasos del README de la Semana 7. Útil si quiere tener las dos versiones vivas al tiempo para compararlas en paralelo.

**Verificación en vivo sugerida:** con la versión en capas desplegada, repita las pruebas de la Semana 7 (reservar, fecha pasada → 400, choque → 409). Todo responde igual. Pregunta al curso: *"si nada cambió por fuera, ¿qué ganamos?"* → mantenibilidad, pruebas aisladas, y saber dónde vive cada cosa.

---

## Mapa del código ↔ conceptos de la clase (Semana 8)

Equivalente a la tabla de la Semana 7, para que cada semana deje una evidencia comparable:

| Concepto (arquitectura en capas) | Dónde verlo en este proyecto |
|---|---|
| Presentación | `src/presentacion/citasRoutes.js` — rutas y traducción a HTTP |
| Aplicación | `src/aplicacion/citaService.js` y `profesionalService.js` — casos de uso como recetas; cada uno recibe solo el repositorio que necesita |
| Contratos | `src/contratos/repositorios.js` — operaciones de base de datos que la aplicación puede pedir |
| Dominio | `src/dominio/errores.js`, `validacionCita.js`, `paginacion.js` — reglas puras, sin dependencias externas |
| Persistencia | `src/persistencia/*Repository.js` + `db.js` — implementan el contrato; todo el SQL y la conexión; `citaRepositoryConCache.js` decora el repositorio |
| Infraestructura (código) | `src/infraestructura/cacheTTL.js` — utilidades técnicas sin lógica de negocio |
| Raíz de composición | `server.js` — crea los repositorios e inyecta las dependencias; `config.js` centraliza el entorno |
| Infraestructura | PostgreSQL en Supabase (y la plataforma Render) — externa al código |
| El contrato de cada capa | Los `module.exports` de cada archivo; para persistencia, `src/contratos/repositorios.js` |

**Nota honesta sobre concurrencia:** el refactor conserva la misma condición de carrera de la Semana 7 (verificar disponibilidad y luego insertar, en dos pasos). Es deliberado: las capas organizan responsabilidades, no resuelven concurrencia — la exclusión real se garantiza en el nivel de datos con un índice de unicidad, y ese es un ejercicio de la sesión.

## Mapa a las diapositivas de la Semana 8

| Diapositiva del deck | Dónde verlo aquí |
|---|---|
| 6 — Capas mínimas esperadas | Las carpetas de `src/` (infraestructura aparece como `db.js` y quedaría más clara al agregar, p. ej., envío de correo) |
| 7 — Flujo de una solicitud | El diagrama de arriba, endpoint `POST /api/citas` |
| 8 — Ejemplo aplicado (reserva de cita) | Este proyecto completo |
| 9 — Vista lógica con interfaces | Los `module.exports` de cada capa son sus "contratos"; los repositorios tienen uno explícito en `src/contratos/` |
| 10 — Coherencia con Cliente-Servidor | Cliente y BD intactos; solo cambió el interior del servidor |
| 11 — Errores comunes | El server.js de la Semana 7 cometía "controlador con reglas de negocio" y "SQL en el controlador": muéstrelo como el ANTES |
| 12 — Actividad en clase | Los equipos repiten este mismo ejercicio con su proyecto |

**Pregunta de control** (la de la diapositiva 8): si mañana cambia la regla "máximo una cita por horario", ¿qué archivo se toca? → Solo `src/dominio/validacionCita.js`.

**Semana 9 — resuelto en esta rama:** antes, `citaService.js` hacía `require('../persistencia/citaRepository')` y la capa de arriba conocía concretamente a la de abajo. Ahora:

- La aplicación depende del **contrato** `CitaRepository` / `ProfesionalRepository` (`src/contratos/repositorios.js`), no de PostgreSQL.
- Los repositorios de persistencia **implementan** ese contrato y son fábricas que reciben el `pool`.
- `server.js` crea las implementaciones (envolviendo `citaRepository` con `citaRepositoryConCache`) y las **inyecta** en `crearCitaService` y `crearProfesionalService`, que a su vez se inyectan en `crearApp` (`app.js`) y de ahí en `crearCitasRoutes`.
- `verificarContrato` falla al arrancar si una implementación no tiene los métodos esperados.

Consecuencia práctica: el servicio se prueba con repositorios falsos (sin base de datos) y el motor de persistencia se cambia tocando solo `server.js` y un adaptador nuevo.

**Matiz honesto:** en JavaScript el contrato es una convención verificada en tiempo de ejecución, no una interfaz del lenguaje. Además vive en `src/contratos/` (neutral) y no dentro de `dominio/`, porque describe operaciones de base de datos y no reglas de negocio; si el curso prefiere que lo defina el dominio, basta con mover el archivo.

---

## Ejecutar localmente

Idéntico a la Semana 7:

```bash
npm install
cp .env.example .env    # y pegar su DATABASE_URL de Supabase
npm start               # abre http://localhost:3000
```

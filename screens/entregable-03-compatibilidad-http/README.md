# Entregable 03 · Compatibilidad HTTP (API sin regresiones)

Rama `refactor/architecture`, con el servidor local (`node server.js`) conectado a una **base de pruebas local**: PostgreSQL 15 con SSL, esquema `db/setup.sql` y datos de `db/seed.sql`. No se usó Supabase ni ninguna base compartida.

Script: [`test/api-smoke.js`](../../test/api-smoke.js) (`BASE_URL=http://localhost:3100 node test/api-smoke.js`).

| Archivo | Qué muestra |
|---|---|
| `01-verificacion-http-6-de-6.png` | Las seis verificaciones: GET `/api/salud`, `/api/profesionales` y `/api/citas` → 200; POST válido → 201; repetido → 409; fecha pasada → 400 |
| `02-comparacion-con-refactor-dip-di.png` | Las mismas peticiones contra `refactor/architecture` y `refactor-dip-di` (docente), con la misma base de pruebas: mismos códigos y mismos mensajes JSON |
| `03-cabeceras.png` | Cabeceras de `GET /api/citas` en ambas ramas: el cuerpo es idéntico (1440 bytes) y cambian solo cabeceras y compresión |
| `resultado-*.txt` | Salida en texto de las capturas 1 y 2 |

## Qué cambia y qué no entre las dos ramas
- **Sin cambios:** rutas, códigos 200, 201, 400 y 409, mensajes de error y cuerpos JSON. `GET /api/profesionales` devuelve el mismo contenido y `GET /api/citas` los mismos 1440 bytes.
- **Cabeceras nuevas en `refactor/architecture`:** `Cache-Control: no-store`, `Vary: Accept-Encoding`, `X-Pagina`, `X-Limite`, `X-Hay-Mas` y `Access-Control-Expose-Headers`. El listado admite `?limite&pagina&desde`.
- **Cabeceras que desaparecen:** `ETag` y `X-Powered-By`.
- **Compresión:** con `Accept-Encoding: gzip`, la respuesta de `GET /api/citas` baja de 1440 a 404 bytes; la rama del docente no comprime.

## Alcance
- El 409 se comprobó con peticiones secuenciales; no demuestra seguridad ante concurrencia.
- Los datos y los ids de la base local no son los de Supabase. Los ids de las reservas difieren entre ramas porque comparten la misma base.

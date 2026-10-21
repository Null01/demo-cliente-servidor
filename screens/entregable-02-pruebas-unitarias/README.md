# Entregable 02 · Pruebas unitarias aisladas (sin PostgreSQL)

Rama `refactor/architecture`: 52 pruebas en 10 archivos de `test/`, una carpeta por capa, con el runner nativo de Node (`node --test`). Ninguna importa `pg` ni `db.js` ni lee `DATABASE_URL`; los servicios usan repositorios falsos y los repositorios, un pool falso.

| Archivo | Qué muestra |
|---|---|
| `01-npm-test.png` | `npm test` abreviado (primeras y últimas pruebas, resumen completo): 52 aprobadas |
| `02-cobertura.png` | `npm run test:coverage`: cobertura por archivo de los módulos que cargan las pruebas |
| `03-sin-postgresql.png` | Búsqueda sin coincidencias de `pg`, `db.js` y `DATABASE_URL` en `test/`; la suite pasa con la variable sin definir |
| `04-cobertura-html.png` | Informe HTML de cobertura: 100 % de sentencias, ramas, funciones y líneas |

Cobertura: 100 % de líneas, ramas y funciones en los módulos que cargan las pruebas; `server.js`, `config.js` y `db.js` no se cargan y no aparecen en el reporte.

// Punto de entrada y raíz de composición: aquí se lee la configuración, se
// crean las implementaciones concretas (PostgreSQL) y se inyectan hacia
// arriba; ninguna otra capa las instancia. La lógica vive en src/.
const config = require('./src/config');
const { crearPool } = require('./src/persistencia/db');
const { crearCitaRepository } = require('./src/persistencia/citaRepository');
const { crearCitaRepositoryConCache } = require('./src/persistencia/citaRepositoryConCache');
const { crearProfesionalRepository } = require('./src/persistencia/profesionalRepository');
const { crearCitaService } = require('./src/aplicacion/citaService');
const { crearProfesionalService } = require('./src/aplicacion/profesionalService');
const { crearApp } = require('./src/app');

const pool = crearPool(config.baseDeDatos);

const app = crearApp({
  citaService: crearCitaService({
    // El microcaché es un decorador del repositorio, no parte del servicio.
    citaRepository: crearCitaRepositoryConCache(crearCitaRepository(pool), {
      ttlMs: config.cacheCitasMs,
    }),
  }),
  profesionalService: crearProfesionalService({
    profesionalRepository: crearProfesionalRepository(pool),
  }),
  corsOrigenes: config.corsOrigenes,
});

app.listen(config.puerto, () => {
  console.log(`Servidor escuchando en el puerto ${config.puerto}`);
  console.log(`Cliente web: http://localhost:${config.puerto}`);
});

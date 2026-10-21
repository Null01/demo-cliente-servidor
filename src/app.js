// Aplicación Express: middlewares y rutas. No abre puerto ni crea conexiones;
// recibe los servicios ya construidos, de modo que se puede levantar en una
// prueba con servicios falsos y sin base de datos. server.js la arranca.
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { crearCitasRoutes } = require('./presentacion/citasRoutes');

function crearApp({ citaService, profesionalService, corsOrigenes = '*' }) {
  const app = express();
  app.disable('x-powered-by'); // bytes de menos en cada respuesta y no anuncia el framework
  app.set('etag', false);      // los JSON de la API no se revalidan; los estáticos traen su propio ETag

  app.use(compression());
  // ETag + caché corta: el navegador revalida sin volver a descargar.
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '5m' }));

  // CORS solo aplica a la API. Con el cliente servido por este mismo servidor
  // no hace falta (mismo origen); existe por si el HTML se abre por separado.
  app.use(
    '/api',
    cors({
      origin: corsOrigenes,
      methods: ['GET', 'POST'],
      exposedHeaders: ['X-Pagina', 'X-Limite', 'X-Hay-Mas'],
      maxAge: 86400, // el navegador recuerda el preflight 24 h y se ahorra un OPTIONS por POST
    }),
    express.json({ limit: '10kb' }),
    crearCitasRoutes({ citaService, profesionalService })
  );

  return app;
}

module.exports = { crearApp };

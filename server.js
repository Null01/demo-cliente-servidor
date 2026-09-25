// Punto de entrada. La lógica vive en src/, una carpeta por capa;
// aquí solo se configura Express y se conecta la capa de presentación.
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const citasRoutes = require('./src/presentacion/citasRoutes');

const app = express();
app.disable('x-powered-by'); // bytes de menos en cada respuesta y no anuncia el framework
app.set('etag', false);      // los JSON de la API no se revalidan; los estáticos traen su propio ETag

app.use(compression());
// ETag + caché corta: el navegador revalida sin volver a descargar.
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '5m' }));

// CORS solo aplica a la API. Con el cliente servido por este mismo servidor
// no hace falta (mismo origen); existe por si el HTML se abre por separado.
// CORS_ORIGIN admite una lista separada por comas; por defecto, cualquiera.
const origenes = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : '*';
app.use(
  '/api',
  cors({
    origin: origenes,
    methods: ['GET', 'POST'],
    exposedHeaders: ['X-Pagina', 'X-Limite', 'X-Hay-Mas'],
    maxAge: 86400, // el navegador recuerda el preflight 24 h y se ahorra un OPTIONS por POST
  }),
  express.json({ limit: '10kb' }),
  citasRoutes
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  console.log(`Cliente web: http://localhost:${PORT}`);
});

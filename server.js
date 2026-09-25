// Punto de entrada. La lógica vive en src/, una carpeta por capa;
// aquí solo se configura Express y se conecta la capa de presentación.
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const citasRoutes = require('./src/presentacion/citasRoutes');

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json());
// ETag (por defecto) + caché corta: el navegador revalida sin volver a descargar.
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '5m' }));
app.use('/api', citasRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  console.log(`Cliente web: http://localhost:${PORT}`);
});

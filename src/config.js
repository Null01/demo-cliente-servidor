// Única lectura de variables de entorno. El resto del código recibe estos
// valores por parámetro, así que no necesita saber que existe process.env.
require('dotenv').config();

// Entero positivo desde el entorno; si falta o no es válido, el valor por defecto.
function entero(valor, porDefecto) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

const config = {
  puerto: entero(process.env.PORT, 3000),
  // CORS_ORIGIN admite una lista separada por comas; por defecto, cualquiera.
  corsOrigenes: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : '*',
  // CACHE_CITAS_MS=0 desactiva el microcaché del listado.
  cacheCitasMs: process.env.CACHE_CITAS_MS === undefined ? 3000 : Number(process.env.CACHE_CITAS_MS),
  baseDeDatos: {
    url: process.env.DATABASE_URL,
    maxConexiones: entero(process.env.PG_POOL_MAX, 10),
  },
};

if (!config.baseDeDatos.url) {
  console.warn('Aviso: falta DATABASE_URL; las rutas que usan la base de datos fallarán.');
}

module.exports = config;

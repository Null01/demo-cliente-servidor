// Conexión a Postgres (Supabase). La cadena y el tamaño del pool llegan por
// parámetro desde config.js (que lee las variables de entorno); ver .env.example.
const { Pool } = require('pg');

function crearPool({ url, maxConexiones }) {
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false }, // Supabase exige TLS
    // Render free = 1 instancia pequeña: 10 conexiones sobran y caben con holgura
    // en el límite del Transaction Pooler.
    max: maxConexiones,
    idleTimeoutMillis: 30 * 1000,      // devuelve conexiones ociosas al pooler
    connectionTimeoutMillis: 5 * 1000, // bajo carga falla rápido en vez de colgarse
    statement_timeout: 10 * 1000,      // una consulta lenta no retiene la conexión
    keepAlive: true,                   // evita que el NAT corte conexiones ociosas
  });

  // Sin este manejador, un error en una conexión ociosa (p. ej. el pooler
  // la cierra) sería una excepción no capturada y tumbaría el proceso.
  pool.on('error', (error) => {
    console.error('Error en una conexión ociosa del pool:', error.message);
  });

  return pool;
}

module.exports = { crearPool };

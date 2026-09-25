// Conexión a Postgres (Supabase). La cadena llega por variable de entorno
// para no versionar credenciales; ver .env.example.
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase exige TLS
  // Render free = 1 instancia pequeña: 10 conexiones sobran y caben con holgura
  // en el límite del Transaction Pooler. Se pueden sobrescribir por entorno.
  max: Number(process.env.PG_POOL_MAX) || 10,
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

module.exports = pool;

// Verificación HTTP de compatibilidad (no forma parte de `npm test`).
// Requiere el servidor en marcha (`npm start`) y una base de datos de PRUEBAS:
// el script crea una cita. BASE_URL cambia el destino (por defecto localhost:3000).
const assert = require('node:assert/strict');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function solicitar(metodo, ruta, datos) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: datos ? { 'Content-Type': 'application/json' } : {},
    body: datos ? JSON.stringify(datos) : undefined,
  });
  return { estado: respuesta.status, cuerpo: await respuesta.json() };
}

function paso(n, descripcion, esperado, obtenido) {
  assert.equal(obtenido, esperado, `${descripcion}: se esperaba ${esperado} y llegó ${obtenido}`);
  console.log(`✔ ${n}. ${descripcion} → ${obtenido}`);
}

async function verificar() {
  const salud = await solicitar('GET', '/api/salud');
  paso(1, 'GET  /api/salud', 200, salud.estado);

  const prof = await solicitar('GET', '/api/profesionales');
  paso(2, 'GET  /api/profesionales', 200, prof.estado);
  assert.ok(Array.isArray(prof.cuerpo) && prof.cuerpo.length > 0, 'la base de pruebas necesita al menos un profesional');

  const citas = await solicitar('GET', '/api/citas');
  paso(3, 'GET  /api/citas', 200, citas.estado);
  assert.ok(Array.isArray(citas.cuerpo));

  const reserva = {
    paciente: 'Prueba Entregable 03',
    profesional_id: prof.cuerpo[0].id,
    fecha_hora: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  };
  const creada = await solicitar('POST', '/api/citas', reserva);
  paso(4, 'POST /api/citas (reserva válida)', 201, creada.estado);
  assert.ok(creada.cuerpo.id, 'la creación debe devolver un id');

  const repetida = await solicitar('POST', '/api/citas', reserva);
  paso(5, 'POST /api/citas (misma reserva, secuencial)', 409, repetida.estado);

  const pasada = await solicitar('POST', '/api/citas', {
    ...reserva,
    fecha_hora: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  });
  paso(6, 'POST /api/citas (fecha pasada)', 400, pasada.estado);

  console.log('API comprobada: 6 de 6 verificaciones (GET 200, POST 201, 409 y 400).');
}

verificar().catch((error) => {
  console.error('Falló la verificación HTTP:', error.message);
  process.exitCode = 1;
});

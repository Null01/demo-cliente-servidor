const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { crearApp } = require('../../src/app');
const { ErrorDeNegocio } = require('../../src/dominio/errores');

// Servicios falsos configurables por prueba: la capa HTTP se prueba sin base de datos.
const servicios = {
  consultarCitas: async () => ({ citas: [], pagina: 1, limite: 50, hayMas: false }),
  reservarCita: async () => ({ id: 1 }),
  consultarProfesionales: async () => [],
};

let servidor;
let base;

before(async () => {
  const app = crearApp({
    citaService: {
      consultarCitas: (p) => servicios.consultarCitas(p),
      reservarCita: (d) => servicios.reservarCita(d),
    },
    profesionalService: { consultarProfesionales: () => servicios.consultarProfesionales() },
  });
  await new Promise((ok) => { servidor = app.listen(0, '127.0.0.1', ok); });
  base = `http://127.0.0.1:${servidor.address().port}/api`;
});

after(() => new Promise((ok) => servidor.close(ok)));

const post = (cuerpo) =>
  fetch(`${base}/citas`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });

test('GET /salud responde 200 sin caché', async () => {
  const r = await fetch(`${base}/salud`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal((await r.json()).estado, 'ok');
});

test('GET /citas devuelve el arreglo y la paginación en cabeceras', async () => {
  servicios.consultarCitas = async (q) => {
    assert.equal(q.limite, '5');
    return { citas: [{ id: 1 }], pagina: 2, limite: 5, hayMas: true };
  };
  const r = await fetch(`${base}/citas?limite=5`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), [{ id: 1 }]);
  assert.deepEqual(
    [r.headers.get('x-pagina'), r.headers.get('x-limite'), r.headers.get('x-hay-mas')],
    ['2', '5', 'true']
  );
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('GET /profesionales devuelve el catálogo con caché pública de 60 s', async () => {
  servicios.consultarProfesionales = async () => [{ id: 1, nombre: 'Ana' }];
  const r = await fetch(`${base}/profesionales`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=60');
  assert.deepEqual(await r.json(), [{ id: 1, nombre: 'Ana' }]);
});

test('POST /citas responde 201 con el mensaje y el id', async () => {
  servicios.reservarCita = async () => ({ id: 42 });
  const r = await post({ paciente: 'Ana' });
  assert.equal(r.status, 201);
  assert.deepEqual(await r.json(), { mensaje: 'Cita creada', id: 42 });
});

test('los errores de negocio se traducen a su código HTTP', async () => {
  const casos = { DATOS_FALTANTES: 400, FECHA_INVALIDA: 400, FECHA_PASADA: 400, AGENDA_OCUPADA: 409, OTRO: 400 };
  for (const [codigo, estado] of Object.entries(casos)) {
    servicios.reservarCita = async () => { throw new ErrorDeNegocio(codigo, `msg ${codigo}`); };
    const r = await post({});
    assert.equal(r.status, estado, codigo);
    assert.deepEqual(await r.json(), { error: `msg ${codigo}` });
  }
});

test('un error inesperado responde 500 genérico sin filtrar detalles', async (t) => {
  t.mock.method(console, 'error', () => {});
  servicios.consultarCitas = async () => { throw new Error('password=secreto'); };
  const r = await fetch(`${base}/citas`);
  assert.equal(r.status, 500);
  assert.deepEqual(await r.json(), { error: 'No se pudo consultar la base de datos' });
});

test('un error inesperado al listar profesionales responde 500 genérico', async (t) => {
  t.mock.method(console, 'error', () => {});
  servicios.consultarProfesionales = async () => { throw new Error('conexión caída'); };
  const r = await fetch(`${base}/profesionales`);
  assert.equal(r.status, 500);
  assert.deepEqual(await r.json(), { error: 'No se pudo consultar la base de datos' });
});

test('un error inesperado al reservar responde 500 genérico', async (t) => {
  t.mock.method(console, 'error', () => {});
  servicios.reservarCita = async () => { throw new Error('conexión caída'); };
  const r = await post({});
  assert.equal(r.status, 500);
  assert.deepEqual(await r.json(), { error: 'No se pudo guardar en la base de datos' });
});

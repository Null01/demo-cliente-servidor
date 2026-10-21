const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearProfesionalService } = require('../../src/aplicacion/profesionalService');

test('exige que el repositorio cumpla el contrato', () => {
  assert.throws(() => crearProfesionalService({ profesionalRepository: {} }), /ProfesionalRepository incumple/);
});

test('consultarProfesionales devuelve el catálogo del repositorio', async () => {
  const catalogo = [{ id: 1, nombre: 'Ana', especialidad: 'General' }];
  const servicio = crearProfesionalService({ profesionalRepository: { listarTodos: async () => catalogo } });
  assert.deepEqual(await servicio.consultarProfesionales(), catalogo);
});

test('el catálogo se guarda en memoria: llamadas seguidas consultan una vez', async () => {
  let consultas = 0;
  const servicio = crearProfesionalService({
    profesionalRepository: { listarTodos: async () => { consultas++; return []; } },
  });
  await servicio.consultarProfesionales();
  await servicio.consultarProfesionales();
  assert.equal(consultas, 1);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearProfesionalRepository } = require('../../src/persistencia/profesionalRepository');

test('listarTodos devuelve las filas de la consulta', async () => {
  const filas = [{ id: 1, nombre: 'Ana', especialidad: 'General' }];
  const consultas = [];
  const pool = { query: async (sql) => { consultas.push(sql); return { rows: filas }; } };

  assert.deepEqual(await crearProfesionalRepository(pool).listarTodos(), filas);
  assert.match(consultas[0], /FROM profesionales ORDER BY nombre/);
});

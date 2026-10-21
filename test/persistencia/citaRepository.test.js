const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearCitaRepository } = require('../../src/persistencia/citaRepository');

// Pool falso: registra cada consulta y responde con las filas indicadas.
function poolFalso(rows) {
  const consultas = [];
  return { consultas, query: async (sql, params) => { consultas.push({ sql, params }); return { rows }; } };
}

test('listar pide una fila de más y la descarta si hay otra página', async () => {
  const pool = poolFalso([{ id: 1 }, { id: 2 }, { id: 3 }]);
  const repo = crearCitaRepository(pool);

  const r = await repo.listar({ limite: 2, offset: 4, desde: null });

  assert.deepEqual(r, { citas: [{ id: 1 }, { id: 2 }], hayMas: true });
  assert.deepEqual(pool.consultas[0].params, [null, 3, 4]); // limite + 1
});

test('listar indica que no hay más páginas cuando no sobra ninguna fila', async () => {
  const repo = crearCitaRepository(poolFalso([{ id: 1 }, { id: 2 }]));
  assert.deepEqual(await repo.listar({ limite: 2, offset: 0, desde: null }), {
    citas: [{ id: 1 }, { id: 2 }],
    hayMas: false,
  });
});

test('guardarSiLibre devuelve el id insertado', async () => {
  const pool = poolFalso([{ id: 99 }]);
  const repo = crearCitaRepository(pool);

  const id = await repo.guardarSiLibre({ paciente: 'Ana', profesional_id: 3, fecha_hora: 'F' });

  assert.equal(id, 99);
  assert.deepEqual(pool.consultas[0].params, ['Ana', 3, 'F']);
  assert.match(pool.consultas[0].sql, /ON CONFLICT \(profesional_id, fecha_hora\) DO NOTHING/);
});

test('guardarSiLibre devuelve null si el horario ya estaba ocupado', async () => {
  const repo = crearCitaRepository(poolFalso([]));
  assert.equal(await repo.guardarSiLibre({ paciente: 'Ana', profesional_id: 3, fecha_hora: 'F' }), null);
});

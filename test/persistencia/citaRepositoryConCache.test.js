const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearCitaRepositoryConCache } = require('../../src/persistencia/citaRepositoryConCache');

function repositorioFalso({ id = 5 } = {}) {
  const llamadas = { listar: 0, guardarSiLibre: 0 };
  return {
    llamadas,
    listar: async () => { llamadas.listar++; return { citas: [{ id: llamadas.listar }], hayMas: false }; },
    guardarSiLibre: async () => { llamadas.guardarSiLibre++; return id; },
  };
}

const pag = (extra = {}) => ({ limite: 50, offset: 0, desde: null, ...extra });

test('exige que el repositorio envuelto cumpla el contrato', () => {
  assert.throws(() => crearCitaRepositoryConCache({}), /CitaRepository incumple/);
});

test('listar reutiliza el resultado para la misma paginación', async () => {
  const base = repositorioFalso();
  const repo = crearCitaRepositoryConCache(base, { ttlMs: 1000 });

  const a = await repo.listar(pag());
  const b = await repo.listar(pag());

  assert.deepEqual(a, b);
  assert.equal(base.llamadas.listar, 1);
});

test('cada combinación límite/offset/desde tiene su propia entrada', async () => {
  const base = repositorioFalso();
  const repo = crearCitaRepositoryConCache(base, { ttlMs: 1000 });

  await repo.listar(pag());
  await repo.listar(pag({ offset: 50 }));
  await repo.listar(pag({ desde: '2026-01-01T00:00:00.000Z' }));

  assert.equal(base.llamadas.listar, 3);
});

test('guardarSiLibre invalida el caché cuando inserta', async () => {
  const base = repositorioFalso({ id: 5 });
  const repo = crearCitaRepositoryConCache(base, { ttlMs: 1000 });

  await repo.listar(pag());
  assert.equal(await repo.guardarSiLibre({}), 5);
  await repo.listar(pag());

  assert.equal(base.llamadas.listar, 2);
});

test('guardarSiLibre no invalida el caché si el horario estaba ocupado', async () => {
  const base = repositorioFalso({ id: null });
  const repo = crearCitaRepositoryConCache(base, { ttlMs: 1000 });

  await repo.listar(pag());
  assert.equal(await repo.guardarSiLibre({}), null);
  await repo.listar(pag());

  assert.equal(base.llamadas.listar, 1);
});

test('con ttlMs 0 cada lectura va al repositorio', async () => {
  const base = repositorioFalso();
  const repo = crearCitaRepositoryConCache(base, { ttlMs: 0 });

  await repo.listar(pag());
  await repo.listar(pag());

  assert.equal(base.llamadas.listar, 2);
});

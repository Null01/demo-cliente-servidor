const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearCacheTTL } = require('../../src/infraestructura/cacheTTL');

// Reloj controlable: Date.now() devuelve el valor de `reloj.ahora`.
function relojFalso(t, inicio = 1000) {
  const reloj = { ahora: inicio };
  t.mock.method(Date, 'now', () => reloj.ahora);
  return reloj;
}

test('reutiliza el resultado mientras no venza el TTL', async (t) => {
  const reloj = relojFalso(t);
  const cache = crearCacheTTL({ ttlMs: 100 });
  let cargas = 0;
  const cargar = async () => ++cargas;

  assert.equal(await cache.obtener('k', cargar), 1);
  reloj.ahora += 99;
  assert.equal(await cache.obtener('k', cargar), 1);
  assert.equal(cargas, 1);
});

test('vuelve a cargar cuando vence el TTL', async (t) => {
  const reloj = relojFalso(t);
  const cache = crearCacheTTL({ ttlMs: 100 });
  let cargas = 0;
  const cargar = async () => ++cargas;

  await cache.obtener('k', cargar);
  reloj.ahora += 100;
  assert.equal(await cache.obtener('k', cargar), 2);
});

test('las peticiones simultáneas comparten una única carga', async () => {
  const cache = crearCacheTTL({ ttlMs: 1000 });
  let cargas = 0;
  const cargar = async () => ++cargas;

  const resultados = await Promise.all(Array.from({ length: 50 }, () => cache.obtener('k', cargar)));
  assert.equal(cargas, 1);
  assert.ok(resultados.every((r) => r === 1));
});

test('los fallos no quedan cacheados', async () => {
  const cache = crearCacheTTL({ ttlMs: 1000 });
  await assert.rejects(cache.obtener('k', async () => { throw new Error('boom'); }), /boom/);
  assert.equal(await cache.obtener('k', async () => 'ok'), 'ok');
});

test('con ttlMs <= 0 queda desactivada', async () => {
  const cache = crearCacheTTL({ ttlMs: 0 });
  let cargas = 0;
  await cache.obtener('k', async () => ++cargas);
  await cache.obtener('k', async () => ++cargas);
  assert.equal(cargas, 2);
});

test('invalidar descarta todo lo guardado', async () => {
  const cache = crearCacheTTL({ ttlMs: 1000 });
  let cargas = 0;
  await cache.obtener('k', async () => ++cargas);
  cache.invalidar();
  assert.equal(await cache.obtener('k', async () => ++cargas), 2);
});

test('acota la memoria descartando la entrada más antigua', async () => {
  const cache = crearCacheTTL({ ttlMs: 1000, maxEntradas: 2 });
  const cargas = { a: 0, b: 0, c: 0 };
  const cargar = (k) => async () => ++cargas[k];

  await cache.obtener('a', cargar('a'));
  await cache.obtener('b', cargar('b'));
  await cache.obtener('c', cargar('c')); // expulsa 'a'
  await cache.obtener('b', cargar('b')); // sigue en caché
  await cache.obtener('a', cargar('a')); // se vuelve a cargar
  assert.deepEqual(cargas, { a: 2, b: 1, c: 1 });
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ErrorDeNegocio } = require('../../src/dominio/errores');
const { normalizarPaginacion } = require('../../src/dominio/paginacion');

test('sin parámetros usa los valores por defecto', () => {
  assert.deepEqual(normalizarPaginacion(), { limite: 50, pagina: 1, offset: 0, desde: null });
});

test('calcula el offset a partir de límite y página', () => {
  const r = normalizarPaginacion({ limite: '10', pagina: '3' });
  assert.deepEqual([r.limite, r.pagina, r.offset], [10, 3, 20]);
});

test('el límite nunca supera el máximo y la página tiene tope', () => {
  assert.equal(normalizarPaginacion({ limite: '5000' }).limite, 100);
  assert.equal(normalizarPaginacion({ pagina: '999999' }).pagina, 10000);
});

test('valores inválidos o no positivos caen en el valor por defecto', () => {
  for (const valor of ['abc', '0', '-4', '']) {
    const r = normalizarPaginacion({ limite: valor, pagina: valor });
    assert.deepEqual([r.limite, r.pagina], [50, 1], `valor "${valor}"`);
  }
});

test('"desde" válido se normaliza a ISO', () => {
  assert.equal(normalizarPaginacion({ desde: '2026-03-01T10:00:00Z' }).desde, '2026-03-01T10:00:00.000Z');
});

test('"desde" ilegible lanza FECHA_INVALIDA', () => {
  assert.throws(
    () => normalizarPaginacion({ desde: 'ayer' }),
    (error) => error instanceof ErrorDeNegocio && error.codigo === 'FECHA_INVALIDA'
  );
});

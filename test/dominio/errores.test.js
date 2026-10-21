const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ErrorDeNegocio } = require('../../src/dominio/errores');

test('ErrorDeNegocio conserva el código y el mensaje', () => {
  const error = new ErrorDeNegocio('FECHA_PASADA', 'mensaje');
  assert.ok(error instanceof Error);
  assert.equal(error.codigo, 'FECHA_PASADA');
  assert.equal(error.message, 'mensaje');
});

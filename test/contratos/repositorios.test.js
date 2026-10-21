const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CONTRATOS, verificarContrato } = require('../../src/contratos/repositorios');

const completo = (nombre) => Object.fromEntries(CONTRATOS[nombre].map((m) => [m, () => {}]));

test('declara los métodos de cada contrato', () => {
  assert.deepEqual(CONTRATOS.CitaRepository, ['listar', 'guardarSiLibre']);
  assert.deepEqual(CONTRATOS.ProfesionalRepository, ['listarTodos']);
});

test('devuelve la misma implementación si cumple el contrato', () => {
  for (const nombre of Object.keys(CONTRATOS)) {
    const implementacion = completo(nombre);
    assert.equal(verificarContrato(nombre, implementacion), implementacion);
  }
});

test('falla indicando los métodos que faltan', () => {
  assert.throws(
    () => verificarContrato('CitaRepository', { listar() {} }),
    /CitaRepository incumple el contrato; faltan: guardarSiLibre/
  );
});

test('falla con undefined, null o miembros que no son funciones', () => {
  assert.throws(() => verificarContrato('ProfesionalRepository', undefined), /faltan: listarTodos/);
  assert.throws(() => verificarContrato('ProfesionalRepository', null), /faltan: listarTodos/);
  assert.throws(() => verificarContrato('ProfesionalRepository', { listarTodos: 1 }), /faltan: listarTodos/);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ErrorDeNegocio } = require('../../src/dominio/errores');
const {
  validarDatosCompletos,
  validarFechaFutura,
  validarAgendaLibre,
} = require('../../src/dominio/validacionCita');

const codigoDe = (fn) => {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof ErrorDeNegocio);
    return error.codigo;
  }
  return null;
};

test('validarDatosCompletos acepta una cita completa', () => {
  assert.equal(codigoDe(() => validarDatosCompletos({ paciente: 'Ana', profesional_id: 1, fecha_hora: 'x' })), null);
});

test('validarDatosCompletos rechaza cada campo faltante', () => {
  for (const faltante of ['paciente', 'profesional_id', 'fecha_hora']) {
    const datos = { paciente: 'Ana', profesional_id: 1, fecha_hora: 'x', [faltante]: undefined };
    assert.equal(codigoDe(() => validarDatosCompletos(datos)), 'DATOS_FALTANTES', faltante);
  }
});

test('validarFechaFutura acepta una fecha posterior a "ahora"', () => {
  const ahora = new Date('2026-01-01T10:00:00Z');
  assert.equal(codigoDe(() => validarFechaFutura('2026-01-01T10:00:01Z', ahora)), null);
});

test('validarFechaFutura rechaza fechas pasadas o iguales a "ahora"', () => {
  const ahora = new Date('2026-01-01T10:00:00Z');
  assert.equal(codigoDe(() => validarFechaFutura('2025-12-31T10:00:00Z', ahora)), 'FECHA_PASADA');
  assert.equal(codigoDe(() => validarFechaFutura('2026-01-01T10:00:00Z', ahora)), 'FECHA_PASADA');
});

test('validarFechaFutura rechaza fechas ilegibles', () => {
  assert.equal(codigoDe(() => validarFechaFutura('no-es-fecha')), 'FECHA_INVALIDA');
});

test('validarAgendaLibre solo falla si el horario está ocupado', () => {
  assert.equal(codigoDe(() => validarAgendaLibre(false)), null);
  assert.equal(codigoDe(() => validarAgendaLibre(true)), 'AGENDA_OCUPADA');
});

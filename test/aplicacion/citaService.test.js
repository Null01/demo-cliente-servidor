const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearCitaService } = require('../../src/aplicacion/citaService');
const { ErrorDeNegocio } = require('../../src/dominio/errores');

const FUTURO = '2999-01-01T10:00:00Z';

function repositorioFalso({ id = 7, citas = [{ id: 1 }], hayMas = false } = {}) {
  const llamadas = { listar: [], guardarSiLibre: [] };
  return {
    llamadas,
    listar: async (p) => { llamadas.listar.push(p); return { citas, hayMas }; },
    guardarSiLibre: async (c) => { llamadas.guardarSiLibre.push(c); return id; },
  };
}

test('exige que el repositorio cumpla el contrato', () => {
  assert.throws(() => crearCitaService({ citaRepository: {} }), /CitaRepository incumple/);
});

test('consultarCitas normaliza la paginación y la devuelve junto al resultado', async () => {
  const repo = repositorioFalso({ hayMas: true });
  const servicio = crearCitaService({ citaRepository: repo });

  const r = await servicio.consultarCitas({ limite: '10', pagina: '2' });

  assert.deepEqual(r, { citas: [{ id: 1 }], pagina: 2, limite: 10, hayMas: true });
  assert.deepEqual(repo.llamadas.listar[0], { limite: 10, pagina: 2, offset: 10, desde: null });
});

test('consultarCitas propaga el error de negocio por una fecha "desde" inválida', async () => {
  const servicio = crearCitaService({ citaRepository: repositorioFalso() });
  await assert.rejects(servicio.consultarCitas({ desde: 'x' }), (e) => e.codigo === 'FECHA_INVALIDA');
});

test('reservarCita guarda y devuelve solo el id (sin mensajes HTTP)', async () => {
  const repo = repositorioFalso({ id: 42 });
  const servicio = crearCitaService({ citaRepository: repo });
  const datos = { paciente: 'Ana', profesional_id: 1, fecha_hora: FUTURO };

  assert.deepEqual(await servicio.reservarCita(datos), { id: 42 });
  assert.deepEqual(repo.llamadas.guardarSiLibre, [datos]);
});

test('reservarCita no toca el repositorio si los datos son inválidos', async () => {
  const repo = repositorioFalso();
  const servicio = crearCitaService({ citaRepository: repo });

  await assert.rejects(servicio.reservarCita({}), (e) => e.codigo === 'DATOS_FALTANTES');
  await assert.rejects(
    servicio.reservarCita({ paciente: 'Ana', profesional_id: 1, fecha_hora: '2000-01-01T00:00:00Z' }),
    (e) => e.codigo === 'FECHA_PASADA'
  );
  assert.equal(repo.llamadas.guardarSiLibre.length, 0);
});

test('reservarCita lanza AGENDA_OCUPADA cuando el repositorio devuelve null', async () => {
  const servicio = crearCitaService({ citaRepository: repositorioFalso({ id: null }) });
  await assert.rejects(
    servicio.reservarCita({ paciente: 'Ana', profesional_id: 1, fecha_hora: FUTURO }),
    (e) => e instanceof ErrorDeNegocio && e.codigo === 'AGENDA_OCUPADA'
  );
});

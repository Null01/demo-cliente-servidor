// Reglas de negocio de la agenda.
// Este módulo no depende de Express ni de la base de datos, de modo que
// las reglas pueden probarse de forma aislada y sobreviven a cambios de
// framework o de motor de persistencia.

class ErrorDeNegocio extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}

function validarDatosCompletos({ paciente, profesional_id, fecha_hora }) {
  if (!paciente || !profesional_id || !fecha_hora) {
    throw new ErrorDeNegocio(
      'DATOS_FALTANTES',
      'Faltan datos: paciente, profesional y fecha son obligatorios'
    );
  }
}

function validarFechaFutura(fecha_hora, ahora = new Date()) {
  const fecha = new Date(fecha_hora);
  if (isNaN(fecha.getTime())) {
    throw new ErrorDeNegocio(
      'FECHA_INVALIDA',
      'Regla del servidor: la fecha enviada no es válida'
    );
  }
  if (fecha <= ahora) {
    throw new ErrorDeNegocio(
      'FECHA_PASADA',
      'Regla del servidor: no se pueden reservar citas en el pasado'
    );
  }
}

// Averiguar si el horario está ocupado es responsabilidad de la capa de
// persistencia; esta regla solo decide sobre el hecho ya consultado.
function validarAgendaLibre(horarioOcupado) {
  if (horarioOcupado) {
    throw new ErrorDeNegocio(
      'AGENDA_OCUPADA',
      'Regla del servidor: ese profesional ya tiene una cita a esa hora'
    );
  }
}

const LIMITE_POR_DEFECTO = 50;
const LIMITE_MAXIMO = 100;
const PAGINA_MAXIMA = 10000;

// Normaliza los parámetros de consulta del listado: valores ausentes o
// inválidos caen en el valor por defecto; el límite nunca supera el máximo.
// Solo una fecha "desde" ilegible es un error, porque cambiaría el resultado.
function normalizarPaginacion({ limite, pagina, desde } = {}) {
  const l = Number.parseInt(limite, 10);
  const p = Number.parseInt(pagina, 10);
  const limiteFinal = l > 0 ? Math.min(l, LIMITE_MAXIMO) : LIMITE_POR_DEFECTO;
  const paginaFinal = p > 0 ? Math.min(p, PAGINA_MAXIMA) : 1;

  let desdeFinal = null;
  if (desde) {
    const fecha = new Date(desde);
    if (isNaN(fecha.getTime())) {
      throw new ErrorDeNegocio(
        'FECHA_INVALIDA',
        'El parámetro "desde" no es una fecha válida'
      );
    }
    desdeFinal = fecha.toISOString();
  }

  return {
    limite: limiteFinal,
    pagina: paginaFinal,
    offset: (paginaFinal - 1) * limiteFinal,
    desde: desdeFinal,
  };
}

module.exports = {
  ErrorDeNegocio,
  normalizarPaginacion,
  validarDatosCompletos,
  validarFechaFutura,
  validarAgendaLibre,
};

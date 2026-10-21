// Reglas de paginación del listado. Sin dependencias de Express ni de la base.
const { ErrorDeNegocio } = require('./errores');

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

module.exports = { normalizarPaginacion };

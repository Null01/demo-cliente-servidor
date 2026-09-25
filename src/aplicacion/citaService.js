// Casos de uso de citas: coordinan las reglas del dominio y los repositorios.
const reglas = require('../dominio/reglasDeAgenda');
const citaRepository = require('../persistencia/citaRepository');
const profesionalRepository = require('../persistencia/profesionalRepository');

async function consultarCitas(parametros) {
  const paginacion = reglas.normalizarPaginacion(parametros);
  const { citas, hayMas } = await citaRepository.listar(paginacion);
  return { citas, pagina: paginacion.pagina, limite: paginacion.limite, hayMas };
}

// El catálogo casi no cambia: se guarda en memoria 60 s. Se cachea la promesa
// (no el resultado) para que peticiones simultáneas compartan una sola consulta.
const TTL_PROFESIONALES_MS = 60 * 1000;
let cacheProfesionales = null;

function consultarProfesionales() {
  const ahora = Date.now();
  if (!cacheProfesionales || ahora >= cacheProfesionales.expira) {
    const entrada = {
      expira: ahora + TTL_PROFESIONALES_MS,
      promesa: profesionalRepository.listarTodos().catch((error) => {
        if (cacheProfesionales === entrada) cacheProfesionales = null; // no cachear fallos
        throw error;
      }),
    };
    cacheProfesionales = entrada;
  }
  return cacheProfesionales.promesa;
}

async function reservarCita(datos) {
  reglas.validarDatosCompletos(datos);
  reglas.validarFechaFutura(datos.fecha_hora);

  const id = await citaRepository.guardarSiLibre(datos);
  reglas.validarAgendaLibre(id === null);

  return { mensaje: 'Cita creada', id };
}

module.exports = { consultarCitas, consultarProfesionales, reservarCita };

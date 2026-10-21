// Casos de uso de citas: coordinan las reglas del dominio y el repositorio.
// Depende del contrato CitaRepository, no de PostgreSQL ni de ningún caché:
// la implementación llega inyectada, así que aquí se pueden usar repositorios
// falsos en pruebas.
const validacion = require('../dominio/validacionCita');
const { normalizarPaginacion } = require('../dominio/paginacion');
const { verificarContrato } = require('../contratos/repositorios');

function crearCitaService({ citaRepository }) {
  verificarContrato('CitaRepository', citaRepository);

  async function consultarCitas(parametros) {
    const paginacion = normalizarPaginacion(parametros);
    const { citas, hayMas } = await citaRepository.listar(paginacion);
    return { citas, pagina: paginacion.pagina, limite: paginacion.limite, hayMas };
  }

  async function reservarCita(datos) {
    validacion.validarDatosCompletos(datos);
    validacion.validarFechaFutura(datos.fecha_hora);

    const id = await citaRepository.guardarSiLibre(datos);
    validacion.validarAgendaLibre(id === null);

    return { id };
  }

  return { consultarCitas, reservarCita };
}

module.exports = { crearCitaService };

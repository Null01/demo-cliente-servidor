// Casos de uso de citas: coordinan las reglas del dominio y los repositorios.
const reglas = require('../dominio/reglasDeAgenda');
const { crearCacheTTL } = require('./cacheTTL');
const citaRepository = require('../persistencia/citaRepository');
const profesionalRepository = require('../persistencia/profesionalRepository');

// Microcaché del listado: bajo carga, cientos de GET por segundo comparten una
// sola consulta cada pocos segundos. reservarCita lo invalida al insertar, así
// quien reserva ve su cita de inmediato. CACHE_CITAS_MS=0 lo desactiva.
const cacheCitas = crearCacheTTL({
  ttlMs: process.env.CACHE_CITAS_MS === undefined ? 3000 : Number(process.env.CACHE_CITAS_MS),
});

async function consultarCitas(parametros) {
  const paginacion = reglas.normalizarPaginacion(parametros);
  const clave = `${paginacion.limite}|${paginacion.pagina}|${paginacion.desde}`;
  return cacheCitas.obtener(clave, async () => {
    const { citas, hayMas } = await citaRepository.listar(paginacion);
    return { citas, pagina: paginacion.pagina, limite: paginacion.limite, hayMas };
  });
}

// El catálogo casi no cambia: se guarda en memoria 60 s.
const cacheProfesionales = crearCacheTTL({ ttlMs: 60 * 1000, maxEntradas: 1 });

function consultarProfesionales() {
  return cacheProfesionales.obtener('todos', () => profesionalRepository.listarTodos());
}

async function reservarCita(datos) {
  reglas.validarDatosCompletos(datos);
  reglas.validarFechaFutura(datos.fecha_hora);

  const id = await citaRepository.guardarSiLibre(datos);
  reglas.validarAgendaLibre(id === null);
  cacheCitas.invalidar();

  return { mensaje: 'Cita creada', id };
}

module.exports = { consultarCitas, consultarProfesionales, reservarCita };

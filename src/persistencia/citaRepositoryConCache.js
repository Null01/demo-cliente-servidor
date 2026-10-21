// Decorador de CitaRepository: añade un microcaché al listado sin que el
// servicio ni el repositorio de PostgreSQL lo sepan. Cumple el mismo contrato,
// así que se puede colocar o quitar en server.js sin tocar nada más.
//
// Bajo carga, cientos de GET por segundo comparten una sola consulta cada pocos
// segundos. guardarSiLibre invalida el caché al insertar, así quien reserva ve
// su cita de inmediato. ttlMs <= 0 lo desactiva (pasa directo al repositorio).
const { crearCacheTTL } = require('../infraestructura/cacheTTL');
const { verificarContrato } = require('../contratos/repositorios');

function crearCitaRepositoryConCache(citaRepository, { ttlMs = 3000 } = {}) {
  verificarContrato('CitaRepository', citaRepository);

  const cache = crearCacheTTL({ ttlMs });

  function listar(paginacion) {
    const clave = `${paginacion.limite}|${paginacion.offset}|${paginacion.desde}`;
    return cache.obtener(clave, () => citaRepository.listar(paginacion));
  }

  async function guardarSiLibre(cita) {
    const id = await citaRepository.guardarSiLibre(cita);
    if (id !== null) cache.invalidar(); // solo si se insertó una fila
    return id;
  }

  return verificarContrato('CitaRepository', { listar, guardarSiLibre });
}

module.exports = { crearCitaRepositoryConCache };

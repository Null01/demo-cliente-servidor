// Casos de uso del catálogo de profesionales. Depende solo del contrato
// ProfesionalRepository; la implementación llega inyectada.
const { crearCacheTTL } = require('../infraestructura/cacheTTL');
const { verificarContrato } = require('../contratos/repositorios');

function crearProfesionalService({ profesionalRepository }) {
  verificarContrato('ProfesionalRepository', profesionalRepository);

  // El catálogo casi no cambia: se guarda en memoria 60 s.
  const cacheProfesionales = crearCacheTTL({ ttlMs: 60 * 1000, maxEntradas: 1 });

  function consultarProfesionales() {
    return cacheProfesionales.obtener('todos', () => profesionalRepository.listarTodos());
  }

  return { consultarProfesionales };
}

module.exports = { crearProfesionalService };

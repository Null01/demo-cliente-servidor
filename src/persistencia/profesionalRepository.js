// Adaptador PostgreSQL del contrato ProfesionalRepository.
const { verificarContrato } = require('../contratos/repositorios');

function crearProfesionalRepository(pool) {
  async function listarTodos() {
    const resultado = await pool.query(
      'SELECT id, nombre, especialidad FROM profesionales ORDER BY nombre'
    );
    return resultado.rows;
  }

  return verificarContrato('ProfesionalRepository', { listarTodos });
}

module.exports = { crearProfesionalRepository };

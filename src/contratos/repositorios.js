// Contrato de repositorios: las operaciones de base de datos que la capa de
// aplicación puede pedir. JavaScript no tiene interfaces, así que el contrato
// se declara como la lista de métodos esperados y se verifica al ensamblar:
// si una implementación no los cumple, el servidor falla al arrancar.
//
// CitaRepository
//   listar({ limite, offset, desde })      → { citas, hayMas }
//   guardarSiLibre({ paciente, profesional_id, fecha_hora }) → id | null
// ProfesionalRepository
//   listarTodos()                          → [{ id, nombre, especialidad }]
const CONTRATOS = {
  CitaRepository: ['listar', 'guardarSiLibre'],
  ProfesionalRepository: ['listarTodos'],
};

function verificarContrato(nombre, implementacion) {
  const faltantes = CONTRATOS[nombre].filter(
    (metodo) => typeof implementacion?.[metodo] !== 'function'
  );
  if (faltantes.length > 0) {
    throw new Error(`${nombre} incumple el contrato; faltan: ${faltantes.join(', ')}`);
  }
  return implementacion;
}

module.exports = { CONTRATOS, verificarContrato };

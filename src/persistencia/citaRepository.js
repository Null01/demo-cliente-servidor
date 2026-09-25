// Acceso a datos de citas. Todo el SQL de la tabla citas vive en este módulo.
const pool = require('./db');

async function listarTodas() {
  const resultado = await pool.query(
    `SELECT c.id, c.paciente, c.fecha_hora, p.nombre AS profesional
       FROM citas c
       JOIN profesionales p ON p.id = c.profesional_id
      ORDER BY c.fecha_hora`
  );
  return resultado.rows;
}

// Inserta la cita solo si el horario está libre, en una única consulta.
// La restricción UNIQUE (profesional_id, fecha_hora) hace atómica la
// verificación: dos peticiones simultáneas no pueden duplicar la cita.
// Devuelve el id nuevo, o null si el horario ya estaba ocupado.
async function guardarSiLibre({ paciente, profesional_id, fecha_hora }) {
  const resultado = await pool.query(
    `INSERT INTO citas (paciente, profesional_id, fecha_hora)
     VALUES ($1, $2, $3)
     ON CONFLICT (profesional_id, fecha_hora) DO NOTHING
     RETURNING id`,
    [paciente, profesional_id, fecha_hora]
  );
  return resultado.rows.length > 0 ? resultado.rows[0].id : null;
}

module.exports = { listarTodas, guardarSiLibre };

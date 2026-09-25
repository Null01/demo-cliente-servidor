-- Datos por defecto de la demo de reserva de citas.
-- Se ejecuta DESPUÉS de db/setup.sql (o de las migraciones si la base ya existía).
--
-- ATENCIÓN: vacía las tablas antes de cargar (TRUNCATE) para poder
-- re-ejecutarse y dejar siempre el mismo estado inicial. No lo corras en una
-- base con citas reales que quieras conservar.
-- Las fechas son relativas a hoy, así que las citas siempre quedan a futuro.

BEGIN;

TRUNCATE citas, profesionales RESTART IDENTITY;

INSERT INTO profesionales (nombre, especialidad) VALUES
  ('Dra. Laura Pérez',   'Medicina general'),
  ('Dr. Andrés Rojas',   'Odontología'),
  ('Dra. Camila Torres', 'Fisioterapia'),
  ('Dr. Felipe Gómez',   'Pediatría'),
  ('Dra. Sofía Ramírez', 'Psicología');

-- El profesional se busca por nombre (no por id) para no depender del orden
-- de inserción. Cada profesional tiene horas distintas: respeta el UNIQUE.
INSERT INTO citas (paciente, profesional_id, fecha_hora)
SELECT v.paciente, p.id, date_trunc('day', now()) + v.cuando
  FROM (VALUES
    ('Carlos Muñoz',    'Dra. Laura Pérez',   INTERVAL '1 day 9 hours'),
    ('María Salazar',   'Dr. Andrés Rojas',   INTERVAL '2 days 10 hours'),
    ('Juan Herrera',    'Dra. Laura Pérez',   INTERVAL '1 day 10 hours 30 minutes'),
    ('Ana Beltrán',     'Dra. Camila Torres', INTERVAL '3 days 8 hours'),
    ('Luis Ortega',     'Dr. Felipe Gómez',   INTERVAL '2 days 15 hours'),
    ('Paula Castillo',  'Dra. Sofía Ramírez', INTERVAL '4 days 11 hours'),
    ('Diego Ramírez',   'Dr. Andrés Rojas',   INTERVAL '5 days 14 hours'),
    ('Valentina Cruz',  'Dra. Camila Torres', INTERVAL '6 days 9 hours 30 minutes')
  ) AS v(paciente, profesional, cuando)
  JOIN profesionales p ON p.nombre = v.profesional;

COMMIT;

-- Verificación: debe devolver 5 profesionales y 8 citas.
SELECT (SELECT count(*) FROM profesionales) AS profesionales,
       (SELECT count(*) FROM citas)         AS citas;

SELECT c.id, c.paciente, p.nombre AS profesional, c.fecha_hora
  FROM citas c JOIN profesionales p ON p.id = c.profesional_id
 ORDER BY c.fecha_hora, c.id;

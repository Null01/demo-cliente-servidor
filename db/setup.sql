-- Esquema y datos semilla de la demo de reserva de citas.
-- Se ejecuta completo en el SQL Editor de Supabase; es re-ejecutable
-- (elimina y vuelve a crear las tablas). Va en una transacción: o queda
-- todo el esquema, o no cambia nada.

BEGIN;

DROP TABLE IF EXISTS citas;
DROP TABLE IF EXISTS profesionales;

CREATE TABLE profesionales (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre       TEXT NOT NULL,
  especialidad TEXT NOT NULL
);

CREATE TABLE citas (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paciente        TEXT NOT NULL,
  profesional_id  INTEGER NOT NULL REFERENCES profesionales(id),
  fecha_hora      TIMESTAMPTZ NOT NULL,
  creada_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Un profesional no puede tener dos citas a la misma hora; además
  -- crea el índice que usa el INSERT ... ON CONFLICT del repositorio.
  CONSTRAINT citas_profesional_hora_uq UNIQUE (profesional_id, fecha_hora)
);

-- Sirve el ORDER BY (fecha_hora, id) del listado paginado y el filtro "desde".
CREATE INDEX citas_fecha_hora_id_idx ON citas (fecha_hora, id);

INSERT INTO profesionales (nombre, especialidad) VALUES
  ('Dra. Laura Pérez',  'Medicina general'),
  ('Dr. Andrés Rojas',  'Odontología'),
  ('Dra. Camila Torres','Fisioterapia');

INSERT INTO citas (paciente, profesional_id, fecha_hora) VALUES
  ('Carlos Muñoz', 1, now() + interval '1 day'),
  ('María Salazar', 2, now() + interval '2 days');

COMMIT;

-- Verificación: debe devolver las dos citas de ejemplo.
SELECT c.id, c.paciente, p.nombre AS profesional, c.fecha_hora
  FROM citas c JOIN profesionales p ON p.id = c.profesional_id;

-- Esquema de la demo de reserva de citas (sin datos: ver db/seed.sql).
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

COMMIT;

-- Verificación: deben existir ambas tablas, vacías. Los datos por defecto
-- se cargan con db/seed.sql.
SELECT (SELECT count(*) FROM profesionales) AS profesionales,
       (SELECT count(*) FROM citas)         AS citas;

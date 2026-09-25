-- Migración para bases ya creadas (no borra datos). Idempotente.
-- Índice que sirve el ORDER BY (fecha_hora, id) del listado paginado y
-- el filtro "desde": Postgres lee solo las filas de la página pedida.

CREATE INDEX IF NOT EXISTS citas_fecha_hora_id_idx ON citas (fecha_hora, id);

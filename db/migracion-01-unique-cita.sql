-- Migración para bases ya creadas (no borra datos).
-- Añade la restricción que hace atómica la reserva de un horario.
-- Si falla por duplicados existentes, elimínalos primero:
--   SELECT profesional_id, fecha_hora, count(*) FROM citas
--    GROUP BY 1,2 HAVING count(*) > 1;

ALTER TABLE citas
  ADD CONSTRAINT citas_profesional_hora_uq UNIQUE (profesional_id, fecha_hora);

-- Metadatos de mockup (posición, escala, material) por archivo adjunto.
-- MySQL 8 no soporta ADD COLUMN IF NOT EXISTS: ejecuta el script una sola vez.
-- La versión idempotente es migrations/mockup_data_archivos.py.
ALTER TABLE solicitud_archivos
  ADD COLUMN mockup_data JSON NULL;

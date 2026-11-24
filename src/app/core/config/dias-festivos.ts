/**
 * Días de cierre de operaciones para entregas.
 *
 * Mantener sincronizado con `Flask_Llamma_API/config.py -> DIAS_FESTIVOS`.
 * Los fines de semana se descartan aparte, sin necesidad de listarlos.
 */
export const DIAS_FESTIVOS = new Set<string>([
  // 2026
  '2026-01-01',
  '2026-02-02',
  '2026-03-16',
  '2026-05-01',
  '2026-09-16',
  '2026-11-16',
  '2026-12-24',
  '2026-12-25',
  // 2027
  '2027-01-01',
  '2027-02-01',
  '2027-03-15',
  '2027-05-01',
  '2027-09-16',
  '2027-11-15',
  '2027-12-24',
  '2027-12-25',
]);

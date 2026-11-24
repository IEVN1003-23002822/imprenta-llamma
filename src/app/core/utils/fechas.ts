import { DIAS_FESTIVOS } from '../config/dias-festivos';

const FORMATO_ISO = /^\d{4}-\d{2}-\d{2}$/;

export const MENSAJE_FECHA_MINIMA =
  'La fecha de entrega solicitada no es válida. El margen mínimo es de 2 días hábiles.';

/** Formatea una fecha local como YYYY-MM-DD, sin pasar por UTC. */
export function aFechaIso(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** Suma días hábiles saltando sábados, domingos y festivos. */
export function sumarDiasHabiles(
  fechaBase: Date,
  diasHabiles = 2,
  festivos: ReadonlySet<string> = DIAS_FESTIVOS,
): Date {
  const actual = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), fechaBase.getDate());
  if (diasHabiles <= 0) return actual;

  let contados = 0;
  while (contados < diasHabiles) {
    actual.setDate(actual.getDate() + 1);
    if (actual.getDay() === 0 || actual.getDay() === 6) continue;
    if (festivos.has(aFechaIso(actual))) continue;
    contados += 1;
  }
  return actual;
}

/** Fecha mínima de entrega en formato YYYY-MM-DD. */
export function calcularFechaMinimaEntrega(
  fechaBase: Date = new Date(),
  diasHabiles = 2,
  festivos: ReadonlySet<string> = DIAS_FESTIVOS,
): string {
  return aFechaIso(sumarDiasHabiles(fechaBase, diasHabiles, festivos));
}

/** Una fecha vacía es válida; una fecha con formato incorrecto no lo es. */
export function esFechaEntregaValida(
  valor: string | null | undefined,
  fechaBase: Date = new Date(),
  diasHabiles = 2,
  festivos: ReadonlySet<string> = DIAS_FESTIVOS,
): boolean {
  if (!valor) return true;
  if (!FORMATO_ISO.test(valor)) return false;
  return valor >= calcularFechaMinimaEntrega(fechaBase, diasHabiles, festivos);
}

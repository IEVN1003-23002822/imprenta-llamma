import { describe, expect, it } from 'vitest';

import { calcularFechaMinimaEntrega, esFechaEntregaValida } from './fechas';

const FESTIVOS = new Set([
  '2026-01-01',
  '2026-02-02',
  '2026-03-16',
  '2026-05-01',
  '2026-09-16',
  '2026-11-16',
  '2026-12-24',
  '2026-12-25',
]);

describe('cálculo de días hábiles para entrega', () => {
  it('suma dos días hábiles desde un lunes', () => {
    const base = new Date(2026, 10, 23);
    expect(calcularFechaMinimaEntrega(base, 2, FESTIVOS)).toBe('2026-11-25');
  });

  it('salta el fin de semana desde un viernes', () => {
    const base = new Date(2026, 10, 27);
    expect(calcularFechaMinimaEntrega(base, 2, FESTIVOS)).toBe('2026-12-01');
  });

  it('salta Navidad y el fin de semana', () => {
    const base = new Date(2026, 11, 23);
    expect(calcularFechaMinimaEntrega(base, 2, FESTIVOS)).toBe('2026-12-29');
  });

  it('salta un festivo antes de contar el primer día', () => {
    const base = new Date(2026, 4, 1);
    expect(calcularFechaMinimaEntrega(base, 1, FESTIVOS)).toBe('2026-05-04');
  });

  it('rechaza fechas anteriores al mínimo y acepta el mínimo', () => {
    const base = new Date(2026, 10, 23);
    expect(esFechaEntregaValida('2026-11-24', base, 2, FESTIVOS)).toBe(false);
    expect(esFechaEntregaValida('2026-11-25', base, 2, FESTIVOS)).toBe(true);
    expect(esFechaEntregaValida('', base, 2, FESTIVOS)).toBe(true);
  });
});

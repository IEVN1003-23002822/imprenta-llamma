import { expect, type Page } from '@playwright/test';

export interface ConsolaGuard {
  errores: string[];
  ignorar: (...patrones: RegExp[]) => void;
  assertLimpia: () => void;
}

/**
 * Captura errores de consola y de página. Se debe crear antes de navegar.
 * Los 401/429 esperados (login fallido, rate limit) se ignoran explícitamente.
 */
export function vigilarConsola(page: Page): ConsolaGuard {
  const errores: string[] = [];
  const exclusiones: RegExp[] = [];

  page.on('console', (mensaje) => {
    if (mensaje.type() !== 'error') return;
    const texto = mensaje.text();
    if (exclusiones.some((patron) => patron.test(texto))) return;
    errores.push(`console.error: ${texto}`);
  });
  page.on('pageerror', (error) => errores.push(`pageerror: ${error.message}`));

  return {
    errores,
    ignorar: (...patrones) => exclusiones.push(...patrones),
    assertLimpia: () => {
      expect(errores, `Errores de consola:\n${errores.join('\n')}`).toEqual([]);
    },
  };
}

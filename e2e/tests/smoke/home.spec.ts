import { test, expect } from '../../fixtures/auth.fixture';
import { HomePage } from '../../page-objects/HomePage';
import { vigilarConsola } from '../../helpers/assert-consola';

test.describe('Portada pública', () => {
  test('carga con secciones y consola limpia', async ({ page }) => {
    const consola = vigilarConsola(page);
    const home = new HomePage(page);
    await home.goto();
    await home.expectCargada();
    await expect(page.locator('main#contenido h1')).toContainText(/imprimimos|ideas/i);
    consola.assertLimpia();
  });

  test('LCP bajo 2.5 s con el servidor caliente', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.reload({ waitUntil: 'networkidle' });
    const lcp = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const observador = new PerformanceObserver((lista) => {
            const entradas = lista.getEntries();
            if (entradas.length) {
              observador.disconnect();
              resolve(entradas[entradas.length - 1].startTime);
            }
          });
          observador.observe({ type: 'largest-contentful-paint', buffered: true });
          window.setTimeout(() => {
            observador.disconnect();
            resolve(0);
          }, 3000);
        }),
    );
    expect(lcp, `LCP medido: ${lcp} ms`).toBeGreaterThan(0);
    expect(lcp).toBeLessThan(2500);
  });
});

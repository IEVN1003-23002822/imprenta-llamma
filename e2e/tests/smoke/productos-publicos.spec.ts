import { test, expect } from '../../fixtures/auth.fixture';
import { vigilarConsola } from '../../helpers/assert-consola';

test.describe('Catálogo público', () => {
  test('lista productos activos y carga sus imágenes', async ({ page }) => {
    const consola = vigilarConsola(page);
    const fallos: string[] = [];
    page.on('response', (respuesta) => {
      if (respuesta.status() >= 400) {
        fallos.push(`${respuesta.status()} ${respuesta.url()}`);
      }
    });

    await page.goto('/productos');
    const tarjetas = page.locator('article');
    await expect(tarjetas.first()).toBeVisible();
    expect(await tarjetas.count()).toBeGreaterThan(0);

    const imagenes = page.locator('article img');
    expect(await imagenes.count()).toBeGreaterThan(0);
    await expect(imagenes.first()).toBeVisible();
    // La primera imagen es el LCP: debe cargarse con prioridad, no en lazy.
    await expect(imagenes.first()).toHaveAttribute('loading', 'eager');
    await expect(imagenes.first()).toHaveAttribute('fetchpriority', 'high');

    // Espera a que las imágenes lazy entren al viewport.
    await page.locator('article').last().scrollIntoViewIfNeeded();
    await page.waitForLoadState('networkidle');

    expect(fallos, `Recursos 404:\n${fallos.join('\n')}`).toEqual([]);
    consola.assertLimpia();
  });
});

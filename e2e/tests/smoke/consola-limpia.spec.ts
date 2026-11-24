import { test } from '../../fixtures/auth.fixture';
import { vigilarConsola } from '../../helpers/assert-consola';

const RUTAS = ['/', '/productos', '/cotizar', '/login', '/seguimiento'];

test.describe('Consola limpia', () => {
  test('rutas públicas sin errores de consola ni de página', async ({ page }) => {
    const consola = vigilarConsola(page);
    for (const ruta of RUTAS) {
      await page.goto(ruta);
      await page.waitForLoadState('networkidle');
    }
    consola.assertLimpia();
  });
});

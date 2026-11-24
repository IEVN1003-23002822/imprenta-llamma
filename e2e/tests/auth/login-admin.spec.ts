import { test, expect } from '../../fixtures/auth.fixture';
import { LoginPage } from '../../page-objects/LoginPage';
import { vigilarConsola } from '../../helpers/assert-consola';
import { abrirNavegacionSiHaceFalta } from '../../helpers/navegacion';

test.describe('Login administrador', () => {
  test('inicia sesión por UI y muestra el panel', async ({ page }) => {
    const consola = vigilarConsola(page);
    const login = new LoginPage(page);
    await login.goto();
    await login.login('ana@llamma.mx', 'llamma2026');
    await login.expectDashboard();

    const sesion = await page.evaluate(() => localStorage.getItem('llamma.session.v1'));
    expect(sesion).not.toBeNull();
    expect(JSON.parse(sesion!).usuario.correo).toBe('ana@llamma.mx');

    await abrirNavegacionSiHaceFalta(page);
    await page.getByRole('button', { name: 'Módulos' }).click();
    await expect(page.getByRole('link', { name: /Inventario/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Producción/i }).first()).toBeVisible();
    consola.assertLimpia();
  });
});

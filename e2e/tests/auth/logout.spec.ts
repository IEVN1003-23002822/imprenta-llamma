import { test, expect } from '../../fixtures/auth.fixture';
import { LoginPage } from '../../page-objects/LoginPage';
import { abrirNavegacionSiHaceFalta } from '../../helpers/navegacion';

test.describe('Logout', () => {
  test('cierra la sesión y protege el dashboard', async ({ page }) => {
    // Login propio: si se usara el storageState compartido, revocaría la
    // sesión que necesitan el resto de pruebas de la suite.
    const login = new LoginPage(page);
    await login.goto();
    await login.login('ana@llamma.mx', 'llamma2026');
    await login.expectDashboard();

    await abrirNavegacionSiHaceFalta(page);
    await page.getByRole('button', { name: 'Salir' }).click();
    // La app vuelve a la portada pública tras cerrar sesión.
    await expect(page).toHaveURL(/\/(login)?$/);

    const sesion = await page.evaluate(() => localStorage.getItem('llamma.session.v1'));
    expect(sesion).toBeNull();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });
});

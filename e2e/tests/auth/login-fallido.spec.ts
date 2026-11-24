import { test, expect } from '../../fixtures/auth.fixture';
import { correoUnico } from '../../helpers/datos';
import { vigilarConsola } from '../../helpers/assert-consola';
import { LoginPage } from '../../page-objects/LoginPage';

test.describe('Login fallido', () => {
  test.use({ rol: 'anonimo' });

  test('contraseña incorrecta y correo inexistente dan el mismo mensaje', async ({ page }) => {
    const consola = vigilarConsola(page);
    consola.ignorar(/401|Failed to load resource/i);
    const login = new LoginPage(page);

    await login.goto();
    await login.login('ana@llamma.mx', 'password-que-no-es');
    await login.expectError(/Credenciales incorrectas/i);
    await login.expectSinSesion();
    const mensajePassword = await page.getByRole('alert').innerText();

    await login.goto();
    await login.login(correoUnico('fantasma'), 'llamma2026');
    await login.expectError(/Credenciales incorrectas/i);
    await login.expectSinSesion();
    const mensajeCorreo = await page.getByRole('alert').innerText();

    expect(mensajeCorreo).toBe(mensajePassword);
    await expect(page).toHaveURL(/\/login$/);
    consola.assertLimpia();
  });
});

import { test, expect } from '../../fixtures/auth.fixture';
import { correoUnico } from '../../helpers/datos';
import { abrirNavegacionSiHaceFalta } from '../../helpers/navegacion';
import { userFactory } from '../../factories/user.factory';
import { LoginPage } from '../../page-objects/LoginPage';
import { UsuariosPage } from '../../page-objects/UsuariosPage';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4300';

test.describe('Alta de usuario â†’ login â†’ logout', () => {
  test.use({ rol: 'admin' });

  test('el usuario creado inicia sesiÃ³n y el logout limpia la sesiÃ³n', async ({
    page,
    browser,
  }) => {
    const usuario = userFactory.valido({
      rol: 'ventas',
      correo: correoUnico('nuevo'),
    });

    const usuarios = new UsuariosPage(page);
    await usuarios.goto();
    await usuarios.llenar({ ...usuario, rol: 'ventas' });
    await usuarios.crear();
    await usuarios.expectUsuario(usuario.correo, 'Ventas');

    const contexto = await browser.newContext({
      baseURL: BASE_URL,
      storageState: { cookies: [], origins: [] },
    });
    try {
      const nueva = await contexto.newPage();
      const login = new LoginPage(nueva);

      await login.goto();
      await login.login(usuario.correo, usuario.password, true);
      await login.expectDashboard();

      expect(await nueva.evaluate(() => localStorage.getItem('llamma.session.v1'))).toBeTruthy();

      await abrirNavegacionSiHaceFalta(nueva);
      await nueva.getByRole('button', { name: 'Salir' }).click();
      await expect(nueva).toHaveURL(/\/$/, { timeout: 10_000 });

      const sesion = await nueva.evaluate(() => ({
        local: localStorage.getItem('llamma.session.v1'),
        temporal: sessionStorage.getItem('llamma.session.v1'),
      }));
      expect(sesion.local).toBeNull();
      expect(sesion.temporal).toBeNull();

      // El guard debe volver a pedir credenciales tras cerrar sesiÃ³n.
      await nueva.goto('/dashboard');
      await expect(nueva).toHaveURL(/\/login/);
      await expect(nueva.locator('#authEmail')).toBeVisible();
    } finally {
      await contexto.close();
    }
  });

  test('rechaza credenciales del usuario reciÃ©n creado si la contraseÃ±a es incorrecta', async ({
    page,
    browser,
  }) => {
    const usuario = userFactory.valido({ correo: correoUnico('fallo') });
    const usuarios = new UsuariosPage(page);
    await usuarios.goto();
    await usuarios.llenar({ ...usuario, rol: 'ventas' });
    await usuarios.crear();

    const contexto = await browser.newContext({
      baseURL: BASE_URL,
      storageState: { cookies: [], origins: [] },
    });
    try {
      const nueva = await contexto.newPage();
      const login = new LoginPage(nueva);
      await login.goto();
      await login.login(usuario.correo, 'PasswordIncorrecta999!', false);
      await login.expectError(/Credenciales incorrectas/i);
      await expect(nueva.locator('#authPassword')).toHaveAttribute('aria-invalid', 'true');
    } finally {
      await contexto.close();
    }
  });
});

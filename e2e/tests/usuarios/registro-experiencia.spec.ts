import { test, expect } from '../../fixtures/auth.fixture';
import { correoUnico, unico } from '../../helpers/datos';
import { userFactory } from '../../factories/user.factory';
import { UsuariosPage } from '../../page-objects/UsuariosPage';

function contarAltas(page: import('@playwright/test').Page): string[] {
  const peticiones: string[] = [];
  page.on('request', (peticion) => {
    if (peticion.method() === 'POST' && new URL(peticion.url()).pathname === '/api/usuarios') {
      peticiones.push(peticion.url());
    }
  });
  return peticiones;
}

test.describe('Alta de usuario — robustez del formulario', () => {
  test.use({ rol: 'admin' });

  test('un doble envío solo crea una cuenta', async ({ page }) => {
    const usuarios = new UsuariosPage(page);
    const usuario = userFactory.valido({ correo: correoUnico('doble') });
    const altas = contarAltas(page);

    await usuarios.goto();
    await usuarios.llenar({ ...usuario, rol: 'ventas' });

    const boton = page.locator('#formularioUsuario button[type="submit"]');
    // Dos clics seguidos: el segundo debe rebotar por el estado de guardado.
    await boton.dispatchEvent('click');
    await boton.dispatchEvent('click');

    await usuarios.expectUsuario(usuario.correo, 'Ventas');
    expect(altas).toHaveLength(1);
    await expect(usuarios.fila(usuario.correo)).toHaveCount(1);
  });

  test('Enter envía una sola vez y limpia el formulario', async ({ page }) => {
    const usuarios = new UsuariosPage(page);
    const usuario = userFactory.valido({ correo: correoUnico('enter') });
    const altas = contarAltas(page);

    await usuarios.goto();
    await usuarios.llenar({ ...usuario, rol: 'ventas' });
    await page.locator('#usuarioPassword').press('Enter');

    await usuarios.expectUsuario(usuario.correo, 'Ventas');
    expect(altas).toHaveLength(1);
    await expect(page.locator('#usuarioNombre')).toHaveValue('');
    await expect(page.locator('#usuarioCorreo')).toHaveValue('');
  });

  test('el alta sobrevive a una recarga y el borrado de URL no la pierde', async ({ page }) => {
    const usuarios = new UsuariosPage(page);
    const usuario = userFactory.valido({ correo: correoUnico('recarga') });

    await usuarios.goto();
    await usuarios.llenar({ ...usuario, rol: 'produccion' });
    await usuarios.crear();
    await usuarios.expectUsuario(usuario.correo, 'Produccion');

    await page.reload();
    await usuarios.expectUsuario(usuario.correo, 'Produccion');

    await page.goto('/dashboard');
    await page.goBack();
    await usuarios.expectUsuario(usuario.correo, 'Produccion');
  });

  test('valida correo mal formado y campos vacíos en el cliente', async ({ page }) => {
    const usuarios = new UsuariosPage(page);
    const altas = contarAltas(page);

    await usuarios.goto();
    await page.locator('#usuarioCorreo').fill('no-es-correo');
    await usuarios.intentarCrearSinPeticion();

    await expect(page.getByText(/Ingresa un correo válido/i)).toBeVisible();
    await expect(page.getByText(/Indica al menos dos caracteres/i)).toBeVisible();
    await expect(page.locator('#usuarioCorreo')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#usuarioNombre')).toBeFocused();
    expect(altas).toEqual([]);

    await page.locator('#usuarioNombre').fill('   ');
    await page.locator('#usuarioCorreo').fill(correoUnico('espacios'));
    await usuarios.intentarCrearSinPeticion();
    await expect(page.getByText(/Indica al menos dos caracteres/i)).toBeVisible();
    await expect(page.locator('#usuarioNombre')).toHaveValue('');
    await expect(page.locator('#usuarioNombre')).toBeFocused();
    expect(altas).toEqual([]);

    await page.locator('#usuarioNombre').fill(`Usuario ${unico('e2e')}`);
    await page.locator('#usuarioCorreo').fill(correoUnico('valido'));
    await page.locator('#usuarioPassword').fill('1234567');
    await usuarios.intentarCrearSinPeticion();
    await expect(page.locator('#usuarioPasswordError')).toContainText(
      /La contraseña debe tener al menos 8 caracteres/i,
    );
    await expect(page.locator('#usuarioPassword')).toBeFocused();
    expect(altas).toEqual([]);
  });

  test('el formulario no desborda la pantalla', async ({ page }) => {
    const usuarios = new UsuariosPage(page);
    await usuarios.goto();

    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(desborda).toBe(false);
    await expect(page.locator('#formularioUsuario')).toBeVisible();
  });

  test('un fallo 5xx muestra un mensaje claro y permite reintentar', async ({ page }) => {
    const usuarios = new UsuariosPage(page);
    const usuario = userFactory.valido({ correo: correoUnico('reintento') });

    await page.route('**/api/usuarios', async (ruta) => {
      if (ruta.request().method() === 'POST') {
        await ruta.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'fallo simulado' }),
        });
        return;
      }
      await ruta.continue();
    });

    await usuarios.goto();
    await usuarios.llenar({ ...usuario, rol: 'ventas' });
    await page.getByRole('button', { name: /Crear usuario/i }).click();

    await expect(page.locator('#formularioUsuario').getByRole('alert')).toContainText(
      /problema temporal/i,
    );
    await expect(page.getByRole('button', { name: /Crear usuario/i })).toBeEnabled();
    await expect(page.locator('#usuarioCorreo')).toHaveValue(usuario.correo);

    await page.unroute('**/api/usuarios');
    await usuarios.crear();
    await usuarios.expectUsuario(usuario.correo, 'Ventas');
  });
});

import { request } from '@playwright/test';

import { test, expect } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import { API_URL } from '../../helpers/api-setup';
import { correoUnico, unico } from '../../helpers/datos';
import { abrirNavegacionSiHaceFalta } from '../../helpers/navegacion';
import { userFactory } from '../../factories/user.factory';
import { UsuariosPage } from '../../page-objects/UsuariosPage';

test.describe('Usuarios — alta desde la UI', () => {
  test.use({ rol: 'admin' });

  test('crea un usuario, lo lista y no expone la contraseña', async ({ page }) => {
    const usuarios = new UsuariosPage(page);
    const usuario = userFactory.valido({ rol: 'ventas' });

    await usuarios.goto();
    await usuarios.llenar({
      nombre: usuario.nombre,
      correo: usuario.correo,
      password: usuario.password,
      rol: 'ventas',
    });
    const creado = await usuarios.crear();

    expect(creado.correo).toBe(usuario.correo);
    await usuarios.expectUsuario(usuario.correo, 'Ventas');
    await expect(page.locator('main#contenido')).not.toContainText(usuario.password);

    const api = await request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${tokenDe('admin')}` },
    });
    const lista = await api.get('/api/usuarios');
    expect(lista.status()).toBe(200);
    const datos = await lista.json();
    expect(datos.items.some((item: { correo: string }) => item.correo === usuario.correo)).toBe(
      true,
    );
    await api.dispose();
  });

  test('muestra el error 409 al repetir el correo', async ({ page }) => {
    const api = await request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${tokenDe('admin')}` },
    });
    const usuario = userFactory.valido();
    expect((await api.post('/api/usuarios', { data: usuario })).status()).toBe(201);
    await api.dispose();

    const usuarios = new UsuariosPage(page);
    await usuarios.goto();
    await usuarios.llenar({
      nombre: `Otro ${unico('e2e')}`,
      correo: usuario.correo,
      password: 'PasswordSeguro123!',
    });
    await usuarios.crear(409);

    await usuarios.expectError(/Ya existe un usuario con ese correo/i);
    await expect(usuarios.fila(usuario.correo)).toHaveCount(1);
  });

  test('valida la contraseña corta sin llamar a la API', async ({ page }) => {
    const usuarios = new UsuariosPage(page);
    const peticiones: string[] = [];
    page.on('request', (peticion) => {
      if (peticion.method() === 'POST' && new URL(peticion.url()).pathname === '/api/usuarios') {
        peticiones.push(peticion.url());
      }
    });

    await usuarios.goto();
    await usuarios.llenar({
      nombre: `Usuario ${unico('e2e')}`,
      correo: correoUnico('corta'),
      password: '1234567',
    });
    await usuarios.intentarCrearSinPeticion();

    await expect(
      page.getByText(/La contraseña debe tener al menos 8 caracteres/i).first(),
    ).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/Revisa los campos/i);
    expect(peticiones).toEqual([]);
  });

  test('muestra un indicador de fuerza de la contraseña', async ({ page }) => {
    const usuarios = new UsuariosPage(page);
    await usuarios.goto();
    await usuarios.llenar({
      nombre: `Usuario ${unico('e2e')}`,
      correo: correoUnico('fuerza'),
      password: 'abc',
    });
    await expect(page.getByText(/Seguridad: Muy débil|Seguridad: Débil/i)).toBeVisible();

    await page.locator('#usuarioPassword').fill('PasswordSeguro123!');
    await expect(page.getByText(/Seguridad: Fuerte|Seguridad: Muy fuerte/i)).toBeVisible();
  });

  test('el menú de admin muestra Usuarios y el select tiene los roles', async ({ page }) => {
    const usuarios = new UsuariosPage(page);
    await usuarios.goto();

    const roles = await usuarios.opcionesRol();
    expect(roles.join(' ')).toMatch(/Admin/i);
    expect(roles.join(' ')).toMatch(/Ventas/i);
    expect(roles.join(' ')).toMatch(/Marketing/i);

    await abrirNavegacionSiHaceFalta(page);
    await page.getByRole('button', { name: 'Módulos' }).click();
    await expect(page.getByRole('link', { name: /Usuarios/i })).toBeVisible();
  });
});

test.describe('Usuarios — acceso restringido', () => {
  test.use({ rol: 'marketing' });

  test('marketing no entra a /usuarios ni ve el acceso', async ({ page }) => {
    await page.goto('/usuarios');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('main#contenido')).toContainText(/PANEL EJECUTIVO/i);

    await abrirNavegacionSiHaceFalta(page);
    await page.getByRole('button', { name: 'Módulos' }).click();
    await expect(page.getByRole('link', { name: /Usuarios/i })).toHaveCount(0);
  });
});

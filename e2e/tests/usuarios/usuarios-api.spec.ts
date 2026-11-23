import { request } from '@playwright/test';

import { test, expect } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import { API_URL } from '../../helpers/api-setup';
import { userFactory } from '../../factories/user.factory';

/**
 * La app no expone una ruta `/usuarios` ni una pantalla de alta de usuarios:
 * el flujo se verifica contra la API real con la sesión de administrador.
 * Queda marcado como BLOQUEADO para UI en el reporte.
 */
test.describe('Usuarios — API sin pantalla en la SPA', () => {
  test.use({ rol: 'admin' });

  test('crea un usuario, no expone la contraseña y aparece en la lista', async () => {
    const api = await request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${tokenDe('admin')}` },
    });
    const usuario = userFactory.valido();

    const creado = await api.post('/api/usuarios', { data: usuario });
    expect(creado.status(), await creado.text()).toBe(201);
    const cuerpo = await creado.json();
    expect(cuerpo.correo).toBe(usuario.correo);
    expect(cuerpo.rol).toBe('ventas');
    expect(JSON.stringify(cuerpo)).not.toContain(usuario.password);
    expect(JSON.stringify(cuerpo)).not.toContain('password_hash');

    const lista = await api.get('/api/usuarios');
    expect(lista.status()).toBe(200);
    const datos = await lista.json();
    expect(datos.items.some((item: { correo: string }) => item.correo === usuario.correo)).toBe(
      true,
    );
    await api.dispose();
  });

  test('rechaza un correo duplicado', async () => {
    const api = await request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${tokenDe('admin')}` },
    });
    const usuario = userFactory.valido();
    expect((await api.post('/api/usuarios', { data: usuario })).status()).toBe(201);

    const duplicado = await api.post('/api/usuarios', { data: usuario });
    expect(duplicado.status()).toBe(409);
    expect((await duplicado.json()).codigo).toBe('correo_duplicado');
    await api.dispose();
  });

  test('rechaza contraseñas de menos de 8 caracteres', async () => {
    const api = await request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${tokenDe('admin')}` },
    });
    const respuesta = await api.post('/api/usuarios', {
      data: userFactory.invalido.passwordCorta(),
    });
    expect(respuesta.status()).toBe(400);
    await api.dispose();
  });

  test('rechaza un rol inexistente y lista los roles válidos', async () => {
    const api = await request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${tokenDe('admin')}` },
    });
    const respuesta = await api.post('/api/usuarios', {
      data: userFactory.invalido.rolInexistente(),
    });
    expect(respuesta.status()).toBe(400);
    expect((await respuesta.json()).error).toMatch(/rol inválido/i);

    const roles = await api.get('/api/roles');
    expect(roles.status()).toBe(200);
    const nombres = (await roles.json()).items.map((rol: { nombre: string }) => rol.nombre);
    expect(nombres).toEqual(expect.arrayContaining(['admin', 'ventas', 'produccion']));
    await api.dispose();
  });
});

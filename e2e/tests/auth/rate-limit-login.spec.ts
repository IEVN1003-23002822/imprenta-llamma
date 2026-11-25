import { request } from '@playwright/test';

import { test, expect } from '../../fixtures/auth.fixture';
import { API_URL } from '../../helpers/api-setup';
import { correoUnico } from '../../helpers/datos';
import { vigilarConsola } from '../../helpers/assert-consola';
import { LoginPage } from '../../page-objects/LoginPage';

test.describe('Rate limit de login', () => {
  test.use({ rol: 'anonimo' });

  test('bloquea el sexto intento y muestra el mensaje en la UI', async ({ page }) => {
    const consola = vigilarConsola(page);
    consola.ignorar(/401|429|Failed to load resource/i);
    const correo = correoUnico('limite');
    const api = await request.newContext({ baseURL: API_URL });

    for (let intento = 1; intento <= 5; intento += 1) {
      const respuesta = await api.post('/api/auth/login', {
        data: { correo, password: 'incorrecta' },
      });
      expect(respuesta.status(), `intento ${intento}`).toBe(401);
    }

    const bloqueada = await api.post('/api/auth/login', {
      data: { correo, password: 'incorrecta' },
    });
    expect(bloqueada.status()).toBe(429);
    expect(Number(bloqueada.headers()['retry-after'])).toBeGreaterThan(0);
    await api.dispose();

    const login = new LoginPage(page);
    await login.goto();
    await login.login(correo, 'incorrecta');
    await login.expectError(/Demasiados intentos/i);
    consola.assertLimpia();
  });
});

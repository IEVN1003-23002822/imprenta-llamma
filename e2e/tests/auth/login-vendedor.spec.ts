import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Login vendedor', () => {
  test.use({ rol: 'vendedor' });

  test('entra a solicitudes pero no a inventario', async ({ page }) => {
    await page.goto('/solicitudes');
    await expect(page.locator('main#contenido')).toContainText(/Solicitudes recibidas/i);

    await page.goto('/inventario');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('main#contenido')).toContainText(/PANEL EJECUTIVO/i);
  });
});

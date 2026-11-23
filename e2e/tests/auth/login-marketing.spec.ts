import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Login marketing', () => {
  test.use({ rol: 'marketing' });

  test('accede a marketing pero no a inventario', async ({ page }) => {
    await page.goto('/marketing');
    await expect(page).toHaveURL(/\/marketing$/);
    await expect(page.locator('main#contenido')).toContainText(/CAMPAÑAS Y CRECIMIENTO/i);

    await page.goto('/inventario');
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

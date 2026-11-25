import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Login vendedor', () => {
  test.use({ rol: 'vendedor' });

  test('entra a solicitudes y consulta inventario en solo lectura', async ({ page }) => {
    await page.goto('/solicitudes');
    await expect(page.locator('main#contenido')).toContainText(/Solicitudes recibidas/i);

    await page.goto('/inventario');
    await expect(page).toHaveURL(/\/inventario$/);
    await expect(page.getByTestId('modo-lectura')).toBeVisible();
    await expect(page.getByRole('button', { name: /Registrar movimiento/i })).toHaveCount(0);
  });
});

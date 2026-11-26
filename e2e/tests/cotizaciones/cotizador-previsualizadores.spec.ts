import { test, expect, type Page } from '@playwright/test';

import { tokenDe } from '../../fixtures/api.fixture';
import { apiConToken, crearProducto } from '../../helpers/api-setup';
import { unico } from '../../helpers/datos';
import { productoFactory } from '../../factories/producto.factory';

async function irAlPaso2(page: Page): Promise<void> {
  await page.goto('/cotizar');
  await page.fill('#cotNombre', 'Prueba Previsualizadores');
  await page.fill('#cotCorreo', 'previsualizadores@example.com');
  await page.fill('#cotTelefono', '5551234567');
  await page.getByRole('button', { name: /Continuar/ }).click();
}

async function seleccionar(page: Page, producto: string): Promise<void> {
  await page.locator('#cotProducto').selectOption({ label: producto });
}

test.describe('Previsualizadores del cotizador', () => {
  test.use({ rol: 'admin' });

  test('el mockup 2D cambia entre playera y lona', async ({ page }) => {
    await irAlPaso2(page);
    await seleccionar(page, 'Playera DTF 29 × 29 cm');
    await page.getByRole('button', { name: /Previsualizar diseño/i }).click();
    await expect(page.locator('.mockup-base')).toHaveAttribute('src', /playera-1\.webp/);
    await page.getByRole('button', { name: 'Listo' }).click();

    await seleccionar(page, 'Lona/Vinil');
    await page.getByRole('button', { name: /Previsualizar diseño/i }).click();
    await expect(page.locator('.mockup-base')).toHaveAttribute('src', /lona-1\.webp/);
  });

  test('el mockup 2D avisa cuando el producto no tiene vista', async ({ page }) => {
    const api = await apiConToken(tokenDe('admin'));
    const producto = await crearProducto(
      api,
      productoFactory.valido({ nombre: `Servicio sin mockup ${unico('e2e')}` }),
    );
    await api.dispose();

    await irAlPaso2(page);
    await seleccionar(page, producto.nombre);
    await page.getByRole('button', { name: /Previsualizar diseño/i }).click();
    await expect(
      page.getByText(/Previsualización no disponible para este producto/i),
    ).toBeVisible();
  });

  test('la vista 3D del tote bag renderiza sin errores', async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (error) => errores.push(error.message));

    await irAlPaso2(page);
    await seleccionar(page, 'Tote bag de manta');
    await page.getByRole('button', { name: /Vista 3D/i }).click();
    await expect(page.getByTestId('modelo-cargando')).toBeHidden({ timeout: 20_000 });

    const canvas = await page.locator('.m3d-viewport canvas').evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      return { width: canvas.width, height: canvas.height };
    });
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
    await expect
      .poll(
        () =>
          page
            .locator('.m3d-viewport canvas')
            .evaluate((element) => (element as HTMLCanvasElement).toDataURL().length),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(15_000);
    expect(errores).toEqual([]);
  });

  test('la vista 3D muestra un aviso cuando el modelo no existe', async ({ page }) => {
    await irAlPaso2(page);
    await seleccionar(page, 'Taza cerámica sublimada');
    await page.getByRole('button', { name: /Vista 3D/i }).click();
    await expect(page.getByTestId('modelo-cargando')).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText(/Modelo 3D en construcción/i)).toBeVisible();
  });
});

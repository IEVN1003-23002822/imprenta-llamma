import { test, expect, type Page } from '@playwright/test';

import { CotizarPage } from '../../page-objects/CotizarPage';

async function abrir3d(page: Page, producto: string): Promise<void> {
  const cotizar = new CotizarPage(page);
  await cotizar.goto();
  await cotizar.llenarContacto({
    nombre: 'Prueba 3D',
    correo: 'prueba3d@example.com',
    telefono: '5551234567',
  });
  await cotizar.continuar();
  await page.locator('#cotProducto').selectOption({ label: producto });
  await page.getByRole('button', { name: /Vista 3D/i }).click();
}

async function contenidoCanvas(
  page: Page,
): Promise<{ width: number; height: number; dataUrl: number; distintos: number }> {
  return page.locator('.m3d-viewport canvas').evaluate((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return { width: canvas.width, height: canvas.height, dataUrl: 0, distintos: 0 };
    const data = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    let distintos = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (
        Math.abs(data[i] - 241) > 4 ||
        Math.abs(data[i + 1] - 240) > 4 ||
        Math.abs(data[i + 2] - 235) > 4
      ) {
        distintos += 1;
      }
    }
    return {
      width: canvas.width,
      height: canvas.height,
      dataUrl: canvas.toDataURL('image/png').length,
      distintos,
    };
  });
}

test.describe('Previsualizador 3D', () => {
  test('muestra el tote bag renderizado y oculta el estado de carga', async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (error) => errores.push(error.message));
    await page.route('**/assets/models/totebag.glb', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    await abrir3d(page, 'Tote bag de manta');
    await expect(page.getByTestId('modelo-cargando')).toBeVisible();
    await expect(page.getByTestId('modelo-cargando')).toBeHidden({ timeout: 20_000 });

    const canvas = await contenidoCanvas(page);
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
    expect(canvas.dataUrl).toBeGreaterThan(15_000);
    expect(canvas.distintos).toBeGreaterThan(1_000);
    expect(errores).toEqual([]);
    await page.locator('.m3d-viewport').screenshot({
      path: 'test-results/cotizador-3d-tote.png',
    });
  });

  test('usa un modelo aproximado cuando el GLB no existe', async ({ page }) => {
    await abrir3d(page, 'Taza cerámica sublimada');
    await expect(page.getByTestId('modelo-cargando')).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText(/Vista aproximada/i)).toBeVisible();

    const canvas = await contenidoCanvas(page);
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
    expect(canvas.distintos).toBeGreaterThan(500);
  });
});

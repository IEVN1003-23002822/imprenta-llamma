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
    await expect
      .poll(async () => (await contenidoCanvas(page)).distintos, { timeout: 10_000 })
      .toBeGreaterThan(500);
  });

  test('renderiza la playera con su GLB y sin 404', async ({ page }) => {
    const respuestas: Array<{ status: number; url: string }> = [];
    page.on('response', (respuesta) => {
      if (respuesta.url().includes('.glb')) {
        respuestas.push({ status: respuesta.status(), url: respuesta.url() });
      }
    });

    await abrir3d(page, 'Playera DTF 29 × 29 cm');
    await expect(page.getByTestId('modelo-cargando')).toBeHidden({ timeout: 20_000 });

    expect(respuestas.filter((item) => item.status >= 400)).toEqual([]);
    await expect(page.getByText(/Vista aproximada/i)).toHaveCount(0);

    const canvas = await contenidoCanvas(page);
    expect(canvas.width).toBeGreaterThan(0);
    await expect
      .poll(async () => (await contenidoCanvas(page)).distintos, { timeout: 10_000 })
      .toBeGreaterThan(500);
  });

  test('sube un logo PNG y lo pinta sobre el modelo', async ({ page }) => {
    await abrir3d(page, 'Tote bag de manta');
    await expect(page.getByTestId('modelo-cargando')).toBeHidden({ timeout: 20_000 });

    const pngBase64 = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, 96, 96);
      return canvas.toDataURL('image/png').split(',')[1];
    });

    const [respuesta] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/public/mockups/preparar-imagen') && res.status() === 200,
      ),
      page.locator('#m3dFile').setInputFiles({
        name: 'logo-rojo.png',
        mimeType: 'image/png',
        buffer: Buffer.from(pngBase64, 'base64'),
      }),
    ]);
    expect(respuesta.status()).toBe(200);

    await expect
      .poll(
        () =>
          page.locator('.m3d-viewport canvas').evaluate((canvas: HTMLCanvasElement) => {
            const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
            if (!gl) return 0;
            const data = new Uint8Array(canvas.width * canvas.height * 4);
            gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
            let rojos = 0;
            for (let i = 0; i < data.length; i += 4) {
              if (data[i] > 150 && data[i + 1] < 90 && data[i + 2] < 90) rojos += 1;
            }
            return rojos;
          }),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(20);
  });
});

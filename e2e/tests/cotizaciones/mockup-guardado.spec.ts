import path from 'node:path';

import { test, expect, type Browser, type Page } from '../../fixtures/auth.fixture';
import { CotizarPage } from '../../page-objects/CotizarPage';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4300';

/** PNG rojo cuadrado generado en el navegador para no depender de fixtures binarios. */
async function pngRojo(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#e11d48';
    ctx.fillRect(0, 0, 160, 160);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(48, 48, 64, 64);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(base64, 'base64');
}

async function abrirPaso2(page: Page, producto: string): Promise<CotizarPage> {
  const cotizar = new CotizarPage(page);
  await cotizar.goto();
  await cotizar.llenarContacto({
    nombre: 'Cliente Mockup',
    correo: `mockup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
    telefono: '5551234567',
  });
  await cotizar.continuar();
  await page.locator('#cotProducto').selectOption({ label: producto });
  await page.getByRole('button', { name: /Agregar a mi solicitud/i }).click();
  return cotizar;
}

async function verDisenoEnAdmin(browser: Browser, folio: string): Promise<void> {
  const contexto = await browser.newContext({
    baseURL: BASE_URL,
    storageState: path.join('e2e/.auth', 'admin.json'),
  });
  try {
    const admin = await contexto.newPage();
    await admin.goto('/solicitudes');
    const buscador = admin.getByLabel(/Buscar solicitudes por folio/i);
    await buscador.fill(folio);
    await buscador.press('Enter');
    await admin.getByRole('button').filter({ hasText: folio }).first().click();

    const tarjeta = admin.getByTestId('disenos-mockup');
    await expect(tarjeta).toBeVisible();
    const imagen = tarjeta.locator('img').first();
    await expect(imagen).toBeVisible();
    await expect
      .poll(() => imagen.evaluate((elemento) => (elemento as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
  } finally {
    await contexto.close();
  }
}

test.describe('Guardado de mockups en la solicitud', () => {
  test.use({ rol: 'anonimo' });

  test('adjunta la vista 2D y el admin la ve como previsualización', async ({ page, browser }) => {
    await abrirPaso2(page, 'Playera DTF 29 × 29 cm');
    await page.getByRole('button', { name: /Previsualizar diseño/i }).click();
    await page.locator('#mockupFile').setInputFiles({
      name: 'logo-cliente.png',
      mimeType: 'image/png',
      buffer: await pngRojo(page),
    });
    await expect(page.locator('.mockup-user-design')).toBeVisible();

    // Mueve el logo a la derecha para comprobar que la captura conserva la posición.
    await page
      .locator('.mockup-sliders input[type="range"]')
      .nth(1)
      .evaluate((elemento) => {
        const input = elemento as HTMLInputElement;
        input.value = '20';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    await expect(page.locator('.mockup-sliders')).toContainText('Horizontal: 20%');

    await page.getByRole('button', { name: /Adjuntar diseño 2D a mi solicitud/i }).click();
    await expect(page.locator('main#contenido')).toContainText(
      'Captura del diseño adjuntada a tu solicitud',
      { timeout: 20_000 },
    );
    await page.getByRole('button', { name: 'Listo' }).click();

    const cotizar = new CotizarPage(page);
    await cotizar.continuar();
    const nombreCaptura = 'diseno-playera-dtf-29-29-cm-2d.jpg';
    await expect(page.locator('.file-chip-name').filter({ hasText: nombreCaptura })).toBeVisible();

    const respuesta = await cotizar.enviar('Adjunto la vista del diseño en 2D para producción');
    expect(respuesta.folio).toMatch(/^SOL-/);

    await verDisenoEnAdmin(browser, respuesta.folio);
  });

  test('adjunta la vista 3D y guarda los metadatos del diseño', async ({ page, browser }) => {
    await abrirPaso2(page, 'Tote bag de manta');
    await page.getByRole('button', { name: /Vista 3D/i }).click();
    await expect(page.getByTestId('modelo-cargando')).toBeHidden({ timeout: 20_000 });

    await page.locator('#m3dFile').setInputFiles({
      name: 'logo-3d.png',
      mimeType: 'image/png',
      buffer: await pngRojo(page),
    });
    await expect(page.locator('.m3d-layer-info')).toContainText('logo-3d.png');

    await page.getByRole('button', { name: /Adjuntar vista 3D a mi solicitud/i }).click();
    await expect(page.getByRole('button', { name: /Captura adjuntada/i })).toBeVisible();
    await page.getByRole('button', { name: 'Listo' }).click();

    const cotizar = new CotizarPage(page);
    await cotizar.continuar();
    await expect(
      page.locator('.file-chip-name').filter({ hasText: 'diseno-tote-bag-de-manta-3d.jpg' }),
    ).toBeVisible();

    const respuesta = await cotizar.enviar('Así quiero la bolsa, adjunto la vista 3D');
    expect(respuesta.folio).toMatch(/^SOL-/);

    await verDisenoEnAdmin(browser, respuesta.folio);
  });

  test('deshabilita adjuntar mientras no hay diseño cargado', async ({ page }) => {
    await abrirPaso2(page, 'Playera DTF 29 × 29 cm');
    await page.getByRole('button', { name: /Previsualizar diseño/i }).click();

    await expect(
      page.getByRole('button', { name: /Adjuntar diseño 2D a mi solicitud/i }),
    ).toBeDisabled();
  });
});

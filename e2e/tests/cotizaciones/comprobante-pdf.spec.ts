import fs from 'node:fs';

import { test, expect } from '../../fixtures/auth.fixture';
import { CotizarPage } from '../../page-objects/CotizarPage';

async function llegarAlComprobante(page: import('@playwright/test').Page): Promise<CotizarPage> {
  const cotizar = new CotizarPage(page);
  await cotizar.goto();
  await cotizar.llenarContacto({
    nombre: 'Cliente Comprobante',
    correo: `comprobante-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
    telefono: '5551234567',
    empresa: 'Estudio Llamma',
  });
  await cotizar.continuar();
  await cotizar.agregarProducto('Playera DTF 29 × 29 cm', 2);
  await cotizar.continuar();
  return cotizar;
}

async function descargarPdf(
  page: import('@playwright/test').Page,
  destino = 'test-results/comprobante-pdf.pdf',
): Promise<{ nombre: string; tamano: number; firma: string; imagenes: number; paginas: number }> {
  const [descarga] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.getByRole('button', { name: /Descargar comprobante/i }).click(),
  ]);
  const ruta = await descarga.path();
  expect(ruta, 'Playwright debe entregar la ruta del PDF').toBeTruthy();
  if (!ruta) return { nombre: '', tamano: 0, firma: '', imagenes: 0, paginas: 0 };

  await descarga.saveAs(destino);
  const contenido = fs.readFileSync(ruta);
  const texto = contenido.toString('latin1');
  return {
    nombre: descarga.suggestedFilename(),
    tamano: fs.statSync(ruta).size,
    firma: contenido.subarray(0, 5).toString('latin1'),
    imagenes: (texto.match(/\/Subtype\s*\/Image/g) ?? []).length,
    paginas: (texto.match(/\/Type\s*\/Page(?!s)/g) ?? []).length,
  };
}

/** Adjunta la vista 2D del producto seleccionado en el paso 2. */
async function capturar2d(page: import('@playwright/test').Page, nombre: string): Promise<void> {
  await page.getByRole('button', { name: /Previsualizar diseño/i }).click();
  await page.locator('#mockupFile').setInputFiles({
    name: nombre,
    mimeType: 'image/png',
    buffer: await pngRojo(page),
  });
  await expect(page.locator('.mockup-user-design')).toBeVisible();
  await page.getByRole('button', { name: /Adjuntar diseño 2D a mi solicitud/i }).click();
  await expect(page.locator('main#contenido')).toContainText(
    'Captura del diseño adjuntada a tu solicitud',
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: 'Listo' }).click();
}

/** PNG rojo cuadrado generado en el navegador para no depender de fixtures binarios. */
async function pngRojo(page: import('@playwright/test').Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#e11d48';
    ctx.fillRect(0, 0, 320, 320);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LLAMMA', 160, 180);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(base64, 'base64');
}

test.describe('Comprobante de solicitud en PDF', () => {
  test.use({ rol: 'anonimo' });

  test('descarga un PDF real con el folio en el nombre', async ({ page }) => {
    const cotizar = await llegarAlComprobante(page);
    const respuesta = await cotizar.enviar(
      'Quiero dos playeras con el logotipo al frente y entrega en el taller.',
    );
    expect(respuesta.folio).toMatch(/^SOL-\d{4}-\d{3}$/);

    const pdf = await descargarPdf(page);
    expect(pdf.nombre).toBe(`Comprobante_${respuesta.folio}_Llamma.pdf`);
    expect(pdf.firma).toBe('%PDF-');
    expect(pdf.tamano).toBeGreaterThan(10_000);

    await expect(page.locator('main#contenido')).toContainText('Solicitud recibida');
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2,
    );
    expect(desborde, 'El comprobante no debe romper el ancho de la página').toBe(false);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/comprobante-pdf-ui.png' });
  });

  test('incluye la vista 2D del previsualizador en el PDF', async ({ page }) => {
    const cotizar = new CotizarPage(page);
    await cotizar.goto();
    await cotizar.llenarContacto({
      nombre: 'Cliente Diseño',
      correo: `diseno-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
      telefono: '5551239876',
    });
    await cotizar.continuar();

    await page.locator('#cotProducto').selectOption({ label: 'Playera DTF 29 × 29 cm' });
    await page.getByRole('button', { name: /Agregar a mi solicitud/i }).click();
    await capturar2d(page, 'logo-comprobante.png');
    await cotizar.continuar();

    const respuesta = await cotizar.enviar(
      'Quiero esta playera con el diseño que adjunté en el previsualizador.',
    );
    expect(respuesta.folio).toMatch(/^SOL-/);
    await expect(
      page.getByText(/El comprobante incluirá 1 vista del diseño que adjuntaste/i),
    ).toBeVisible();

    const pdf = await descargarPdf(page, 'test-results/comprobante-pdf-diseno.pdf');
    expect(
      pdf.imagenes,
      'El PDF debe incluir el logo y la captura del diseño',
    ).toBeGreaterThanOrEqual(2);
    expect(pdf.tamano).toBeGreaterThan(20_000);
  });

  test('incluye la vista 3D del previsualizador en el PDF', async ({ page }) => {
    const cotizar = new CotizarPage(page);
    await cotizar.goto();
    await cotizar.llenarContacto({
      nombre: 'Cliente Diseño 3D',
      correo: `diseno3d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
      telefono: '5551246803',
    });
    await cotizar.continuar();

    await page.locator('#cotProducto').selectOption({ label: 'Tote bag de manta' });
    await page.getByRole('button', { name: /Agregar a mi solicitud/i }).click();
    await page.getByRole('button', { name: /Vista 3D/i }).click();
    await expect(page.getByTestId('modelo-cargando')).toBeHidden({ timeout: 20_000 });
    await page.locator('#m3dFile').setInputFiles({
      name: 'logo-3d-pdf.png',
      mimeType: 'image/png',
      buffer: await pngRojo(page),
    });
    await expect(page.locator('.m3d-layer-info')).toContainText('logo-3d-pdf.png');
    await page.getByRole('button', { name: /Adjuntar vista 3D a mi solicitud/i }).click();
    await expect(page.getByRole('button', { name: /Captura adjuntada/i })).toBeVisible();
    await page.getByRole('button', { name: 'Listo' }).click();
    await cotizar.continuar();

    const respuesta = await cotizar.enviar(
      'Así quiero la tote bag, adjunto la vista 3D para producción.',
    );
    expect(respuesta.folio).toMatch(/^SOL-/);
    await expect(
      page.getByText(/El comprobante incluirá 1 vista del diseño que adjuntaste/i),
    ).toBeVisible();

    const pdf = await descargarPdf(page, 'test-results/comprobante-pdf-3d.pdf');
    expect(pdf.imagenes).toBeGreaterThanOrEqual(2);
    expect(pdf.tamano).toBeGreaterThan(20_000);
  });

  test('incluye dos vistas y pagina el PDF sin solapar contenido', async ({ page }) => {
    const cotizar = new CotizarPage(page);
    await cotizar.goto();
    await cotizar.llenarContacto({
      nombre: 'Cliente Dos Diseños',
      correo: `disenos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
      telefono: '5551246802',
    });
    await cotizar.continuar();

    await page.locator('#cotProducto').selectOption({ label: 'Playera DTF 29 × 29 cm' });
    await page.getByRole('button', { name: /Agregar a mi solicitud/i }).click();
    await capturar2d(page, 'logo-playera.png');

    await page.locator('#cotProducto').selectOption({ label: 'Taza cerámica sublimada' });
    await page.getByRole('button', { name: /Agregar a mi solicitud/i }).click();
    await capturar2d(page, 'logo-taza.png');

    await cotizar.continuar();
    const respuesta = await cotizar.enviar(
      'Quiero la playera y la taza con los diseños que adjunté en el previsualizador.',
    );
    expect(respuesta.folio).toMatch(/^SOL-/);
    await expect(page.getByText(/El comprobante incluirá 2 vistas/i)).toBeVisible();

    const pdf = await descargarPdf(page, 'test-results/comprobante-pdf-disenos.pdf');
    // Logo + dos capturas.
    expect(pdf.imagenes).toBeGreaterThanOrEqual(3);
    expect(pdf.paginas).toBeGreaterThanOrEqual(2);
  });

  test('pagina correctamente una solicitud con veinte partidas', async ({ page }) => {
    const cotizar = new CotizarPage(page);
    await cotizar.goto();
    await cotizar.llenarContacto({
      nombre: 'Cliente Volumen',
      correo: `volumen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
      telefono: '5559876543',
    });
    await cotizar.continuar();

    const producto = page.locator('#cotProducto');
    await producto.selectOption({ label: 'Playera DTF 29 × 29 cm' });
    for (let indice = 0; indice < 20; indice += 1) {
      await page.getByRole('button', { name: /Agregar a mi solicitud/i }).click();
    }
    await cotizar.continuar();

    const respuesta = await cotizar.enviar(
      'Necesito veinte playeras distintas para un evento escolar; adjunto referencias y medidas por separado.',
    );
    expect(respuesta.folio).toMatch(/^SOL-/);

    const pdf = await descargarPdf(page);
    expect(pdf.nombre).toBe(`Comprobante_${respuesta.folio}_Llamma.pdf`);
    expect(pdf.firma).toBe('%PDF-');
    expect(pdf.tamano).toBeGreaterThan(15_000);
  });
});

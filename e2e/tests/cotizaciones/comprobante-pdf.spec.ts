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
): Promise<{ nombre: string; tamano: number; firma: string }> {
  const [descarga] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.getByRole('button', { name: /Descargar comprobante/i }).click(),
  ]);
  const ruta = await descarga.path();
  expect(ruta, 'Playwright debe entregar la ruta del PDF').toBeTruthy();
  if (!ruta) return { nombre: '', tamano: 0, firma: '' };

  await descarga.saveAs('test-results/comprobante-pdf.pdf');
  const contenido = fs.readFileSync(ruta);
  return {
    nombre: descarga.suggestedFilename(),
    tamano: fs.statSync(ruta).size,
    firma: contenido.subarray(0, 5).toString('latin1'),
  };
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

import fs from 'node:fs';

import { expect, test } from '../../fixtures/auth.fixture';
import { CotizarPage } from '../../page-objects/CotizarPage';

const PRODUCTO = 'Playera DTF 29 × 29 cm';

test.describe('Precio de mayoreo en el cotizador', () => {
  test.use({ rol: 'anonimo' });

  test('aplica $20 por unidad desde 6 piezas y lo refleja en resumen y comprobante', async ({
    page,
  }) => {
    const cotizar = new CotizarPage(page);
    await cotizar.goto();
    await cotizar.llenarContacto({
      nombre: 'Cliente Mayoreo',
      correo: `mayoreo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
      telefono: '5551234567',
    });
    await cotizar.continuar();

    await page.locator('#cotProducto').selectOption({ label: PRODUCTO });
    const cantidad = page.locator('#cotCantidad');
    await expect(cantidad).toBeVisible();
    const estimado = page.locator('.line-estimate').first();

    // Debajo del umbral no se aplica mayoreo.
    await cantidad.fill('5');
    await expect(estimado).toContainText('$1,100');
    await expect(page.locator('.line-estimate-mayoreo')).toHaveCount(0);

    // En 6 piezas se rebajan $20 por unidad: 6 × $200 = $1,200.
    await cantidad.fill('6');
    await expect(estimado).toContainText('$1,200');
    await expect(page.locator('.line-estimate-mayoreo')).toContainText('Mayoreo 6+');
    await expect(page.locator('.line-estimate-mayoreo')).toContainText('$200 por unidad');
    await expect(page.locator('.line-estimate-mayoreo')).toContainText('$120');

    // En 10 piezas el descuento es $200 y el total vuelve a bajar.
    await cantidad.fill('10');
    await expect(estimado).toContainText('$2,000');
    await expect(page.locator('.line-estimate-mayoreo')).toContainText('$200');

    // Al regresar a 5 se desactiva por completo.
    await cantidad.fill('5');
    await expect(estimado).toContainText('$1,100');
    await expect(page.locator('.line-estimate-mayoreo')).toHaveCount(0);

    // Se agrega con 6 para revisar resumen, backend y comprobante.
    await cantidad.fill('6');
    await expect(estimado).toContainText('$1,200');
    await page.getByRole('button', { name: /Agregar a mi solicitud/i }).click();
    await cotizar.continuar();

    const resumen = page.locator('.quote-summary');
    await expect(resumen).toContainText('Descuento mayoreo (6+)');
    await expect(resumen).toContainText('−$120');
    await expect(resumen).toContainText('$1,200');
    await expect(resumen).toContainText('$192');
    await expect(resumen).toContainText('$1,392');

    const respuesta = await cotizar.enviar(
      'Quiero seis playeras con el logotipo al frente y precio de mayoreo.',
    );
    expect(respuesta.folio).toMatch(/^SOL-\d{4}-\d{3}$/);
    expect(respuesta.solicitud.itemsSolicitados[0].precioEstimado).toBe(1200);
    expect(respuesta.solicitud.itemsSolicitados[0].descuentoMayoreo).toBe(120);

    await expect(page.locator('main#contenido')).toContainText('Mayoreo 6+');
    await expect(page.locator('main#contenido')).toContainText('−$120');
    await expect(page.locator('main#contenido')).toContainText('$1,392');

    const [descarga] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.getByRole('button', { name: /Descargar comprobante/i }).click(),
    ]);
    const ruta = await descarga.path();
    expect(ruta, 'El PDF de mayoreo debe descargarse').toBeTruthy();
    if (ruta) {
      const contenido = fs.readFileSync(ruta);
      expect(contenido.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(fs.statSync(ruta).size).toBeGreaterThan(10_000);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/comprobante-mayoreo.png' });
  });
});

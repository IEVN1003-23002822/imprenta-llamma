import { test, expect, type Page } from '@playwright/test';

import { CotizarPage } from '../../page-objects/CotizarPage';

async function abrirPaso2(page: Page): Promise<CotizarPage> {
  const cotizar = new CotizarPage(page);
  await cotizar.goto();
  await cotizar.llenarContacto({
    nombre: 'Cliente Gran Formato',
    correo: 'granformato@example.com',
    telefono: '5551234567',
  });
  await cotizar.continuar();
  await page.locator('#cotProducto').selectOption({ label: 'Lona/Vinil' });
  return cotizar;
}

test.describe('Cotizador de lona y vinil', () => {
  test('muestra material y dimensiones, y calcula lona en tiempo real', async ({ page }) => {
    const cotizar = await abrirPaso2(page);

    await expect(page.locator('#cotMaterial')).toBeVisible();
    await expect(page.locator('#cotAncho')).toBeVisible();
    await expect(page.locator('#cotAlto')).toBeVisible();
    await expect(page.locator('#cotCantidad')).toHaveCount(0);

    await page.locator('#cotAncho').fill('1');
    await page.locator('#cotAlto').fill('2');
    await cotizar.seleccionarMaterial('lona');
    await expect(page.locator('main#contenido')).toContainText('Área calculada: 2 m²');
    await expect(page.locator('main#contenido')).toContainText('$340');

    await page.getByRole('button', { name: /Agregar a mi solicitud/i }).click();
    await expect(page.locator('main#contenido')).toContainText('Lona/Vinil · 2');

    await cotizar.continuar();
    const respuesta = await cotizar.enviar('Necesito dos metros cuadrados de lona impresa');
    expect(respuesta.folio).toMatch(/^SOL-/);
  });

  test('cambia a vinil con la misma área y usa otro precio', async ({ page }) => {
    const cotizar = await abrirPaso2(page);

    await page.locator('#cotAncho').fill('1');
    await page.locator('#cotAlto').fill('2');
    await cotizar.seleccionarMaterial('vinil');
    await expect(page.locator('main#contenido')).toContainText('Área calculada: 2 m²');
    await expect(page.locator('main#contenido')).toContainText('$270');
    await expect(page.locator('main#contenido')).not.toContainText('$340');

    await page.getByRole('button', { name: /Agregar a mi solicitud/i }).click();
    await expect(page.locator('main#contenido')).toContainText('Lona/Vinil (Vinil) · 2');
  });

  test('bloquea medidas en cero', async ({ page }) => {
    await abrirPaso2(page);

    await page.locator('#cotAncho').fill('0');
    await page.locator('#cotAlto').fill('0');
    await page.getByRole('button', { name: /Agregar a mi solicitud/i }).click();

    await expect(page.locator('main#contenido')).toContainText(
      'Captura un ancho y un largo mayores a cero',
    );
    await expect(page.locator('main#contenido')).not.toContainText('1 partidas');
  });
});

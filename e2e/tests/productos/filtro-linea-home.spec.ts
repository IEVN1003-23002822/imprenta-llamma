import { expect, type Page } from '@playwright/test';

import { test as authTest } from '../../fixtures/auth.fixture';
import { vigilarConsola } from '../../helpers/assert-consola';

const LINEAS = [
  {
    titulo: 'Gran Formato y Displays',
    parametro: 'gran-formato',
    etiqueta: 'Gran formato',
    productos: ['Lona/Vinil', 'Roll-up premium 85 × 200 cm'],
  },
  {
    titulo: 'Línea Textil',
    parametro: 'textil',
    etiqueta: 'Textil',
    productos: ['Playera DTF 29 × 29 cm', 'Tote bag de manta'],
  },
  {
    titulo: 'Artículos Promocionales',
    parametro: 'promocionales',
    etiqueta: 'Promocionales',
    productos: ['Taza cerámica sublimada'],
  },
  {
    titulo: 'Papelería Creativa',
    parametro: 'papeleria',
    etiqueta: 'Papelería',
    productos: ['Sticker troquelado', 'Tarjetas Couché 300g'],
  },
] as const;

async function esperarCatalogo(page: Page): Promise<void> {
  await expect(page.locator('article').first()).toBeVisible({ timeout: 15_000 });
}

async function badgesDeLinea(page: Page): Promise<string[]> {
  return (await page.locator('article .badge-soft-muted').allTextContents()).map((texto) =>
    texto.trim(),
  );
}

async function esperarLineas(page: Page, esperadas: string[]): Promise<void> {
  await expect
    .poll(async () => [...new Set(await badgesDeLinea(page))].sort())
    .toEqual([...esperadas].sort());
}

async function esperarVariasLineas(page: Page): Promise<void> {
  await expect.poll(async () => new Set(await badgesDeLinea(page)).size).toBeGreaterThan(1);
}

async function lineaActiva(page: Page, etiqueta: string): Promise<boolean> {
  return page
    .getByRole('button', { name: etiqueta, exact: true })
    .evaluate((elemento) => elemento.className.includes('border-[var(--llamma-cyan)]'));
}

authTest.describe('Filtro automático desde las cuatro líneas del inicio', () => {
  authTest.use({ rol: 'anonimo' });

  for (const linea of LINEAS) {
    authTest(`abre ${linea.titulo} ya filtrada en /productos`, async ({ page }) => {
      const consola = vigilarConsola(page);
      await page.goto('/');

      const tarjeta = page
        .locator('article.line-card')
        .filter({ has: page.getByRole('heading', { name: linea.titulo, exact: true }) });
      await expect(tarjeta).toBeVisible();
      await tarjeta.getByRole('link', { name: /Explorar línea/i }).click();

      await expect(page).toHaveURL(new RegExp(`/productos\\?linea=${linea.parametro}$`));
      await esperarCatalogo(page);
      await esperarLineas(page, [linea.etiqueta]);
      expect(await lineaActiva(page, linea.etiqueta)).toBe(true);
      for (const producto of linea.productos) {
        await expect(
          page.locator('article').filter({ hasText: producto }),
          `Falta ${producto} en ${linea.etiqueta}`,
        ).toBeVisible();
      }

      // La recarga conserva el filtro y el estado visual.
      await page.reload();
      await esperarCatalogo(page);
      await esperarLineas(page, [linea.etiqueta]);
      expect(await lineaActiva(page, linea.etiqueta)).toBe(true);

      consola.assertLimpia();
    });
  }

  authTest(
    'mantiene el comportamiento por defecto y permite limpiar el filtro',
    async ({ page }) => {
      await page.goto('/productos');
      await esperarCatalogo(page);
      const todas = await page.locator('article').count();
      expect(todas).toBeGreaterThan(0);
      await esperarVariasLineas(page);

      await page.getByRole('button', { name: 'Textil', exact: true }).click();
      await expect(page).toHaveURL(/linea=textil/);
      await esperarCatalogo(page);
      await esperarLineas(page, ['Textil']);

      await page.getByRole('button', { name: 'Todas las líneas', exact: true }).click();
      await expect(page).not.toHaveURL(/linea=/);
      await esperarCatalogo(page);
      await esperarVariasLineas(page);
    },
  );

  authTest('normaliza alias, tildes y nombres largos en la URL', async ({ page }) => {
    await page.goto('/productos?linea=L%C3%ADnea%20Textil');
    await esperarCatalogo(page);
    await esperarLineas(page, ['Textil']);
    expect(await lineaActiva(page, 'Textil')).toBe(true);

    await page.goto('/productos?linea=papeleria-creativa');
    await esperarCatalogo(page);
    await esperarLineas(page, ['Papelería']);

    await page.goto('/productos?linea=todas-las-lineas');
    await esperarCatalogo(page);
    await esperarVariasLineas(page);
  });

  authTest('atrás y adelante respetan la línea seleccionada', async ({ page }) => {
    await page.goto('/productos?linea=gran-formato');
    await esperarCatalogo(page);
    await page.getByRole('button', { name: 'Textil', exact: true }).click();
    await expect(page).toHaveURL(/linea=textil/);
    await esperarCatalogo(page);

    await page.goBack();
    await expect(page).toHaveURL(/linea=gran-formato/);
    await esperarCatalogo(page);
    await esperarLineas(page, ['Gran formato']);
    expect(await lineaActiva(page, 'Gran formato')).toBe(true);

    await page.goForward();
    await expect(page).toHaveURL(/linea=textil/);
    await esperarCatalogo(page);
    await esperarLineas(page, ['Textil']);
    expect(await lineaActiva(page, 'Textil')).toBe(true);
  });
});

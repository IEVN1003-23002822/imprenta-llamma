import { expect, type Locator, type Page } from '@playwright/test';

export class InventarioPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/inventario');
    await expect(
      this.page.getByRole('heading', { name: 'Control de inventario.', level: 1 }),
    ).toBeVisible();
  }

  async verTarjetas(): Promise<void> {
    await this.page.getByRole('tab', { name: /Por Producto/i }).click();
    await expect(this.tarjetas().first()).toBeVisible();
  }

  async verTabla(): Promise<void> {
    await this.page.getByRole('tab', { name: /Tabla General/i }).click();
  }

  tarjetas(): Locator {
    return this.page.getByTestId('producto-insumos');
  }

  tarjeta(nombre: string): Locator {
    return this.tarjetas().filter({ has: this.page.getByRole('heading', { name: nombre }) });
  }

  async reponerEn(nombreProducto: string): Promise<{ insumo: string }> {
    const boton = this.tarjeta(nombreProducto)
      .getByRole('button', { name: /Reponer/i })
      .first();
    const etiqueta = (await boton.getAttribute('aria-label')) ?? '';
    await boton.click();
    return { insumo: etiqueta.replace(/^Reponer\s+/i, '') };
  }
}

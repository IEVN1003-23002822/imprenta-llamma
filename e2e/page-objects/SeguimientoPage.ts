import { expect, type Page } from '@playwright/test';

export class SeguimientoPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/seguimiento');
    await expect(this.page.locator('#segFolio')).toBeVisible();
  }

  async consultar(folio: string, correo: string): Promise<void> {
    await this.page.locator('#segFolio').fill(folio);
    await this.page.locator('#segCorreo').fill(correo);
    await this.page.getByRole('button', { name: /Buscar/ }).click();
  }

  async expectSolicitud(folio: string): Promise<void> {
    await expect(this.page.locator('main#contenido')).toContainText(
      new RegExp(`Solicitud\\s+${folio}`, 'i'),
    );
  }

  async expectEstado(estado: RegExp): Promise<void> {
    await expect(this.page.locator('main#contenido')).toContainText(estado);
  }

  async expectError(mensaje: RegExp): Promise<void> {
    await expect(this.page.locator('main#contenido')).toContainText(mensaje);
  }
}

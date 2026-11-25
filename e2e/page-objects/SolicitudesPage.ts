import { expect, type Page } from '@playwright/test';

import { esperarRespuesta } from '../helpers/wait-for';

export class SolicitudesPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/solicitudes');
    await expect(this.page.locator('main#contenido')).toContainText(/Solicitudes recibidas/i);
  }

  async buscar(folio: string): Promise<void> {
    const buscador = this.page.getByLabel(/Buscar solicitudes por folio/i);
    await buscador.fill(folio);
    await buscador.press('Enter');
    await expect(this.page.getByRole('button').filter({ hasText: folio })).toBeVisible();
  }

  async abrir(folio: string): Promise<void> {
    await this.page.getByRole('button').filter({ hasText: folio }).first().click();
    await expect(this.page.getByText(folio, { exact: false }).first()).toBeVisible();
  }

  async convertirEnCotizacion(folio: string): Promise<Record<string, any>> {
    await this.buscar(folio);
    await this.abrir(folio);
    const [respuesta] = await Promise.all([
      esperarRespuesta(this.page, '/convertir-cotizacion', 201),
      this.page.getByRole('button', { name: /Convertir en cotización/i }).click(),
    ]);
    await expect(this.page.locator('main#contenido')).toContainText(/cotización COT-/i);
    return respuesta.json();
  }

  async abrirEnCotizador(): Promise<void> {
    await this.page.getByRole('button', { name: /Abrir en cotizador/i }).click();
    await expect(this.page).toHaveURL(/\/captura\?.*cotizacion=/);
  }
}

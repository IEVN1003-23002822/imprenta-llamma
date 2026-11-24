import { expect, type Page } from '@playwright/test';

import { esperarRespuesta } from '../helpers/wait-for';

export interface Contacto {
  nombre: string;
  correo: string;
  telefono?: string;
  empresa?: string;
}

export class CotizarPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/cotizar');
    await expect(this.page.locator('#solicitudForm')).toBeVisible();
  }

  async llenarContacto(datos: Contacto): Promise<void> {
    await this.page.locator('#cotNombre').fill(datos.nombre);
    await this.page.locator('#cotCorreo').fill(datos.correo);
    if (datos.telefono) await this.page.locator('#cotTelefono').fill(datos.telefono);
    if (datos.empresa) await this.page.locator('#cotEmpresa').fill(datos.empresa);
  }

  async fechaDeseada(fecha: string): Promise<void> {
    await this.page.locator('#cotFecha').fill(fecha);
  }

  async continuar(): Promise<void> {
    await this.page.getByRole('button', { name: /Continuar/ }).click();
  }

  async agregarProducto(nombre: string, cantidad: number): Promise<void> {
    const selector = this.page.locator('#cotProducto');
    await expect(selector.locator('option').filter({ hasText: nombre })).toHaveCount(1);
    await selector.selectOption({ label: nombre });
    await this.page.locator('#cotCantidad').fill(String(cantidad));
    await this.page.getByRole('button', { name: /Agregar a mi solicitud/i }).click();
  }

  async adjuntar(nombre: string, contenido: string, mimeType: string): Promise<void> {
    await this.page.locator('#cotArchivos').setInputFiles({
      name: nombre,
      mimeType,
      buffer: Buffer.from(contenido),
    });
  }

  async enviar(mensaje: string): Promise<{ folio: string; solicitud: { id: number } }> {
    await this.page.locator('#cotMensaje').fill(mensaje);
    const [respuesta] = await Promise.all([
      esperarRespuesta(this.page, '/api/public/solicitudes', 201),
      this.page.getByRole('button', { name: /Enviar solicitud de cotización/i }).click(),
    ]);
    return respuesta.json();
  }

  async expectComprobante(folio: string): Promise<void> {
    await expect(this.page.locator('main#contenido')).toContainText(folio);
  }
}

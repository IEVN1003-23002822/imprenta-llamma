import { expect, type Page } from '@playwright/test';

import { esperarRespuesta } from '../helpers/wait-for';

const mxn = (valor: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);

export interface TotalesEsperados {
  subtotal: number;
  iva: number;
  total: number;
  anticipo: number;
  saldo: number;
}

export class CapturaPage {
  constructor(private readonly page: Page) {}

  async gotoConCotizacion(cotizacionId: number): Promise<void> {
    await this.page.goto(`/captura?cotizacion=${cotizacionId}`);
    await expect(this.page.locator('.quote-summary')).toBeVisible();
  }

  async gotoConSolicitud(solicitudId: number): Promise<void> {
    await this.page.goto(`/captura?solicitud=${solicitudId}`);
    await expect(this.page.locator('.quote-summary')).toBeVisible();
  }

  async expectTotales(totales: TotalesEsperados): Promise<void> {
    const resumen = this.page.locator('.summary-totals');
    await expect(resumen).toContainText(mxn(totales.subtotal));
    await expect(resumen).toContainText(mxn(totales.iva));
    await expect(resumen).toContainText(mxn(totales.total));
    await expect(resumen).toContainText(mxn(totales.anticipo));
    await expect(resumen).toContainText(mxn(totales.saldo));
  }

  async llenarCliente(nombre: string, correo: string, telefono = '5551234567'): Promise<void> {
    await this.page.locator('#clienteNombre').fill(nombre);
    await this.page.locator('#clienteCorreo').fill(correo);
    await this.page.locator('#clienteTelefono').fill(telefono);
  }

  async agregarPartida(cantidad: number, precio: number): Promise<void> {
    await this.page.locator('#productoCantidad').fill(String(cantidad));
    await this.page.locator('#productoPrecio').fill(String(precio));
    await this.page.getByRole('button', { name: /Agregar/ }).click();
  }

  async guardarCotizacion(): Promise<void> {
    const [respuesta] = await Promise.all([
      esperarRespuesta(this.page, '/api/cotizaciones', 201),
      this.page.getByRole('button', { name: /Guardar cotización/i }).click(),
    ]);
    const datos = await respuesta.json();
    await expect(this.page.locator('main#contenido')).toContainText(datos.folio);
  }

  async convertirAPedido(anticipoPagado = false): Promise<Record<string, any>> {
    if (anticipoPagado) await this.page.locator('#anticipoPagado').check();
    const [respuesta] = await Promise.all([
      esperarRespuesta(this.page, '/convertir-pedido', 201),
      this.page.getByRole('button', { name: /Convertir en pedido/i }).click(),
    ]);
    return respuesta.json();
  }

  async expectPedidoCreado(folio: string): Promise<void> {
    await expect(this.page.locator('main#contenido')).toContainText(/Pedido en producción/i);
    await expect(this.page.locator('main#contenido')).toContainText(folio);
  }

  async expectConversionBloqueada(): Promise<void> {
    await expect(this.page.locator('main#contenido')).toContainText(/ya se convirtió en pedido/i);
  }
}

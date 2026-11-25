import { expect, type Locator, type Page } from '@playwright/test';

export class ProductosPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/productos');
    await expect(this.page.locator('main#contenido h1')).toBeVisible();
  }

  async abrirGestion(): Promise<void> {
    await this.page.getByRole('button', { name: /Gestionar catálogo/i }).click();
    await expect(
      this.page.getByRole('heading', {
        name: /Gestión de productos|Editar producto|Nuevo producto/i,
      }),
    ).toBeVisible();
  }

  fila(nombre: string): Locator {
    return this.page.getByRole('row').filter({ hasText: nombre });
  }

  async editar(nombre: string): Promise<void> {
    await this.fila(nombre).getByRole('button', { name: 'Editar producto' }).click();
    await expect(this.page.getByRole('heading', { name: 'Editar producto' })).toBeVisible();
  }

  async cambiarPrecio(nombre: string, precio: number): Promise<void> {
    await this.editar(nombre);
    await this.page.locator('#prodPrecio').fill(String(precio));
    await this.guardar();
  }

  async cambiarDescripcion(nombre: string, descripcion: string): Promise<void> {
    await this.editar(nombre);
    await this.page.locator('#prodDescripcion').fill(descripcion);
    await this.guardar();
  }

  async cambiarImagen(nombre: string, ruta: string): Promise<void> {
    await this.editar(nombre);
    await this.page.locator('#prodImagen').fill(ruta);
    await this.guardar();
  }

  async guardar(): Promise<void> {
    await this.page.getByRole('button', { name: /Guardar producto/i }).click();
    await expect(this.page.getByRole('heading', { name: /Gestión de productos/i })).toBeVisible();
  }

  async alternarPublicado(nombre: string): Promise<void> {
    const [respuesta] = await Promise.all([
      this.page.waitForResponse((respuesta) => {
        const ruta = new URL(respuesta.url()).pathname;
        return (
          /\/api\/productos\/\d+$/.test(ruta) &&
          ['PUT', 'PATCH'].includes(respuesta.request().method()) &&
          respuesta.status() === 200
        );
      }),
      this.fila(nombre)
        .getByRole('button', { name: /Ocultar del catálogo|Publicar en catálogo/i })
        .click(),
    ]);
    expect(respuesta.ok()).toBe(true);
  }

  async cerrar(): Promise<void> {
    await this.page.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
  }

  tarjetaPublica(nombre: string): Locator {
    return this.page.locator('article').filter({ hasText: nombre });
  }

  async expectTarjetaPublica(nombre: string, precio?: string): Promise<void> {
    await this.page.goto('/productos');
    const tarjeta = this.tarjetaPublica(nombre);
    await expect(tarjeta).toBeVisible();
    if (precio) await expect(tarjeta).toContainText(precio);
  }
}

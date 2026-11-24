import { expect, type Locator, type Page } from '@playwright/test';

export interface NuevoUsuarioUi {
  nombre: string;
  correo: string;
  password: string;
  rol?: string;
}

export class UsuariosPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/usuarios');
    await expect(this.page.getByRole('heading', { name: 'Usuarios.', level: 1 })).toBeVisible();
  }

  async llenar(datos: NuevoUsuarioUi): Promise<void> {
    await this.page.locator('#usuarioNombre').fill(datos.nombre);
    await this.page.locator('#usuarioCorreo').fill(datos.correo);
    await this.page.locator('#usuarioPassword').fill(datos.password);
    if (datos.rol) {
      await expect(this.page.locator(`#usuarioRol option[value="${datos.rol}"]`)).toBeAttached();
      await this.page.locator('#usuarioRol').selectOption(datos.rol);
    }
  }

  async crear(estado = 201): Promise<Record<string, any>> {
    const [respuesta] = await Promise.all([
      this.page.waitForResponse(
        (respuesta) =>
          new URL(respuesta.url()).pathname === '/api/usuarios' &&
          respuesta.request().method() === 'POST' &&
          respuesta.status() === estado,
      ),
      this.page.getByRole('button', { name: /Crear usuario/i }).click(),
    ]);
    return respuesta.json();
  }

  /** Para casos inválidos: no se espera una petición, solo el mensaje. */
  async intentarCrearSinPeticion(): Promise<void> {
    await this.page.getByRole('button', { name: /Crear usuario/i }).click();
  }

  async expectError(mensaje: RegExp): Promise<void> {
    await expect(this.page.getByRole('alert')).toContainText(mensaje);
  }

  fila(correo: string): Locator {
    return this.page.getByRole('row').filter({ hasText: correo });
  }

  async expectUsuario(correo: string, rol: string): Promise<void> {
    const fila = this.fila(correo);
    await expect(fila).toBeVisible();
    await expect(fila).toContainText(rol);
  }

  async opcionesRol(): Promise<string[]> {
    await expect(this.page.locator('#usuarioRol option').first()).toBeAttached();
    return this.page.locator('#usuarioRol option').allTextContents();
  }
}

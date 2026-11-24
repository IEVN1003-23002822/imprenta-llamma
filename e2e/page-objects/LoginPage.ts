import { expect, type Page } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await expect(this.page.locator('#authEmail')).toBeVisible();
  }

  async login(correo: string, password: string, recordar = true): Promise<void> {
    await this.page.locator('#authEmail').fill(correo);
    await this.page.locator('#authPassword').fill(password);
    if (recordar) await this.page.locator('#authRemember').check();
    await this.page.getByRole('button', { name: /entrar al panel|iniciar sesión/i }).click();
  }

  async expectDashboard(): Promise<void> {
    await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    await expect(this.page.locator('main#contenido')).toContainText(/PANEL EJECUTIVO/i, {
      timeout: 15_000,
    });
  }

  async expectError(mensaje: RegExp): Promise<void> {
    await expect(this.page.getByRole('alert')).toContainText(mensaje);
  }

  async expectSinSesion(): Promise<void> {
    const sesion = await this.page.evaluate(() => localStorage.getItem('llamma.session.v1'));
    expect(sesion).toBeNull();
  }
}

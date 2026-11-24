import { expect, type Page } from '@playwright/test';

export class DashboardPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
  }

  async expectCargado(): Promise<void> {
    await expect(this.page.locator('main#contenido')).toContainText(/PANEL EJECUTIVO/i);
    await expect(this.page.getByRole('button', { name: 'Salir' })).toBeVisible();
  }
}

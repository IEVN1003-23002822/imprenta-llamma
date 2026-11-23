import { expect, type Page } from '@playwright/test';

export class HomePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async expectCargada(): Promise<void> {
    await expect(this.page.locator('main#contenido h1')).toBeVisible();
    await expect(this.page.locator('#nuestros-productos')).toBeVisible();
  }
}

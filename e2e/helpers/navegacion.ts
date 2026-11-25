import type { Page } from '@playwright/test';

/**
 * En viewports móviles la navegación está colapsada detrás del botón
 * «Abrir menú de navegación». En desktop no hace nada.
 */
export async function abrirNavegacionSiHaceFalta(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: /menú de navegación/i });
  if (!(await toggle.isVisible().catch(() => false))) return;
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}

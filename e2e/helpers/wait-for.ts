import type { Page, Response } from '@playwright/test';

/** Espera una respuesta concreta sin usar `waitForTimeout`. */
export function esperarRespuesta(
  page: Page,
  fragmentoUrl: string,
  status: number,
): Promise<Response> {
  return page.waitForResponse(
    (respuesta) => respuesta.url().includes(fragmentoUrl) && respuesta.status() === status,
  );
}

/** Espera a que la app termine de pintar la lista o el panel indicado. */
export async function esperarContenido(page: Page, texto: RegExp): Promise<void> {
  await page.locator('main#contenido').getByText(texto).first().waitFor();
}

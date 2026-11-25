import { test, expect } from '../../fixtures/auth.fixture';
import { vigilarConsola } from '../../helpers/assert-consola';

const RUTAS = [
  '/dashboard',
  '/solicitudes',
  '/captura',
  '/inventario',
  '/abastecimiento',
  '/produccion',
  '/clientes',
  '/usuarios',
  '/consultas',
  '/marketing',
];

function archivoDe(ruta: string): string {
  return ruta.replace(/^\//, '').replace(/\//g, '-') || 'inicio';
}

test.describe('Auditoría de rutas internas', () => {
  test.use({ rol: 'admin' });

  test('todas las páginas del panel cargan sin errores de consola ni respuestas 4xx/5xx', async ({
    page,
  }) => {
    const consola = vigilarConsola(page);
    const fallos: string[] = [];
    const registrar = (respuesta: import('@playwright/test').Response) => {
      if (respuesta.status() >= 400) {
        fallos.push(`${respuesta.status()} ${respuesta.request().method()} ${respuesta.url()}`);
      }
    };
    page.on('response', registrar);

    try {
      for (const ruta of RUTAS) {
        fallos.length = 0;
        await page.goto(ruta);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('main#contenido'), `Sin main en ${ruta}`).toBeVisible();
        await expect(page.locator('main#contenido')).not.toBeEmpty();
        await page.screenshot({
          path: `test-results/auditoria-${archivoDe(ruta)}.png`,
          fullPage: false,
        });
        expect(fallos, `Respuestas fallidas en ${ruta}:\n${fallos.join('\n')}`).toEqual([]);
      }
    } finally {
      page.off('response', registrar);
    }

    consola.assertLimpia();
  });
});

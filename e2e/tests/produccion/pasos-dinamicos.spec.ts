import { expect, type Page } from '@playwright/test';

import { test as authTest } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import { apiConToken, crearCliente, crearPedido, crearProducto } from '../../helpers/api-setup';
import { correoUnico, unico } from '../../helpers/datos';
import { productoFactory } from '../../factories/producto.factory';

async function etapasDeLaOrden(page: Page, folio: string): Promise<string[]> {
  const tarjeta = page.locator('.task-card').filter({ hasText: folio });
  await expect(tarjeta).toBeVisible();
  await tarjeta.getByRole('button', { name: 'Abrir orden' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(folio) })).toBeVisible();
  const etapas = await page.locator('.stage-list-item strong').allTextContents();
  await page.locator('button[aria-label="Cerrar"]').click();
  return etapas.map((etapa) => etapa.trim());
}

authTest.describe('Pasos de producción dinámicos', () => {
  authTest.use({ rol: 'admin' });

  authTest('Lona/Vinil, playera y roll-up reciben sus pasos', async ({ page }) => {
    const api = await apiConToken(tokenDe('admin'));
    const cliente = await crearCliente(api, {
      nombre: `Cliente pasos ${unico('e2e')}`,
      correo: correoUnico('pasos'),
    });
    const lona = await crearProducto(
      api,
      productoFactory.valido({
        nombre: `Lona pasos ${unico('e2e')}`,
        lineaProduccion: 'gran-formato',
        categoria: 'display',
        precioBase: 100,
        unidadVenta: 'pieza',
      }),
    );
    const playera = await crearProducto(
      api,
      productoFactory.valido({
        nombre: `Playera pasos ${unico('e2e')}`,
        lineaProduccion: 'textil',
        categoria: 'textil',
        precioBase: 100,
        unidadVenta: 'pieza',
      }),
    );
    const rollup = await crearProducto(
      api,
      productoFactory.valido({
        nombre: `Roll-up pasos ${unico('e2e')}`,
        lineaProduccion: 'gran-formato',
        categoria: 'display',
        precioBase: 100,
        unidadVenta: 'pieza',
      }),
    );

    const pedidoLona = await crearPedido(api, {
      clienteId: cliente.id,
      items: [{ productoId: lona.id, cantidad: 1 }],
    });
    const pedidoPlayera = await crearPedido(api, {
      clienteId: cliente.id,
      items: [{ productoId: playera.id, cantidad: 1 }],
    });
    const pedidoRollup = await crearPedido(api, {
      clienteId: cliente.id,
      items: [{ productoId: rollup.id, cantidad: 1 }],
    });

    const etapasLona = pedidoLona.ordenProduccion.historialEtapas.map(
      (etapa: { etapa: string }) => etapa.etapa,
    );
    const etapasPlayera = pedidoPlayera.ordenProduccion.historialEtapas.map(
      (etapa: { etapa: string }) => etapa.etapa,
    );
    const etapasRollup = pedidoRollup.ordenProduccion.historialEtapas.map(
      (etapa: { etapa: string }) => etapa.etapa,
    );

    expect(etapasLona).toEqual(['diseno', 'impresion', 'corte', 'empaquetado']);
    expect(etapasPlayera).toEqual(['diseno', 'impresion', 'plasmado', 'empaquetado']);
    expect(etapasRollup).toEqual(['diseno', 'impresion', 'empaquetado']);

    await page.goto('/produccion');
    expect(await etapasDeLaOrden(page, pedidoLona.folio)).toEqual([
      'Diseño',
      'Impresión',
      'Corte',
      'Empaquetado',
    ]);
    expect(await etapasDeLaOrden(page, pedidoPlayera.folio)).toEqual([
      'Diseño',
      'Impresión',
      'Plasmado',
      'Empaquetado',
    ]);
    expect(await etapasDeLaOrden(page, pedidoRollup.folio)).toEqual([
      'Diseño',
      'Impresión',
      'Empaquetado',
    ]);

    await api.dispose();
  });
});

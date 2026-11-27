import { test, expect } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import {
  actualizarProduccion,
  apiConToken,
  convertirPedido,
  convertirSolicitud,
  crearProducto,
  crearSolicitud,
  obtenerPedido,
} from '../../helpers/api-setup';
import { correoUnico, unico } from '../../helpers/datos';
import { productoFactory } from '../../factories/producto.factory';
import { vigilarConsola } from '../../helpers/assert-consola';

test.describe('Producción y solicitudes', () => {
  test.use({ rol: 'admin' });

  test('Guardar cambios con Estado=Completada cierra la orden y actualiza solicitudes', async ({
    page,
  }) => {
    const consola = vigilarConsola(page);
    const api = await apiConToken(tokenDe('admin'));
    const sufijo = unico('completada');

    const producto = await crearProducto(
      api,
      productoFactory.valido({
        nombre: `Servicio ${sufijo}`,
        categoria: 'otro',
        lineaProduccion: 'gran-formato',
        precioBase: 100,
        unidadVenta: 'pieza',
      }),
    );
    const solicitud = await crearSolicitud(api, {
      nombre: `Cliente ${sufijo}`,
      correo: correoUnico('completada'),
      mensaje: 'Quiero seguir el avance de producción de mi pedido',
      items: [{ productoId: producto.id, cantidad: 1 }],
    });
    const cotizacion = await convertirSolicitud(api, solicitud.solicitud.id);
    const pedido = await convertirPedido(api, cotizacion.id);

    for (const etapa of ['impresion', 'corte', 'empaquetado'] as const) {
      await actualizarProduccion(api, pedido.ordenProduccion.id, {
        etapa,
        estado: 'en-proceso',
      });
    }

    await page.goto('/produccion');
    const tarjeta = page.locator('.task-card').filter({ hasText: pedido.folio });
    await expect(tarjeta).toBeVisible();
    await tarjeta.getByRole('button', { name: /Abrir orden/i }).click();
    const modal = page.getByRole('dialog', { name: new RegExp(pedido.folio) });
    await expect(modal).toBeVisible();
    await modal.locator('#prodEstado').selectOption('completada');
    await modal.getByRole('button', { name: /Guardar cambios/i }).click();
    await expect(modal).toBeHidden();
    await expect(tarjeta).toHaveCount(0);

    const actualizado = await obtenerPedido(api, pedido.id);
    expect(actualizado.estado).toBe('listo');
    expect(actualizado.ordenProduccion?.estado).toBe('completada');
    expect(actualizado.ordenProduccion?.etapa).toBe('empaquetado');

    await page.goto('/solicitudes');
    const buscador = page.getByLabel(/Buscar solicitudes por folio/i);
    await buscador.fill(solicitud.folio);
    await buscador.press('Enter');
    const fila = page.getByRole('button').filter({ hasText: solicitud.folio }).first();
    await expect(fila).toContainText(/Producción completada/i);
    await expect(fila).toContainText(pedido.folio);
    consola.assertLimpia();

    await api.dispose();
  });
});

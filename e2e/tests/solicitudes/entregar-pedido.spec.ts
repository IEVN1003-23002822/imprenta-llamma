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
import { SeguimientoPage } from '../../page-objects/SeguimientoPage';
import { vigilarConsola } from '../../helpers/assert-consola';

test.describe('Entrega de pedidos desde solicitudes', () => {
  test.use({ rol: 'admin' });

  test('marca el pedido como entregado y lo conserva al recargar', async ({ page }) => {
    const consola = vigilarConsola(page);
    const api = await apiConToken(tokenDe('admin'));
    const sufijo = unico('entrega');

    const producto = await crearProducto(
      api,
      productoFactory.valido({
        nombre: `Servicio entrega ${sufijo}`,
        categoria: 'otro',
        lineaProduccion: 'gran-formato',
        precioBase: 100,
        unidadVenta: 'pieza',
      }),
    );
    const correo = correoUnico('entrega');
    const solicitud = await crearSolicitud(api, {
      nombre: `Cliente ${sufijo}`,
      correo,
      mensaje: 'Quiero recoger mi pedido cuando esté listo',
      items: [{ productoId: producto.id, cantidad: 1 }],
    });
    const cotizacion = await convertirSolicitud(api, solicitud.solicitud.id);
    const pedido = await convertirPedido(api, cotizacion.id);

    await page.goto('/solicitudes');
    const buscador = page.getByLabel(/Buscar solicitudes por folio/i);
    await buscador.fill(solicitud.folio);
    await buscador.press('Enter');
    const fila = page.getByRole('button').filter({ hasText: solicitud.folio }).first();
    await fila.click();

    const detalle = page.locator('[data-testid="detalle-produccion"]');
    await expect(detalle).toContainText(pedido.folio);
    const botonEntregar = page.getByTestId('btn-entregar-pedido');
    await expect(botonEntregar).toBeVisible();
    await expect(botonEntregar).toBeDisabled();
    await expect(detalle).toContainText(
      /La entrega se habilita cuando producción esté completada/i,
    );

    // Producción completa la orden: el pedido queda listo para entrega.
    for (const etapa of ['impresion', 'corte', 'empaquetado'] as const) {
      await actualizarProduccion(api, pedido.ordenProduccion.id, {
        etapa,
        estado: 'en-proceso',
      });
    }
    await actualizarProduccion(api, pedido.ordenProduccion.id, { estado: 'completada' });
    expect((await obtenerPedido(api, pedido.id)).estado).toBe('listo');

    await page.reload();
    await buscador.fill(solicitud.folio);
    await buscador.press('Enter');
    await page.getByRole('button').filter({ hasText: solicitud.folio }).first().click();
    await expect(botonEntregar).toBeEnabled();

    await botonEntregar.click();
    const confirmacion = page.getByRole('dialog', { name: /Marcar pedido como entregado/i });
    await expect(confirmacion).toBeVisible();
    const [respuesta] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/pedidos/${pedido.id}/estado`) &&
          r.request().method() === 'PATCH' &&
          r.status() === 200,
      ),
      confirmacion.getByRole('button', { name: 'Marcar entregado', exact: true }).click(),
    ]);
    expect((await respuesta.json()).estado).toBe('entregado');

    await expect(detalle).toContainText(/Entregado/i);
    await expect(detalle).toContainText(/Completada/i);
    await expect(fila).toContainText(/Entregado/i);
    expect((await obtenerPedido(api, pedido.id)).estado).toBe('entregado');

    await page.reload();
    await buscador.fill(solicitud.folio);
    await buscador.press('Enter');
    const filaRecargada = page.getByRole('button').filter({ hasText: solicitud.folio }).first();
    await expect(filaRecargada).toContainText(/Entregado/i);
    await filaRecargada.click();
    await expect(page.locator('[data-testid="detalle-produccion"]')).toContainText(/Entregado/i);

    await page.getByRole('button', { name: 'Cerrar detalle', exact: true }).click();
    await page.getByRole('button', { name: /^Entregados$/ }).click();
    await expect(
      page.getByRole('button').filter({ hasText: solicitud.folio }).first(),
    ).toBeVisible();
    const tarjetaEntregados = page
      .locator('.inbox-stat')
      .filter({ hasText: 'Producción completada' });
    await expect(tarjetaEntregados).toContainText(/entregados/i);

    const seguimiento = new SeguimientoPage(page);
    await seguimiento.goto();
    await seguimiento.consultar(solicitud.folio, correo);
    const panelSeguimiento = page.locator('[data-testid="pedido-seguimiento"]');
    await expect(panelSeguimiento).toContainText(/Entregado/i);
    consola.assertLimpia();

    await api.dispose();
  });
});

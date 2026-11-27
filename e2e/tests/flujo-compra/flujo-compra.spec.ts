import type { APIRequestContext } from '@playwright/test';

import { test, expect } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import {
  actualizarProduccion,
  apiConToken,
  convertirPedido,
  convertirSolicitud,
  crearCliente,
  crearMateriaPrima,
  crearProducto,
  crearSolicitud,
  movimientosDe,
  obtenerPedido,
  stockDe,
} from '../../helpers/api-setup';
import { correoUnico, unico } from '../../helpers/datos';
import { productoFactory } from '../../factories/producto.factory';
import { solicitudFactory } from '../../factories/solicitud.factory';
import { CotizarPage } from '../../page-objects/CotizarPage';
import { SolicitudesPage } from '../../page-objects/SolicitudesPage';
import { CapturaPage } from '../../page-objects/CapturaPage';
import { SeguimientoPage } from '../../page-objects/SeguimientoPage';
import { vigilarConsola } from '../../helpers/assert-consola';

const enDias = (dias: number): string => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
};

const fechaVisible = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

test.describe('Flujo de compra', () => {
  test.use({ rol: 'admin' });

  let api: APIRequestContext;

  test.beforeEach(async () => {
    api = await apiConToken(tokenDe('admin'));
  });

  test.afterEach(async () => {
    await api.dispose();
  });

  test('solicitud → cotización → pedido → pago → producción → seguimiento', async ({ page }) => {
    const consola = vigilarConsola(page);
    const sufijo = unico('flujo');
    const materia = await crearMateriaPrima(api, {
      nombre: `Lona ${sufijo}`,
      categoria: 'lona',
      unidadMedida: 'm2',
      stockActual: 100,
      stockMinimo: 5,
      costoUnitario: 50,
    });
    const producto = await crearProducto(
      api,
      productoFactory.valido({
        nombre: `Lona ${sufijo}`,
        precioBase: 220,
        receta: {
          rendimiento: 1,
          unidadRendimiento: 'm2',
          componentes: [
            {
              materiaPrimaId: materia.id,
              cantidad: 2,
              unidadMedida: 'm2',
              desperdicioPorcentaje: 10,
            },
          ],
        },
      }),
    );
    const correo = correoUnico('flujo');

    // 1. Cliente público solicita 3 m².
    const cotizar = new CotizarPage(page);
    await cotizar.goto();
    await cotizar.llenarContacto({
      nombre: `Cliente ${sufijo}`,
      correo,
      telefono: '5551234567',
      empresa: 'Empresa E2E',
    });
    await cotizar.continuar();
    await cotizar.agregarProducto(producto.nombre, 3);
    await cotizar.continuar();
    const solicitud = await cotizar.enviar('Necesito tres metros de lona impresa');
    expect(solicitud.folio).toMatch(/^SOL-/);

    // 2. Ventas convierte la solicitud en cotización desde la bandeja.
    const bandeja = new SolicitudesPage(page);
    await bandeja.goto();
    const cotizacion = await bandeja.convertirEnCotizacion(solicitud.folio);

    // 3. El cotizador muestra los totales y convierte en pedido.
    await bandeja.abrirEnCotizador();
    const captura = new CapturaPage(page);
    await captura.expectTotales({
      subtotal: cotizacion.subtotal,
      iva: cotizacion.impuestos,
      total: cotizacion.total,
      anticipo: cotizacion.anticipo,
      saldo: cotizacion.saldo,
    });
    const pedido = await captura.convertirAPedido();
    await captura.expectPedidoCreado(pedido.folio);
    await expect(page.locator('main#contenido')).toContainText(/Inventario descontado/i);
    await expect(page.locator('main#contenido')).toContainText('6.6');

    // 4. Inventario: 2 m² por pieza × 3 piezas × 10 % de desperdicio.
    const restante = await stockDe(api, materia.nombre);
    expect(restante).toBeCloseTo(100 - 6.6, 4);
    const movimientos = await movimientosDe(api, materia.id);
    expect(movimientos[0].tipo).toBe('salida');
    expect(Number(movimientos[0].cantidad)).toBeCloseTo(6.6, 4);

    // 4b. Ventas reprograma la entrega desde el detalle del pedido.
    const nuevaEntrega = enDias(20);
    const notaEntrega = 'Reprogramado por capacidad de producción.';
    await page.goto(`/detalle?pedido=${pedido.id}`);
    await page.getByRole('button', { name: /Datos de entrega/i }).click();
    await page.locator('#entrega-fecha').fill(nuevaEntrega);
    await page.locator('#entrega-nota').fill(notaEntrega);
    const [respuestaEntrega] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/pedidos/${pedido.id}/entrega`) &&
          r.request().method() === 'PATCH' &&
          r.status() === 200,
      ),
      page.getByRole('button', { name: /Confirmar entrega/i }).click(),
    ]);
    expect((await respuestaEntrega.json()).fechaEntrega).toBe(nuevaEntrega);
    await expect(page.locator('main#contenido')).toContainText(fechaVisible(nuevaEntrega));
    const reprogramado = await obtenerPedido(api, pedido.id);
    expect(reprogramado.fechaEntrega).toBe(nuevaEntrega);
    expect(reprogramado.notaEntrega).toBe(notaEntrega);
    expect(reprogramado.entregaConfirmadaPor).toBeTruthy();

    // 5. Pago del saldo y paso a producción.
    const detalle = await obtenerPedido(api, pedido.id);
    expect(detalle.ordenProduccion?.etapa).toBe('diseno');
    const pago = await api.post(`/api/pedidos/${pedido.id}/pagos`, {
      data: { tipo: 'saldo', monto: detalle.saldo },
    });
    expect(pago.status(), await pago.text()).toBe(201);
    const pagado = await obtenerPedido(api, pedido.id);
    expect(pagado.saldo).toBe(0);
    expect(pagado.estado).toBe('en-produccion');

    // 6. Producción avanza etapa por etapa hasta la última y se completa desde la UI.
    for (const etapa of ['impresion', 'corte', 'empaquetado'] as const) {
      await actualizarProduccion(api, detalle.ordenProduccion.id, {
        etapa,
        estado: 'en-proceso',
      });
    }
    await page.goto('/produccion');
    const tarjetaProduccion = page.locator('.task-card').filter({ hasText: pedido.folio });
    await expect(tarjetaProduccion).toBeVisible();
    await tarjetaProduccion.getByRole('button', { name: /Abrir orden/i }).click();
    const modalOrden = page.getByRole('dialog', { name: new RegExp(pedido.folio) });
    await expect(modalOrden).toBeVisible();
    await modalOrden.getByRole('button', { name: /Completar orden/i }).click();
    const confirmacion = page.getByRole('dialog', { name: /Completar producción/i });
    await expect(confirmacion).toBeVisible();
    await confirmacion.getByRole('button', { name: /Completar orden/i }).click();
    await expect(confirmacion).toBeHidden();
    await expect(modalOrden).toBeHidden();
    await expect(tarjetaProduccion).toHaveCount(0);
    expect((await obtenerPedido(api, pedido.id)).estado).toBe('listo');

    // 7. La bandeja de solicitudes refleja la producción completada sin perder
    // el estado histórico "Convertida".
    await bandeja.goto();
    await bandeja.buscar(solicitud.folio);
    const filaSolicitud = page.getByRole('button').filter({ hasText: solicitud.folio }).first();
    await expect(filaSolicitud).toContainText(/Producción completada/i);
    await expect(filaSolicitud).toContainText(pedido.folio);
    await bandeja.abrir(solicitud.folio);
    const detalleProduccion = page.locator('[data-testid="detalle-produccion"]');
    await expect(detalleProduccion).toContainText(pedido.folio);
    await expect(detalleProduccion).toContainText(/Producción completada/i);
    await expect(detalleProduccion).toContainText(/Empaquetado/i);
    const tarjetaCompletada = page
      .locator('.inbox-stat')
      .filter({ hasText: 'Producción completada' });
    await expect(tarjetaCompletada.locator('strong')).not.toHaveText('0');
    await page.getByRole('button', { name: 'Cerrar detalle', exact: true }).click();
    await expect(detalleProduccion).toBeHidden();
    await page.getByRole('button', { name: /^Producción completada$/ }).click();
    await expect(page.getByRole('button').filter({ hasText: solicitud.folio })).toBeVisible();

    // 8. El cliente consulta su solicitud y ve la entrega confirmada y el proceso.
    const seguimiento = new SeguimientoPage(page);
    await seguimiento.goto();
    await seguimiento.consultar(solicitud.folio, correo);
    await seguimiento.expectSolicitud(solicitud.folio);
    await seguimiento.expectEstado(/Convertida/i);
    await expect(page.locator('main#contenido')).toContainText(/COT-/i);
    const panelPedido = page.locator('[data-testid="pedido-seguimiento"]');
    await expect(panelPedido).toContainText(/Entrega confirmada por el equipo/i);
    await expect(panelPedido).toContainText(fechaVisible(nuevaEntrega));
    await expect(panelPedido).toContainText(pedido.folio);
    await expect(panelPedido).toContainText(notaEntrega);
    await expect(panelPedido).toContainText(/Empaquetado/i);
    await expect(panelPedido).toContainText(/Listo/i);
    consola.assertLimpia();
  });

  test('rechaza el pedido si falta inventario y no descuenta nada', async () => {
    const sufijo = unico('insuficiente');
    const materia = await crearMateriaPrima(api, {
      nombre: `Tinta ${sufijo}`,
      categoria: 'tinta',
      unidadMedida: 'litro',
      stockActual: 1,
      stockMinimo: 0,
      costoUnitario: 200,
    });
    const producto = await crearProducto(
      api,
      productoFactory.valido({
        nombre: `Playera ${sufijo}`,
        categoria: 'textil',
        lineaProduccion: 'textil',
        precioBase: 200,
        unidadVenta: 'pieza',
        receta: {
          rendimiento: 1,
          unidadRendimiento: 'pieza',
          componentes: [
            {
              materiaPrimaId: materia.id,
              cantidad: 10,
              unidadMedida: 'litro',
              desperdicioPorcentaje: 0,
            },
          ],
        },
      }),
    );
    const cliente = await crearCliente(api, {
      nombre: `Cliente ${sufijo}`,
      correo: correoUnico('insuficiente'),
    });

    const respuesta = await api.post('/api/pedidos', {
      data: {
        clienteId: cliente.id,
        items: [{ productoId: producto.id, cantidad: 2 }],
      },
    });
    expect(respuesta.status(), await respuesta.text()).toBe(400);
    const datos = await respuesta.json();
    expect(datos.error).toBe('Inventario insuficiente');
    expect(datos.detalles[0]).toMatchObject({
      materiaPrimaId: materia.id,
      requerido: 20,
      disponible: 1,
      faltante: 19,
    });

    expect(await stockDe(api, materia.nombre)).toBe(1);
    expect(await movimientosDe(api, materia.id)).toHaveLength(0);
  });

  test('H-12: registrar el anticipo como pagado deja el saldo restante', async () => {
    const sufijo = unico('anticipo');
    const producto = await crearProducto(
      api,
      productoFactory.valido({
        nombre: `Concepto anticipo ${sufijo}`,
        precioBase: 1000,
      }),
    );
    const cliente = await crearCliente(api, {
      nombre: `Cliente ${sufijo}`,
      correo: correoUnico('anticipo'),
    });
    const solicitud = await crearSolicitud(
      api,
      solicitudFactory.valida(
        { id: producto.id, nombre: producto.nombre },
        { correo: cliente.correo },
      ),
    );
    const cotizacion = await convertirSolicitud(api, solicitud.solicitud.id);
    const pedido = await convertirPedido(api, cotizacion.id, { anticipoPagado: true });
    expect(pedido.pagos).toHaveLength(1);
    // 2 × $1,000 + IVA = $2,320; anticipo del 50% = $1,160 y saldo restante $1,160.
    expect(pedido.saldo).toBe(1160);
    expect(pedido.pagado).toBe(1160);
    expect(pedido.estado).toBe('confirmado');
  });
});

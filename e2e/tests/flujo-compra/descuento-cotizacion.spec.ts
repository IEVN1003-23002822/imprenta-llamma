import type { APIRequestContext } from '@playwright/test';

import { test, expect } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import {
  apiConToken,
  cambiarEstadoCotizacion,
  convertirPedido,
  crearCliente,
  crearCotizacion,
  crearMateriaPrima,
  crearProducto,
  obtenerCotizacion,
  stockDe,
} from '../../helpers/api-setup';
import { correoUnico, unico } from '../../helpers/datos';
import { productoFactory } from '../../factories/producto.factory';

test.describe('Descuento de inventario en cotizaciones', () => {
  test.use({ rol: 'admin' });

  let api: APIRequestContext;

  test.beforeEach(async () => {
    api = await apiConToken(tokenDe('admin'));
  });

  test.afterEach(async () => {
    await api.dispose();
  });

  test('aprueba y convierte sin descontar dos veces', async () => {
    const sufijo = unico('doble');
    const materia = await crearMateriaPrima(api, {
      nombre: `DTF ${sufijo}`,
      categoria: 'textil',
      unidadMedida: 'm2',
      stockActual: 100,
      stockMinimo: 10,
      costoUnitario: 180,
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
              cantidad: 1.5,
              unidadMedida: 'm2',
              desperdicioPorcentaje: 10,
            },
          ],
        },
      }),
    );
    const cliente = await crearCliente(api, {
      nombre: `Cliente ${sufijo}`,
      correo: correoUnico('doble'),
    });
    const cotizacion = await crearCotizacion(api, {
      clienteId: cliente.id,
      items: [{ productoId: producto.id, cantidad: 2 }],
    });

    const aprobada = await cambiarEstadoCotizacion(api, cotizacion.id, 'aprobada');
    expect(aprobada.inventarioDescontado).toBe(true);
    expect(aprobada.descuento.descontados[0].cantidad).toBeCloseTo(3.3, 4);
    expect(aprobada.descuento.descontados[0].stock_restante).toBeCloseTo(96.7, 4);
    expect(await stockDe(api, materia.nombre)).toBeCloseTo(96.7, 4);

    const pedido = await convertirPedido(api, cotizacion.id);
    expect(pedido.inventarioDescontado).toBe(true);
    expect(await stockDe(api, materia.nombre)).toBeCloseTo(96.7, 4);

    const detalle = await obtenerCotizacion(api, cotizacion.id);
    expect(detalle.inventarioDescontado).toBe(true);
  });

  test('aprueba desde el cotizador y muestra el resumen de descuento', async ({ page }) => {
    const sufijo = unico('ui-aprobacion');
    const materia = await crearMateriaPrima(api, {
      nombre: `Vinil ${sufijo}`,
      categoria: 'vinil',
      unidadMedida: 'm2',
      stockActual: 10,
      stockMinimo: 1,
      costoUnitario: 90,
    });
    const producto = await crearProducto(
      api,
      productoFactory.valido({
        nombre: `Vinil ${sufijo}`,
        precioBase: 500,
        unidadVenta: 'm2',
        receta: {
          rendimiento: 1,
          unidadRendimiento: 'm2',
          componentes: [
            {
              materiaPrimaId: materia.id,
              cantidad: 1,
              unidadMedida: 'm2',
              desperdicioPorcentaje: 0,
            },
          ],
        },
      }),
    );
    const cliente = await crearCliente(api, {
      nombre: `Cliente ${sufijo}`,
      correo: correoUnico('ui-aprobacion'),
    });
    const cotizacion = await crearCotizacion(api, {
      clienteId: cliente.id,
      items: [{ productoId: producto.id, cantidad: 1 }],
    });

    await page.goto(`/captura?cotizacion=${cotizacion.id}`);
    await page.getByRole('button', { name: /Aprobar cotización/i }).click();
    await expect(page.getByText(/Inventario descontado/i)).toBeVisible();
    await expect(page.locator('main#contenido')).toContainText(materia.nombre);
    expect(await stockDe(api, materia.nombre)).toBeCloseTo(9, 4);

    await expect(page.getByRole('button', { name: /Aprobar cotización/i })).toHaveCount(0);
    await page.getByRole('button', { name: /Convertir en pedido/i }).click();
    await expect(page.getByText(/ya se había descontado/i)).toBeVisible();
    expect(await stockDe(api, materia.nombre)).toBeCloseTo(9, 4);
  });

  test('vincula la partida por nombre cuando falta productoId', async () => {
    const sufijo = unico('nombre');
    const materia = await crearMateriaPrima(api, {
      nombre: `Vinil ${sufijo}`,
      categoria: 'vinil',
      unidadMedida: 'm2',
      stockActual: 50,
      stockMinimo: 5,
      costoUnitario: 90,
    });
    const producto = await crearProducto(
      api,
      productoFactory.valido({
        nombre: `Vinil ${sufijo}`,
        precioBase: 300,
        unidadVenta: 'm2',
        receta: {
          rendimiento: 1,
          unidadRendimiento: 'm2',
          componentes: [
            {
              materiaPrimaId: materia.id,
              cantidad: 1,
              unidadMedida: 'm2',
              desperdicioPorcentaje: 0,
            },
          ],
        },
      }),
    );
    const cliente = await crearCliente(api, {
      nombre: `Cliente ${sufijo}`,
      correo: correoUnico('nombre'),
    });
    const cotizacion = await crearCotizacion(api, {
      clienteId: cliente.id,
      items: [{ descripcion: producto.nombre, cantidad: 1, precioEstimado: 300 }],
    });
    expect(cotizacion.items[0].productoId).toBeNull();

    await cambiarEstadoCotizacion(api, cotizacion.id, 'aprobada');
    expect(await stockDe(api, materia.nombre)).toBeCloseTo(49, 4);
    const detalle = await obtenerCotizacion(api, cotizacion.id);
    expect(detalle.items[0].productoId).toBe(producto.id);
  });

  test('bloquea la aprobación y la UI si falta stock', async ({ page }) => {
    const sufijo = unico('bloqueo');
    const materia = await crearMateriaPrima(api, {
      nombre: `DTF ${sufijo}`,
      categoria: 'textil',
      unidadMedida: 'm2',
      stockActual: 1,
      stockMinimo: 0,
      costoUnitario: 180,
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
              unidadMedida: 'm2',
              desperdicioPorcentaje: 0,
            },
          ],
        },
      }),
    );
    const cliente = await crearCliente(api, {
      nombre: `Cliente ${sufijo}`,
      correo: correoUnico('bloqueo'),
    });
    const cotizacion = await crearCotizacion(api, {
      clienteId: cliente.id,
      items: [{ productoId: producto.id, cantidad: 1 }],
    });

    const rechazada = await api.patch(`/api/cotizaciones/${cotizacion.id}/estado`, {
      data: { estado: 'aprobada' },
    });
    expect(rechazada.status()).toBe(400);
    const cuerpo = await rechazada.json();
    expect(cuerpo.error).toBe('Inventario insuficiente');
    expect(cuerpo.mensaje).toContain(`Stock insuficiente de DTF ${sufijo}`);
    expect(cuerpo.mensaje).toContain(`Playera ${sufijo}`);
    expect(await stockDe(api, materia.nombre)).toBe(1);

    await page.goto(`/captura?cotizacion=${cotizacion.id}`);
    await expect(page.getByRole('button', { name: /Convertir en pedido/i })).toBeVisible();
    await page.getByRole('button', { name: /Convertir en pedido/i }).click();
    await expect(page.getByRole('alert')).toContainText(`Stock insuficiente de DTF ${sufijo}`);
    expect(await stockDe(api, materia.nombre)).toBe(1);
  });
});

import type { APIRequestContext } from '@playwright/test';

import { test, expect } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import { apiConToken, crearCliente, crearPedido, crearProducto } from '../../helpers/api-setup';
import { correoUnico, unico } from '../../helpers/datos';
import { productoFactory } from '../../factories/producto.factory';

test.describe('Pagos — regresión H-06', () => {
  test.use({ rol: 'admin' });

  test('rechaza un pago mayor al saldo pendiente', async () => {
    const api: APIRequestContext = await apiConToken(tokenDe('admin'));
    const sufijo = unico('pago');
    const producto = await crearProducto(
      api,
      productoFactory.valido({ nombre: `Servicio ${sufijo}`, precioBase: 100 }),
    );
    const cliente = await crearCliente(api, {
      nombre: `Cliente ${sufijo}`,
      correo: correoUnico('pago'),
    });
    const pedido = await crearPedido(api, {
      clienteId: cliente.id,
      items: [{ productoId: producto.id, cantidad: 1 }],
    });
    expect(pedido.saldo).toBe(116);

    const excedido = await api.post(`/api/pedidos/${pedido.id}/pagos`, {
      data: { tipo: 'abono', monto: 117 },
    });
    expect(excedido.status(), await excedido.text()).toBe(400);

    const correcto = await api.post(`/api/pedidos/${pedido.id}/pagos`, {
      data: { tipo: 'saldo', monto: 116 },
    });
    expect(correcto.status()).toBe(201);
    const detalle = await api.get(`/api/pedidos/${pedido.id}`);
    expect((await detalle.json()).saldo).toBe(0);
    await api.dispose();
  });

  test('el detalle calcula el saldo con los pagos y liquida con centavos', async ({ page }) => {
    const api: APIRequestContext = await apiConToken(tokenDe('admin'));
    const sufijo = unico('detalle');
    const producto = await crearProducto(
      api,
      productoFactory.valido({ nombre: `Servicio detalle ${sufijo}`, precioBase: 220 }),
    );
    const cliente = await crearCliente(api, {
      nombre: `Cliente detalle ${sufijo}`,
      correo: correoUnico('detalle'),
    });
    const pedido = await crearPedido(api, {
      clienteId: cliente.id,
      items: [{ productoId: producto.id, cantidad: 3 }],
    });
    // 3 × $220 = $660 + IVA = $765.60; sin pagos se debe el total.
    expect(pedido.total).toBe(765.6);
    expect(pedido.saldo).toBe(765.6);

    const abono = await api.post(`/api/pedidos/${pedido.id}/pagos`, {
      data: { tipo: 'abono', monto: 382 },
    });
    expect(abono.status(), await abono.text()).toBe(201);
    expect((await abono.json()).pedido.saldo).toBe(383.6);

    await page.goto(`/detalle?pedido=${pedido.id}`);
    await expect(page.locator('main#contenido')).toContainText('Saldo pendiente');
    await expect(page.locator('main#contenido')).toContainText('$383.60');
    await expect(page.locator('main#contenido')).toContainText('$382.00');

    await page.getByRole('button', { name: /Registrar pago/i }).click();
    await expect(page.locator('#pago-monto')).toHaveValue('383.6');

    await page.locator('#pago-tipo').selectOption('saldo');
    await expect(page.locator('#pago-monto')).toHaveValue('383.6');

    const [respuesta] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/pedidos/${pedido.id}/pagos`) &&
          r.request().method() === 'POST' &&
          r.status() === 201,
      ),
      page.getByRole('button', { name: /Confirmar pago/i }).click(),
    ]);
    expect(respuesta.status()).toBe(201);

    await expect(page.locator('main#contenido')).toContainText(/Pedido liquidado/i);
    await expect(page.locator('main#contenido')).toContainText('$0.00');
    await expect(page.locator('main#contenido')).toContainText('$765.60');
    await api.dispose();
  });
});

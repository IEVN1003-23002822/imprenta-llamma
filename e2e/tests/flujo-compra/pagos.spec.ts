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
    expect(pedido.saldo).toBe(58);

    const excedido = await api.post(`/api/pedidos/${pedido.id}/pagos`, {
      data: { tipo: 'abono', monto: 59 },
    });
    expect(excedido.status(), await excedido.text()).toBe(400);

    const correcto = await api.post(`/api/pedidos/${pedido.id}/pagos`, {
      data: { tipo: 'saldo', monto: 58 },
    });
    expect(correcto.status()).toBe(201);
    const detalle = await api.get(`/api/pedidos/${pedido.id}`);
    expect((await detalle.json()).saldo).toBe(0);
    await api.dispose();
  });
});

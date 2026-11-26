import { test, expect } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import { apiConToken, crearCliente, crearPedido, crearProducto } from '../../helpers/api-setup';
import { correoUnico, unico } from '../../helpers/datos';
import { productoFactory } from '../../factories/producto.factory';

test.describe('Consultas — pedidos entregados', () => {
  test.use({ rol: 'admin' });

  test('filtra por estado entregado y muestra el pedido', async ({ page }) => {
    const api = await apiConToken(tokenDe('admin'));
    const cliente = await crearCliente(api, {
      nombre: `Cliente consulta ${unico('e2e')}`,
      correo: correoUnico('consulta'),
    });
    const producto = await crearProducto(
      api,
      productoFactory.valido({
        nombre: `Producto consulta ${unico('e2e')}`,
        lineaProduccion: 'gran-formato',
        categoria: 'display',
        precioBase: 100,
        unidadVenta: 'pieza',
      }),
    );
    const pedido = await crearPedido(api, {
      clienteId: cliente.id,
      items: [{ productoId: producto.id, cantidad: 1 }],
    });
    const entregado = await api.patch(`/api/pedidos/${pedido.id}/estado`, {
      data: { estado: 'entregado' },
    });
    expect(entregado.status(), await entregado.text()).toBe(200);

    await page.goto('/consultas');
    await expect(page.locator('#consultaEstado option[value="entregado"]')).toBeAttached();
    await page.locator('#consultaEstado').selectOption('entregado');
    await page.locator('#consultaTexto').fill(pedido.folio);
    await page.getByRole('button', { name: /Filtrar/i }).click();

    const fila = page.getByRole('row').filter({ hasText: pedido.folio });
    await expect(fila).toBeVisible();
    await expect(fila).toContainText(/Entregado/i);

    await api.dispose();
  });
});

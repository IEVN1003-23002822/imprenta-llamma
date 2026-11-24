import type { APIRequestContext } from '@playwright/test';

import { test, expect } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import {
  apiConToken,
  crearCliente,
  crearMateriaPrima,
  crearPedido,
  crearProducto,
  movimientosDe,
  stockDe,
} from '../../helpers/api-setup';
import { correoUnico, unico } from '../../helpers/datos';
import { productoFactory } from '../../factories/producto.factory';

test.describe('Inventario — descuento por pedido', () => {
  test.use({ rol: 'admin' });

  test('descuenta la receta y registra el movimiento de salida', async () => {
    const api: APIRequestContext = await apiConToken(tokenDe('admin'));
    const sufijo = unico('inventario');
    const materia = await crearMateriaPrima(api, {
      nombre: `Vinil ${sufijo}`,
      categoria: 'vinil',
      unidadMedida: 'm2',
      stockActual: 50,
      stockMinimo: 2,
      costoUnitario: 80,
    });
    const producto = await crearProducto(
      api,
      productoFactory.valido({
        nombre: `Vinil ${sufijo}`,
        categoria: 'gran-formato',
        lineaProduccion: 'gran-formato',
        precioBase: 300,
        receta: {
          rendimiento: 1,
          unidadRendimiento: 'm2',
          componentes: [
            {
              materiaPrimaId: materia.id,
              cantidad: 1.5,
              unidadMedida: 'm2',
              desperdicioPorcentaje: 20,
            },
          ],
        },
      }),
    );
    const cliente = await crearCliente(api, {
      nombre: `Cliente ${sufijo}`,
      correo: correoUnico('inventario'),
    });

    await crearPedido(api, {
      clienteId: cliente.id,
      items: [{ productoId: producto.id, cantidad: 2 }],
    });

    // 1.5 × 2 × 1.20 = 3.6
    expect(await stockDe(api, materia.nombre)).toBeCloseTo(46.4, 4);
    const movimientos = await movimientosDe(api, materia.id);
    expect(movimientos[0].tipo).toBe('salida');
    expect(Number(movimientos[0].cantidad)).toBeCloseTo(3.6, 4);
    await api.dispose();
  });
});

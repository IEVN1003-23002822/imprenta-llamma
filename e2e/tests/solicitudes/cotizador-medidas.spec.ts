import type { APIRequestContext } from '@playwright/test';

import { test, expect } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import {
  apiConToken,
  cambiarEstadoCotizacion,
  convertirSolicitud,
  crearMateriaPrima,
  crearProducto,
  obtenerSolicitud,
  stockDe,
} from '../../helpers/api-setup';
import { correoUnico, unico } from '../../helpers/datos';
import { productoFactory } from '../../factories/producto.factory';
import { CotizarPage } from '../../page-objects/CotizarPage';

test.describe('Cotizador dinámico por medidas', () => {
  test.use({ rol: 'admin' });

  let api: APIRequestContext;

  test.beforeEach(async () => {
    api = await apiConToken(tokenDe('admin'));
  });

  test.afterEach(async () => {
    await api.dispose();
  });

  test('convierte 10 × 10 cm en 0.01 m² y descuenta esa cantidad', async ({ page }) => {
    const sufijo = unico('medidas');
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

    const cotizar = new CotizarPage(page);
    await cotizar.goto();
    await cotizar.llenarContacto({
      nombre: `Cliente ${sufijo}`,
      correo: correoUnico('medidas'),
      telefono: '5551234567',
    });
    await cotizar.continuar();
    await cotizar.agregarProductoConMedidas(producto.nombre, 0.1, 0.1);
    await expect(page.locator('main#contenido')).toContainText('0.01 m²');
    await cotizar.continuar();
    const solicitud = await cotizar.enviar('Necesito un estampado de diez por diez centímetros');

    const detalle = await obtenerSolicitud(api, solicitud.solicitud.id);
    expect(detalle.itemsSolicitados[0].cantidad).toBeCloseTo(0.01, 4);

    const cotizacion = await convertirSolicitud(api, solicitud.solicitud.id);
    expect(cotizacion.items[0].cantidad).toBeCloseTo(0.01, 4);
    const aprobada = await cambiarEstadoCotizacion(api, cotizacion.id, 'aprobada');
    expect(aprobada.inventarioDescontado).toBe(true);
    expect(aprobada.descuento.descontados[0].cantidad).toBeCloseTo(0.01, 4);
    expect(await stockDe(api, materia.nombre)).toBeCloseTo(9.99, 4);
  });
});

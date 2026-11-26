import type { APIRequestContext } from '@playwright/test';

import { test, expect } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import {
  apiConToken,
  crearCliente,
  crearSolicitud,
  obtenerSolicitud,
} from '../../helpers/api-setup';
import { correoUnico, unico } from '../../helpers/datos';
import { solicitudFactory } from '../../factories/solicitud.factory';
import { SolicitudesPage } from '../../page-objects/SolicitudesPage';
import { CapturaPage } from '../../page-objects/CapturaPage';
import { vigilarConsola } from '../../helpers/assert-consola';

test.describe('Cotizaciones', () => {
  test.use({ rol: 'admin' });

  let api: APIRequestContext;

  test.beforeEach(async () => {
    api = await apiConToken(tokenDe('admin'));
  });

  test.afterEach(async () => {
    await api.dispose();
  });

  test('convierte una solicitud en cotización y conserva los totales', async ({ page }) => {
    const consola = vigilarConsola(page);
    const catalogo = await api.get('/api/productos');
    const productos = (await catalogo.json()).items as Array<Record<string, any>>;
    const lona = productos.find((producto) => producto.nombre === 'Lona/Vinil');
    expect(lona).toBeTruthy();

    const solicitud = await crearSolicitud(
      api,
      solicitudFactory.valida(
        { id: lona!.id, nombre: lona!.nombre },
        { correo: correoUnico('cot') },
      ),
    );

    const bandeja = new SolicitudesPage(page);
    await bandeja.goto();
    const cotizacion = await bandeja.convertirEnCotizacion(solicitud.folio);

    expect(cotizacion.folio).toMatch(/^COT-\d{4}-\d{3}$/);
    expect(cotizacion.subtotal).toBe(440);
    expect(cotizacion.impuestos).toBe(70.4);
    expect(cotizacion.total).toBe(510.4);
    expect(cotizacion.anticipo).toBe(255.2);
    expect(cotizacion.saldo).toBe(255.2);

    const actualizada = await obtenerSolicitud(api, solicitud.solicitud.id);
    expect(actualizada.estado).toBe('cotizada');
    expect(actualizada.cotizacionId).toBe(cotizacion.id);

    await bandeja.abrirEnCotizador();
    const captura = new CapturaPage(page);
    await captura.expectTotales({
      subtotal: 440,
      iva: 70.4,
      total: 510.4,
      anticipo: 255.2,
      saldo: 255.2,
    });
    consola.assertLimpia();
  });

  test('crea una cotización manual en el cotizador interno', async ({ page }) => {
    const captura = new CapturaPage(page);
    await page.goto('/captura');
    await expect(page.locator('.quote-summary')).toBeVisible();

    await captura.llenarCliente(`Cliente ${unico('e2e')}`, correoUnico('manual'));
    await captura.agregarPartida(2, 500);
    await captura.expectTotales({
      subtotal: 1000,
      iva: 160,
      total: 1160,
      anticipo: 580,
      saldo: 580,
    });
    await captura.guardarCotizacion();

    const lista = await api.get('/api/cotizaciones?perPage=50');
    expect(lista.status()).toBe(200);
    const items = (await lista.json()).items as Array<Record<string, any>>;
    const creada = items.find((item) => item.subtotal === 1000);
    expect(creada).toBeTruthy();
    expect(creada!.total).toBe(1160);
  });

  test('calcula precios: unitario, precio base y precio estimado', async () => {
    const cliente = await crearCliente(api, {
      nombre: `Cliente ${unico('e2e')}`,
      correo: correoUnico('totales'),
    });
    const productos = await api.get('/api/productos');
    const catalogo = (await productos.json()).items as Array<Record<string, any>>;
    const lona = catalogo.find((producto) => producto.nombre === 'Lona/Vinil');
    expect(lona).toBeTruthy();

    const casos = [
      {
        items: [{ productoId: lona!.id, cantidad: 10, precioUnitario: 100 }],
        subtotal: 1000,
        total: 1160,
      },
      {
        items: [{ productoId: lona!.id, cantidad: 2 }],
        subtotal: 440,
        total: 510.4,
      },
      {
        items: [{ cantidad: 2, precioEstimado: 300, descripcion: 'Concepto libre' }],
        subtotal: 600,
        total: 696,
      },
    ];

    for (const caso of casos) {
      const respuesta = await api.post('/api/cotizaciones', {
        data: { clienteId: cliente.id, items: caso.items },
      });
      expect(respuesta.status(), await respuesta.text()).toBe(201);
      const cotizacion = await respuesta.json();
      expect(cotizacion.subtotal).toBe(caso.subtotal);
      expect(cotizacion.impuestos).toBeCloseTo(caso.subtotal * 0.16, 2);
      expect(cotizacion.total).toBeCloseTo(caso.total, 2);
      expect(cotizacion.anticipo).toBeCloseTo(caso.total * 0.5, 2);
      expect(cotizacion.saldo).toBeCloseTo(caso.total * 0.5, 2);
    }
  });
});

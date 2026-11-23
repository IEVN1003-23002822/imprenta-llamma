import type { APIRequestContext } from '@playwright/test';

import { test, expect } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import { apiConToken, crearSolicitud, obtenerSolicitud } from '../../helpers/api-setup';
import { correoUnico, unico } from '../../helpers/datos';
import { vigilarConsola } from '../../helpers/assert-consola';
import { CotizarPage } from '../../page-objects/CotizarPage';
import { SeguimientoPage } from '../../page-objects/SeguimientoPage';

test.describe('Solicitudes públicas', () => {
  test.use({ rol: 'anonimo' });

  test('crea una solicitud desde el formulario público', async ({ page }) => {
    const consola = vigilarConsola(page);
    const cotizar = new CotizarPage(page);
    const correo = correoUnico('publico');

    await cotizar.goto();
    await cotizar.llenarContacto({
      nombre: `Cliente ${unico('e2e')}`,
      correo,
      telefono: '5551234567',
      empresa: 'Empresa E2E',
    });
    await cotizar.continuar();
    await cotizar.agregarProducto('Lona Frontlit impresa', 2);
    await cotizar.continuar();
    const respuesta = await cotizar.enviar('Necesito dos lonas impresas');

    expect(respuesta.folio).toMatch(/^SOL-\d{4}-\d{3}$/);
    await cotizar.expectComprobante(respuesta.folio);

    const api = await apiConToken(tokenDe('admin'));
    const solicitud = await obtenerSolicitud(api, respuesta.solicitud.id);
    expect(solicitud.correo).toBe(correo);
    expect(solicitud.itemsSolicitados[0].nombreProducto).toBe('Lona Frontlit impresa');
    await api.dispose();
    consola.assertLimpia();
  });

  test('adjunta un PDF y el administrador puede descargarlo', async ({ page }) => {
    const cotizar = new CotizarPage(page);
    const correo = correoUnico('adjunto');

    await cotizar.goto();
    await cotizar.llenarContacto({
      nombre: `Cliente ${unico('e2e')}`,
      correo,
      telefono: '5551234567',
    });
    await cotizar.continuar();
    await cotizar.agregarProducto('Lona Frontlit impresa', 1);
    await cotizar.continuar();
    await cotizar.adjuntar('brief.pdf', '%PDF-1.4\nprueba e2e\n', 'application/pdf');
    const respuesta = await cotizar.enviar('Adjunto mi brief para revisar medidas');

    const api = await apiConToken(tokenDe('admin'));
    const solicitud = await obtenerSolicitud(api, respuesta.solicitud.id);
    expect(solicitud.archivosAdjuntos).toHaveLength(1);
    expect(solicitud.archivosAdjuntos[0].nombreOriginal).toBe('brief.pdf');

    const descarga = await api.get(`/api/archivos/${solicitud.archivosAdjuntos[0].id}`);
    expect(descarga.status()).toBe(200);
    expect((await descarga.body()).toString()).toContain('%PDF-1.4');
    await api.dispose();
  });

  test('el seguimiento muestra la solicitud con folio y correo correctos', async ({ page }) => {
    const api = await apiConToken(tokenDe('admin'));
    const correo = correoUnico('seguimiento');
    const creada = await crearSolicitud(api, {
      nombre: `Cliente ${unico('e2e')}`,
      correo,
      mensaje: 'Seguimiento E2E',
      items: [{ productoId: null, nombreProducto: 'Lona especial', cantidad: 3 }],
    });
    await api.dispose();

    const consola = vigilarConsola(page);
    const seguimiento = new SeguimientoPage(page);
    await seguimiento.goto();
    await seguimiento.consultar(creada.folio, correo);
    await seguimiento.expectSolicitud(creada.folio);
    await seguimiento.expectEstado(/Nueva/i);
    await expect(page.locator('main#contenido')).toContainText('Lona especial');
    consola.assertLimpia();
  });

  test('rechaza correo ajeno y folio inexistente sin revelar datos', async ({ page }) => {
    const api = await apiConToken(tokenDe('admin'));
    const correo = correoUnico('privado');
    const creada = await crearSolicitud(api, {
      nombre: `Cliente ${unico('e2e')}`,
      correo,
      mensaje: 'No debe filtrarse',
    });
    await api.dispose();

    const seguimiento = new SeguimientoPage(page);
    await seguimiento.goto();
    await seguimiento.consultar(creada.folio, 'otro@example.com');
    await seguimiento.expectError(/no encontrada|no encontramos/i);
    await expect(page.locator('main#contenido')).not.toContainText('No debe filtrarse');

    await seguimiento.goto();
    await seguimiento.consultar('SOL-1999-999', correo);
    await seguimiento.expectError(/no encontrada|no encontramos/i);
  });
});

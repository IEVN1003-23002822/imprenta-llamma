import type { APIRequestContext } from '@playwright/test';
import { request as playwrightRequest } from '@playwright/test';

import { test, expect } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import { API_URL, apiConToken, crearSolicitud, obtenerSolicitud } from '../../helpers/api-setup';
import { correoUnico, unico } from '../../helpers/datos';
import { vigilarConsola } from '../../helpers/assert-consola';
import { CotizarPage } from '../../page-objects/CotizarPage';
import { SeguimientoPage } from '../../page-objects/SeguimientoPage';
import {
  MENSAJE_FECHA_MINIMA,
  aFechaIso,
  calcularFechaMinimaEntrega,
} from '../../../src/app/core/utils/fechas';

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
    await cotizar.agregarProducto('Lona/Vinil', 2);
    await cotizar.continuar();
    const respuesta = await cotizar.enviar('Necesito dos lonas impresas');

    expect(respuesta.folio).toMatch(/^SOL-\d{4}-\d{3}$/);
    await cotizar.expectComprobante(respuesta.folio);

    const api = await apiConToken(tokenDe('admin'));
    const solicitud = await obtenerSolicitud(api, respuesta.solicitud.id);
    expect(solicitud.correo).toBe(correo);
    expect(solicitud.itemsSolicitados[0].nombreProducto).toBe('Lona/Vinil');
    await api.dispose();
    consola.assertLimpia();
  });

  test('bloquea solicitudes sin partidas o con importe cero', async ({ page }) => {
    const cotizar = new CotizarPage(page);
    const peticiones: string[] = [];
    page.on('request', (peticion) => {
      if (
        peticion.method() === 'POST' &&
        new URL(peticion.url()).pathname === '/api/public/solicitudes'
      ) {
        peticiones.push(peticion.url());
      }
    });

    await cotizar.goto();
    await cotizar.llenarContacto({
      nombre: `Cliente ${unico('vacio')}`,
      correo: correoUnico('vacio'),
      telefono: '5551234567',
    });
    await cotizar.continuar();
    await cotizar.continuar();
    await page.locator('#cotMensaje').fill('Quiero cotizar un proyecto con un mensaje largo.');

    const enviar = page.getByRole('button', { name: /Enviar solicitud de cotización/i });
    await expect(enviar).toBeDisabled();
    await expect(page.locator('main#contenido')).toContainText(
      /Agrega al menos un producto con cantidad y precio mayor a cero/i,
    );
    expect(peticiones, 'El frontend no debe llamar a la API sin partidas').toEqual([]);

    const api = await playwrightRequest.newContext({ baseURL: API_URL });
    const sinItems = await api.post('/api/public/solicitudes', {
      data: {
        nombre: 'Cliente API vacío',
        correo: correoUnico('api-vacio'),
        mensaje: 'Mensaje suficientemente largo sin partidas',
      },
    });
    expect(sinItems.status()).toBe(400);
    expect((await sinItems.json()).codigo).toBe('sin_partidas');

    const precioCero = await api.post('/api/public/solicitudes', {
      data: {
        nombre: 'Cliente API cero',
        correo: correoUnico('api-cero'),
        mensaje: 'Mensaje suficientemente largo con precio cero',
        items: [
          {
            productoId: null,
            nombreProducto: 'Diseño especial',
            cantidad: 1,
            precioEstimado: 0,
          },
        ],
      },
    });
    expect(precioCero.status()).toBe(400);
    expect((await precioCero.json()).codigo).toBe('precio_invalido');
    await api.dispose();
  });

  test('bloquea fechas menores al margen de 2 días hábiles', async ({ page }) => {
    const cotizar = new CotizarPage(page);
    const hoy = new Date();
    const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
    const invalida = aFechaIso(ayer);
    const peticiones: string[] = [];
    page.on('request', (peticion) => {
      if (
        peticion.method() === 'POST' &&
        new URL(peticion.url()).pathname === '/api/public/solicitudes'
      ) {
        peticiones.push(peticion.url());
      }
    });

    await cotizar.goto();
    await cotizar.llenarContacto({
      nombre: `Cliente ${unico('e2e')}`,
      correo: correoUnico('fecha-invalida'),
      telefono: '5551234567',
    });
    await cotizar.fechaDeseada(invalida);
    await cotizar.continuar();
    await cotizar.agregarProducto('Lona/Vinil', 1);
    await cotizar.continuar();
    await page.locator('#cotMensaje').fill('Quiero una entrega urgente para mi proyecto');
    await page.getByRole('button', { name: /Enviar solicitud de cotización/i }).click();

    await expect(page.locator('main#contenido')).toContainText(MENSAJE_FECHA_MINIMA);
    expect(peticiones, 'El frontend no debe llamar a la API con fecha inválida').toEqual([]);

    const api = await playwrightRequest.newContext({ baseURL: API_URL });
    const respuesta = await api.post('/api/public/solicitudes', {
      data: {
        nombre: 'Cliente Fecha Inválida',
        correo: correoUnico('fecha-backend'),
        mensaje: 'Intento con fecha inválida',
        fechaDeseada: invalida,
      },
    });
    expect(respuesta.status()).toBe(400);
    expect((await respuesta.json()).error).toBe(MENSAJE_FECHA_MINIMA);
    await api.dispose();
  });

  test('acepta la fecha mínima calculada y muestra la cláusula', async ({ page }) => {
    const cotizar = new CotizarPage(page);
    const minima = calcularFechaMinimaEntrega();

    await cotizar.goto();
    await expect(page.locator('#cotFechaAyuda')).toContainText(/2 días hábiles/i);
    await expect(page.locator('#cotFecha')).toHaveAttribute('min', minima);
    await cotizar.llenarContacto({
      nombre: `Cliente ${unico('e2e')}`,
      correo: correoUnico('fecha-valida'),
      telefono: '5551234567',
    });
    await cotizar.fechaDeseada(minima);
    await cotizar.continuar();
    await cotizar.agregarProducto('Lona/Vinil', 1);
    await cotizar.continuar();
    const respuesta = await cotizar.enviar('Quiero entrega en la fecha mínima permitida');

    await cotizar.expectComprobante(respuesta.folio);
    const api = await apiConToken(tokenDe('admin'));
    const solicitud = await obtenerSolicitud(api, respuesta.solicitud.id);
    expect(solicitud.fechaDeseada).toBe(minima);
    await api.dispose();
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
    await cotizar.agregarProducto('Lona/Vinil', 1);
    await cotizar.continuar();
    await cotizar.adjuntar('brief.pdf', '%PDF-1.4\nprueba e2e\n', 'application/pdf');
    const chipPdf = page.locator('.file-chip').filter({ hasText: 'brief.pdf' });
    await expect(chipPdf).toBeVisible();
    await expect(chipPdf.locator('.file-chip-thumb')).toHaveCount(0);
    await expect(chipPdf.locator('.bi-paperclip')).toBeVisible();
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

  test('muestra miniatura de una imagen adjunta y permite quitarla', async ({ page }) => {
    const cotizar = new CotizarPage(page);
    await cotizar.goto();
    await cotizar.llenarContacto({
      nombre: `Cliente ${unico('miniatura')}`,
      correo: correoUnico('miniatura'),
      telefono: '5551234567',
    });
    await cotizar.continuar();
    await cotizar.agregarProducto('Lona/Vinil', 1);
    await cotizar.continuar();

    const base64 = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 80;
      canvas.height = 80;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.fillStyle = '#00aeef';
      ctx.fillRect(0, 0, 80, 80);
      ctx.fillStyle = '#ec008c';
      ctx.fillRect(20, 20, 40, 40);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.locator('#cotArchivos').setInputFiles({
      name: 'referencia.png',
      mimeType: 'image/png',
      buffer: Buffer.from(base64, 'base64'),
    });

    const chip = page.locator('.file-chip').filter({ hasText: 'referencia.png' });
    await expect(chip).toBeVisible();
    const miniatura = chip.locator('.file-chip-thumb');
    await expect(miniatura).toBeVisible();
    await expect
      .poll(() => miniatura.evaluate((imagen) => (imagen as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);

    await chip.getByRole('button', { name: /Quitar referencia\.png/i }).click();
    await expect(page.locator('.file-chip').filter({ hasText: 'referencia.png' })).toHaveCount(0);
    await expect(page.locator('.file-chip-thumb')).toHaveCount(0);
  });

  test('el seguimiento muestra la solicitud con folio y correo correctos', async ({ page }) => {
    const api = await apiConToken(tokenDe('admin'));
    const correo = correoUnico('seguimiento');
    const creada = await crearSolicitud(api, {
      nombre: `Cliente ${unico('e2e')}`,
      correo,
      mensaje: 'Seguimiento E2E',
      items: [
        {
          productoId: null,
          nombreProducto: 'Lona especial',
          cantidad: 3,
          precioEstimado: 300,
        },
      ],
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
      items: [
        {
          productoId: null,
          nombreProducto: 'Consulta privada',
          cantidad: 1,
          precioEstimado: 100,
        },
      ],
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

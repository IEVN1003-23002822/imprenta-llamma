import type { APIRequestContext } from '@playwright/test';

import { test, expect } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import { apiConToken, crearProducto, obtenerProducto } from '../../helpers/api-setup';
import { vigilarConsola } from '../../helpers/assert-consola';
import { productoFactory, productoInvalido } from '../../factories/producto.factory';
import { ProductosPage } from '../../page-objects/ProductosPage';

test.describe('Productos — edición interna', () => {
  test.use({ rol: 'admin' });

  let api: APIRequestContext;

  test.beforeEach(async () => {
    api = await apiConToken(tokenDe('admin'));
  });

  test.afterEach(async () => {
    await api.dispose();
  });

  test('edita el precio y se refleja en el catálogo público', async ({ page }) => {
    const consola = vigilarConsola(page);
    const producto = await crearProducto(
      api,
      productoFactory.valido({ precioBase: 220, unidadVenta: 'm2' }),
    );

    const catalogo = new ProductosPage(page);
    await catalogo.goto();
    await catalogo.abrirGestion();
    await catalogo.cambiarPrecio(producto.nombre, 250);
    await catalogo.cerrar();

    expect((await obtenerProducto(api, producto.id)).precioBase).toBe(250);
    await catalogo.expectTarjetaPublica(producto.nombre, '$250');
    consola.assertLimpia();
  });

  test('edita la descripción y se refleja en el catálogo público', async ({ page }) => {
    const producto = await crearProducto(api, productoFactory.valido());
    const nueva = `Descripción E2E ${Date.now()}`;

    const catalogo = new ProductosPage(page);
    await catalogo.goto();
    await catalogo.abrirGestion();
    await catalogo.cambiarDescripcion(producto.nombre, nueva);
    await catalogo.cerrar();

    expect((await obtenerProducto(api, producto.id)).descripcion).toBe(nueva);
    await catalogo.expectTarjetaPublica(producto.nombre, nueva);
  });

  test('edita la imagen y el catálogo público usa la nueva ruta', async ({ page }) => {
    const producto = await crearProducto(api, productoFactory.valido({ imagenUrl: '' }));
    const imagen = '/assets/images/catalogo/textil/playera-dtf-29x29.webp';

    const catalogo = new ProductosPage(page);
    await catalogo.goto();
    await catalogo.abrirGestion();
    await catalogo.cambiarImagen(producto.nombre, imagen);
    await catalogo.cerrar();

    expect((await obtenerProducto(api, producto.id)).imagenUrl).toBe(imagen);
    await catalogo.expectTarjetaPublica(producto.nombre);
    await expect(page.locator(`article img[src="${imagen}"]`)).toBeVisible();
  });

  test('despublica y vuelve a publicar un producto', async ({ page }) => {
    const producto = await crearProducto(api, productoFactory.valido({ publicado: true }));

    const catalogo = new ProductosPage(page);
    await catalogo.goto();
    await catalogo.abrirGestion();
    await catalogo.alternarPublicado(producto.nombre);
    await catalogo.cerrar();

    expect((await obtenerProducto(api, producto.id)).publicado).toBe(false);
    await page.goto('/productos');
    await expect(catalogo.tarjetaPublica(producto.nombre)).toHaveCount(0);

    await catalogo.goto();
    await catalogo.abrirGestion();
    await catalogo.alternarPublicado(producto.nombre);
    await catalogo.cerrar();
    expect((await obtenerProducto(api, producto.id)).publicado).toBe(true);
    await catalogo.expectTarjetaPublica(producto.nombre);
  });

  test('bloquea nombre vacío y precio negativo sin llamar a la API', async ({ page }) => {
    const catalogo = new ProductosPage(page);
    await catalogo.goto();
    await catalogo.abrirGestion();
    await page.getByRole('button', { name: /Nuevo producto/i }).click();

    const peticiones: string[] = [];
    page.on('request', (peticion) => {
      if (peticion.method() === 'POST' && new URL(peticion.url()).pathname === '/api/productos') {
        peticiones.push(peticion.url());
      }
    });

    await page.locator('#prodPrecio').fill('100');
    await page.getByRole('button', { name: /Guardar producto/i }).click();
    await expect(page.getByText(/Indica al menos dos caracteres/i)).toBeVisible();

    const nombre = `Negativo ${Date.now()}`;
    await page.locator('#prodNombre').fill(nombre);
    await page.locator('#prodPrecio').fill('-50');
    await page.getByRole('button', { name: /Guardar producto/i }).click();

    await expect(page.getByRole('heading', { name: /Nuevo producto/i })).toBeVisible();
    expect(peticiones, 'No debe crear productos inválidos').toEqual([]);
  });

  test('la API rechaza un precio negativo aunque se omita el formulario', async () => {
    const creado = await api.post('/api/productos', {
      data: productoInvalido.precioNegativo(),
    });
    expect(creado.status(), await creado.text()).toBe(400);
    expect((await creado.json()).error).toMatch(/precio.*negativo/i);

    const valido = await crearProducto(api, productoFactory.valido({ precioBase: 100 }));
    const actualizado = await api.put(`/api/productos/${valido.id}`, {
      data: { precioBase: -1 },
    });
    expect(actualizado.status(), await actualizado.text()).toBe(400);
    expect((await obtenerProducto(api, valido.id)).precioBase).toBe(100);
  });

  test('el catálogo público lista todos los productos publicados', async ({ page }) => {
    await page.goto('/productos');
    const tarjetas = page.locator('article');
    await expect(tarjetas.first()).toBeVisible();
    expect(await tarjetas.count()).toBeGreaterThan(0);
    const textos = await tarjetas.allInnerTexts();
    expect(textos.join(' ')).toMatch(/Lona|Playera|Taza|Roll/i);
  });
});

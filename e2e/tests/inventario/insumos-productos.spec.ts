import { test, expect } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import { apiConToken, crearProducto } from '../../helpers/api-setup';
import { unico } from '../../helpers/datos';
import { productoFactory } from '../../factories/producto.factory';
import { InventarioPage } from '../../page-objects/InventarioPage';

test.describe('Inventario — insumos por producto', () => {
  test.use({ rol: 'admin' });

  test('muestra las tarjetas por producto', async ({ page }) => {
    const inventario = new InventarioPage(page);
    await inventario.goto();
    await inventario.verTarjetas();
    expect(await inventario.tarjetas().count()).toBeGreaterThan(0);
  });

  test('la tarjeta de Lona Frontlit lista sus insumos y marca bajo stock', async ({ page }) => {
    const inventario = new InventarioPage(page);
    await inventario.goto();
    await inventario.verTarjetas();

    const tarjeta = inventario.tarjeta('Lona Frontlit impresa');
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toContainText('Lona Frontlit 510g');
    await expect(tarjeta).toContainText('Tinta Eco-solvente CMYK');
    await expect(tarjeta).toContainText(/Bajo stock/i);
    await expect(tarjeta.getByRole('button', { name: /Reponer/i }).first()).toBeVisible();
  });

  test('alterna entre tarjetas y tabla general', async ({ page }) => {
    const inventario = new InventarioPage(page);
    await inventario.goto();
    await inventario.verTarjetas();
    await expect(inventario.tarjetas().first()).toBeVisible();

    await inventario.verTabla();
    await expect(page.getByRole('table', { name: 'Insumos en inventario' })).toBeVisible();
    await expect(inventario.tarjetas()).toHaveCount(0);

    await page.getByRole('tab', { name: /Por Producto/i }).click();
    await expect(inventario.tarjetas().first()).toBeVisible();
  });

  test('Reponer abre el movimiento con el insumo preseleccionado', async ({ page }) => {
    const inventario = new InventarioPage(page);
    await inventario.goto();
    await inventario.verTarjetas();

    const { insumo } = await inventario.reponerEn('Lona Frontlit impresa');
    await expect(page.getByRole('heading', { name: 'Registrar movimiento' })).toBeVisible();
    await expect(page.locator('#movInsumo option:checked')).toHaveText(insumo);
    await expect(page.locator('#movTipo')).toHaveValue('entrada');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  });

  test('muestra el mensaje cuando un producto no tiene receta', async ({ page }) => {
    const api = await apiConToken(tokenDe('admin'));
    const producto = await crearProducto(
      api,
      productoFactory.valido({ nombre: `Servicio sin receta ${unico('e2e')}` }),
    );
    await api.dispose();

    const inventario = new InventarioPage(page);
    await inventario.goto();
    await inventario.verTarjetas();
    const tarjeta = inventario.tarjeta(producto.nombre);
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toContainText(
      'Este producto no requiere insumos o no tiene receta asignada.',
    );
  });
});

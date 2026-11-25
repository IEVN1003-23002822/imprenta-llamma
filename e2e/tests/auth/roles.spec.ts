import { test, expect } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import { apiConToken } from '../../helpers/api-setup';
import { abrirNavegacionSiHaceFalta } from '../../helpers/navegacion';

test.describe('RBAC — Ventas', () => {
  test.use({ rol: 'vendedor' });

  test('entra a ventas, inventario y producción en solo lectura, y no a usuarios', async ({
    page,
  }) => {
    await page.goto('/solicitudes');
    await expect(page.locator('main#contenido')).toContainText(/Solicitudes entrantes/i);

    await page.goto('/inventario');
    await expect(page).toHaveURL(/\/inventario$/);
    await expect(page.getByTestId('modo-lectura')).toBeVisible();
    await expect(page.getByRole('button', { name: /Registrar movimiento/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Nuevo insumo/i })).toHaveCount(0);

    await page.goto('/produccion');
    await expect(page).toHaveURL(/\/produccion$/);
    await expect(page.getByTestId('modo-lectura')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Avanzar etapa' })).toHaveCount(0);

    await page.goto('/usuarios');
    await expect(page).toHaveURL(/\/dashboard$/);

    await abrirNavegacionSiHaceFalta(page);
    await page.getByRole('button', { name: 'Módulos' }).click();
    await expect(page.getByRole('link', { name: /Marketing/i })).toHaveCount(0);
  });
});

test.describe('RBAC — Producción', () => {
  test.use({ rol: 'produccion' });

  test('gestiona producción e inventario, y no entra a clientes ni marketing', async ({ page }) => {
    await page.goto('/produccion');
    await expect(page.locator('main#contenido')).toContainText(/Producción en tiempo real/i);
    await expect(page.getByTestId('modo-lectura')).toHaveCount(0);

    await page.goto('/inventario');
    await expect(page.getByRole('button', { name: /Registrar movimiento/i })).toBeVisible();

    await page.goto('/clientes');
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto('/marketing');
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe('RBAC — Inventario', () => {
  test.use({ rol: 'inventario' });

  test('gestiona inventario, consulta producción en solo lectura y no entra a marketing', async ({
    page,
  }) => {
    await page.goto('/inventario');
    await expect(page.getByRole('button', { name: /Registrar movimiento/i })).toBeVisible();

    await page.goto('/produccion');
    await expect(page).toHaveURL(/\/produccion$/);
    await expect(page.getByTestId('modo-lectura')).toBeVisible();

    await page.goto('/marketing');
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto('/clientes');
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe('RBAC — Marketing', () => {
  test.use({ rol: 'marketing' });

  test('gestiona marketing y clientes, y no entra a inventario', async ({ page }) => {
    await page.goto('/marketing');
    await expect(page.locator('main#contenido')).toContainText(/Marketing y crecimiento/i);

    await abrirNavegacionSiHaceFalta(page);
    await page.getByRole('button', { name: 'Módulos' }).click();
    await expect(page.getByRole('link', { name: /Marketing/i })).toBeVisible();

    await page.goto('/clientes');
    await expect(page.getByRole('button', { name: /Nuevo cliente/i })).toBeVisible();

    await page.goto('/inventario');
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe('Login sin Marketing', () => {
  test('la matriz muestra 4 roles y no anuncia Marketing', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('4 roles', { exact: true })).toBeVisible();
    await expect(page.locator('main#contenido')).not.toContainText('Marketing');
    await expect(page.locator('main#contenido')).toContainText('Administrador');
    await page.screenshot({ path: 'test-results/login-sin-marketing.png', fullPage: true });
  });
});

test.describe('RBAC — API por rol', () => {
  test('rechaza escrituras y módulos fuera de la matriz', async () => {
    const ventas = await apiConToken(tokenDe('vendedor'));
    expect((await ventas.get('/api/materias-primas')).status()).toBe(200);
    expect((await ventas.get('/api/produccion/tablero')).status()).toBe(200);
    expect(
      (
        await ventas.post('/api/materias-primas', {
          data: { nombre: 'No permitido ventas', categoria: 'lona', unidadMedida: 'm2' },
        })
      ).status(),
    ).toBe(403);
    expect((await ventas.get('/api/marketing/actividades')).status()).toBe(403);
    expect((await ventas.get('/api/usuarios')).status()).toBe(403);
    await ventas.dispose();

    const produccion = await apiConToken(tokenDe('produccion'));
    expect((await produccion.get('/api/clientes')).status()).toBe(403);
    expect((await produccion.get('/api/marketing/actividades')).status()).toBe(403);
    await produccion.dispose();

    const inventario = await apiConToken(tokenDe('inventario'));
    expect((await inventario.get('/api/produccion/tablero')).status()).toBe(200);
    expect((await inventario.get('/api/marketing/actividades')).status()).toBe(403);
    expect((await inventario.get('/api/clientes')).status()).toBe(403);
    await inventario.dispose();

    const marketing = await apiConToken(tokenDe('marketing'));
    expect((await marketing.get('/api/marketing/actividades')).status()).toBe(200);
    expect((await marketing.get('/api/clientes')).status()).toBe(200);
    expect((await marketing.get('/api/materias-primas')).status()).toBe(403);
    await marketing.dispose();
  });
});

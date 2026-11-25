import { test, expect } from '../../fixtures/auth.fixture';
import { tokenDe } from '../../fixtures/api.fixture';
import { apiConToken } from '../../helpers/api-setup';
import { abrirNavegacionSiHaceFalta } from '../../helpers/navegacion';

async function abrirModulos(page: import('@playwright/test').Page): Promise<void> {
  await abrirNavegacionSiHaceFalta(page);
  await page.getByRole('button', { name: 'Módulos' }).click();
}

test.describe('Matriz RBAC — Admin', () => {
  test.use({ rol: 'admin' });

  test('ve los cinco módulos y puede gestionar todos', async ({ page }) => {
    await page.goto('/dashboard');
    await abrirNavegacionSiHaceFalta(page);
    await expect(page.locator('nav').getByRole('link', { name: /Solicitudes/i })).toBeVisible();
    await expect(page.locator('nav').getByRole('link', { name: /Cotizador/i })).toBeVisible();

    await page.getByRole('button', { name: 'Módulos' }).click();
    for (const modulo of ['Inventario', 'Abastecimiento', 'Producción', 'Clientes', 'Usuarios']) {
      await expect(
        page.locator('nav').getByRole('link', { name: new RegExp(modulo, 'i') }),
      ).toBeVisible();
    }
    await expect(page.locator('nav').getByRole('link', { name: /Marketing/i })).toHaveCount(0);

    await page.goto('/inventario');
    await expect(page.getByRole('button', { name: /Nuevo insumo/i })).toBeVisible();
    await page.goto('/clientes');
    await expect(page.getByRole('button', { name: /Nuevo cliente/i })).toBeVisible();
    await page.goto('/usuarios');
    await expect(page.getByRole('heading', { name: 'Usuarios.', level: 1 })).toBeVisible();
  });
});

test.describe('Matriz RBAC — Ventas', () => {
  test.use({ rol: 'vendedor' });

  test('gestiona ventas y clientes; inventario/producción en solo lectura', async ({ page }) => {
    await page.goto('/inventario');
    await expect(page).toHaveURL(/\/inventario$/);
    await expect(page.getByTestId('modo-lectura')).toBeVisible();
    await expect(page.getByRole('button', { name: /Nuevo insumo/i })).toHaveCount(0);

    await page.goto('/produccion');
    await expect(page.getByTestId('modo-lectura')).toBeVisible();

    await page.goto('/clientes');
    await expect(page.getByRole('button', { name: /Nuevo cliente/i })).toBeVisible();

    await page.goto('/usuarios');
    await expect(page).toHaveURL(/\/dashboard$/);

    await abrirModulos(page);
    await expect(page.locator('nav').getByRole('link', { name: /Usuarios/i })).toHaveCount(0);
    await expect(page.locator('nav').getByRole('link', { name: /Marketing/i })).toHaveCount(0);
    await expect(page.locator('nav').getByRole('link', { name: /Inventario/i })).toBeVisible();
    await expect(page.locator('nav').getByRole('link', { name: /Producción/i })).toBeVisible();
    await expect(page.locator('nav').getByRole('link', { name: /Clientes/i })).toBeVisible();
  });
});

test.describe('Matriz RBAC — Producción', () => {
  test.use({ rol: 'produccion' });

  test('ventas en solo lectura y producción/inventario con escritura', async ({ page }) => {
    await page.goto('/solicitudes');
    await expect(page.locator('main#contenido')).toContainText(/Solicitudes entrantes/i);
    await expect(page.getByTestId('modo-lectura')).toBeVisible();
    await page
      .getByRole('button')
      .filter({ hasText: /SOL-\d{4}-\d{3}/ })
      .first()
      .click();
    await expect(page.getByRole('button', { name: /Convertir en cotización/i })).toHaveCount(0);

    await page.goto('/produccion');
    await expect(page.getByTestId('modo-lectura')).toHaveCount(0);

    await page.goto('/inventario');
    await expect(page.getByRole('button', { name: /Nuevo insumo/i })).toBeVisible();

    await page.goto('/clientes');
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto('/usuarios');
    await expect(page).toHaveURL(/\/dashboard$/);

    await abrirNavegacionSiHaceFalta(page);
    await expect(page.locator('nav').getByRole('link', { name: /Solicitudes/i })).toBeVisible();
    await expect(page.locator('nav').getByRole('link', { name: /Cotizador/i })).toHaveCount(0);
    await abrirModulos(page);
    await expect(page.locator('nav').getByRole('link', { name: /Clientes/i })).toHaveCount(0);
    await expect(page.locator('nav').getByRole('link', { name: /Producción/i })).toBeVisible();
    await expect(page.locator('nav').getByRole('link', { name: /Inventario/i })).toBeVisible();
  });
});

test.describe('Matriz RBAC — Inventario', () => {
  test.use({ rol: 'inventario' });

  test('gestiona inventario y lee producción; sin ventas ni clientes', async ({ page }) => {
    await page.goto('/inventario');
    await expect(page.getByRole('button', { name: /Nuevo insumo/i })).toBeVisible();

    await page.goto('/produccion');
    await expect(page).toHaveURL(/\/produccion$/);
    await expect(page.getByTestId('modo-lectura')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Avanzar etapa' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Regresar etapa' })).toHaveCount(0);

    await page.goto('/solicitudes');
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto('/clientes');
    await expect(page).toHaveURL(/\/dashboard$/);

    await abrirNavegacionSiHaceFalta(page);
    await expect(page.locator('nav').getByRole('link', { name: /Solicitudes/i })).toHaveCount(0);
    await abrirModulos(page);
    await expect(page.locator('nav').getByRole('link', { name: /Clientes/i })).toHaveCount(0);
    await expect(page.locator('nav').getByRole('link', { name: /Usuarios/i })).toHaveCount(0);
    await expect(page.locator('nav').getByRole('link', { name: /Inventario/i })).toBeVisible();
    await expect(page.locator('nav').getByRole('link', { name: /Producción/i })).toBeVisible();
  });
});

test.describe('Marketing retirado del frontend', () => {
  test.use({ rol: 'marketing' });

  test('inicia sesión pero no tiene módulo de marketing ni clientes', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('main#contenido')).toContainText(/PANEL EJECUTIVO/i);

    await page.goto('/marketing');
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto('/clientes');
    await expect(page).toHaveURL(/\/dashboard$/);

    await abrirModulos(page);
    await expect(page.locator('nav').getByRole('link', { name: /Marketing/i })).toHaveCount(0);
    await expect(page.locator('nav').getByRole('link', { name: /Clientes/i })).toHaveCount(0);
  });
});

test.describe('Login sin Marketing', () => {
  test('la matriz muestra 4 roles y no anuncia Marketing', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('4 roles', { exact: true })).toBeVisible();
    await expect(page.locator('main#contenido')).not.toContainText('Marketing');
  });
});

test.describe('Matriz RBAC — API por rol', () => {
  test('rechaza escrituras y módulos fuera de la matriz', async () => {
    const ventas = await apiConToken(tokenDe('vendedor'));
    expect((await ventas.get('/api/materias-primas')).status()).toBe(200);
    expect((await ventas.get('/api/produccion/tablero')).status()).toBe(200);
    expect((await ventas.get('/api/solicitudes')).status()).toBe(200);
    expect(
      (
        await ventas.post('/api/materias-primas', {
          data: { nombre: 'No permitido ventas', categoria: 'lona', unidadMedida: 'm2' },
        })
      ).status(),
    ).toBe(403);
    expect((await ventas.get('/api/marketing/actividades')).status()).toBe(403);
    expect((await ventas.get('/api/usuarios')).status()).toBe(403);
    expect(
      (
        await ventas.patch('/api/pedidos/999/estado', {
          data: { estado: 'confirmado' },
        })
      ).status(),
    ).toBe(404);
    await ventas.dispose();

    const produccion = await apiConToken(tokenDe('produccion'));
    expect((await produccion.get('/api/solicitudes')).status()).toBe(200);
    expect((await produccion.get('/api/materias-primas')).status()).toBe(200);
    expect((await produccion.get('/api/clientes')).status()).toBe(403);
    expect((await produccion.get('/api/marketing/actividades')).status()).toBe(403);
    expect((await produccion.post('/api/cotizaciones', { data: { items: [] } })).status()).toBe(
      403,
    );
    expect(
      (
        await produccion.patch('/api/pedidos/999/estado', {
          data: { estado: 'confirmado' },
        })
      ).status(),
    ).toBe(404);
    await produccion.dispose();

    const inventario = await apiConToken(tokenDe('inventario'));
    expect((await inventario.get('/api/materias-primas')).status()).toBe(200);
    expect((await inventario.get('/api/produccion/tablero')).status()).toBe(200);
    expect((await inventario.get('/api/solicitudes')).status()).toBe(403);
    expect((await inventario.get('/api/pedidos')).status()).toBe(403);
    expect((await inventario.get('/api/clientes')).status()).toBe(403);
    expect((await inventario.get('/api/marketing/actividades')).status()).toBe(403);
    await inventario.dispose();

    const marketing = await apiConToken(tokenDe('marketing'));
    expect((await marketing.get('/api/marketing/actividades')).status()).toBe(200);
    expect((await marketing.get('/api/clientes')).status()).toBe(403);
    expect((await marketing.get('/api/materias-primas')).status()).toBe(403);
    await marketing.dispose();
  });
});

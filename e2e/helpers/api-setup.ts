import { APIRequestContext, expect, request, type Page } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:5001';

export interface SesionApi {
  token: string;
  usuario: { id: number; nombre: string; correo: string };
  permisos: string[];
  expiraEn: string;
}

export async function loginApi(correo: string, password: string): Promise<SesionApi> {
  const api = await request.newContext({ baseURL: API_URL });
  const respuesta = await api.post('/api/auth/login', { data: { correo, password } });
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  const datos = (await respuesta.json()) as SesionApi;
  await api.dispose();
  return datos;
}

/** Contexto autenticado para preparar o verificar datos sin pasar por la UI. */
export function apiConToken(token: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

export async function crearMateriaPrima(
  api: APIRequestContext,
  datos: Record<string, unknown>,
): Promise<Record<string, any>> {
  const respuesta = await api.post('/api/materias-primas', { data: datos });
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  return respuesta.json();
}

export async function crearProducto(
  api: APIRequestContext,
  datos: Record<string, unknown>,
): Promise<Record<string, any>> {
  const respuesta = await api.post('/api/productos', { data: datos });
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  return respuesta.json();
}

export async function actualizarProducto(
  api: APIRequestContext,
  id: number,
  datos: Record<string, unknown>,
): Promise<Record<string, any>> {
  const respuesta = await api.put(`/api/productos/${id}`, { data: datos });
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  return respuesta.json();
}

export async function obtenerProducto(
  api: APIRequestContext,
  id: number,
): Promise<Record<string, any>> {
  const respuesta = await api.get(`/api/productos/${id}`);
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  return respuesta.json();
}

export async function crearSolicitud(
  api: APIRequestContext,
  datos: Record<string, unknown>,
): Promise<Record<string, any>> {
  const respuesta = await api.post('/api/public/solicitudes', { data: datos });
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  return respuesta.json();
}

export async function obtenerSolicitud(
  api: APIRequestContext,
  id: number,
): Promise<Record<string, any>> {
  const respuesta = await api.get(`/api/solicitudes/${id}`);
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  return respuesta.json();
}

export async function convertirSolicitud(
  api: APIRequestContext,
  id: number,
  datos: Record<string, unknown> = {},
): Promise<Record<string, any>> {
  const respuesta = await api.post(`/api/solicitudes/${id}/convertir-cotizacion`, { data: datos });
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  return respuesta.json();
}

export async function crearCotizacion(
  api: APIRequestContext,
  datos: Record<string, unknown>,
): Promise<Record<string, any>> {
  const respuesta = await api.post('/api/cotizaciones', { data: datos });
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  return respuesta.json();
}

export async function cambiarEstadoCotizacion(
  api: APIRequestContext,
  id: number,
  estado: string,
): Promise<Record<string, any>> {
  const respuesta = await api.patch(`/api/cotizaciones/${id}/estado`, { data: { estado } });
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  return respuesta.json();
}

export async function obtenerCotizacion(
  api: APIRequestContext,
  id: number,
): Promise<Record<string, any>> {
  const respuesta = await api.get(`/api/cotizaciones/${id}`);
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  return respuesta.json();
}

export async function convertirPedido(
  api: APIRequestContext,
  cotizacionId: number,
  datos: Record<string, unknown> = {},
): Promise<Record<string, any>> {
  const respuesta = await api.post(`/api/cotizaciones/${cotizacionId}/convertir-pedido`, {
    data: datos,
  });
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  return respuesta.json();
}

export async function obtenerPedido(
  api: APIRequestContext,
  id: number,
): Promise<Record<string, any>> {
  const respuesta = await api.get(`/api/pedidos/${id}`);
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  return respuesta.json();
}

export async function stockDe(api: APIRequestContext, nombreMateria: string): Promise<number> {
  const respuesta = await api.get('/api/materias-primas');
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  const datos = (await respuesta.json()) as { items: Array<Record<string, any>> };
  const materia = datos.items.find((item) => item.nombre === nombreMateria);
  expect(materia, `No se encontró la materia prima ${nombreMateria}`).toBeTruthy();
  return Number(materia!.stockActual);
}

export async function crearCliente(
  api: APIRequestContext,
  datos: Record<string, unknown>,
): Promise<Record<string, any>> {
  const respuesta = await api.post('/api/clientes', { data: datos });
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  return respuesta.json();
}

export async function crearPedido(
  api: APIRequestContext,
  datos: Record<string, unknown>,
): Promise<Record<string, any>> {
  const respuesta = await api.post('/api/pedidos', { data: datos });
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  return respuesta.json();
}

export async function actualizarProduccion(
  api: APIRequestContext,
  ordenId: number,
  datos: Record<string, unknown>,
): Promise<Record<string, any>> {
  const respuesta = await api.patch(`/api/produccion/ordenes/${ordenId}`, { data: datos });
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  return respuesta.json();
}

export async function movimientosDe(
  api: APIRequestContext,
  materiaId: number,
): Promise<Array<Record<string, any>>> {
  const respuesta = await api.get(`/api/movimientos?materiaPrimaId=${materiaId}&perPage=100`);
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  return (await respuesta.json()).items as Array<Record<string, any>>;
}

/** Espera visible y sin errores de consola una ruta interna. */
export async function abrirModulo(page: Page, ruta: string, texto: RegExp): Promise<void> {
  await page.goto(ruta);
  await expect(page).toHaveURL(new RegExp(`${ruta.replace('/', '\\/')}$`));
  await expect(page.locator('main#contenido')).toContainText(texto);
}

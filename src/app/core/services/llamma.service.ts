import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

import {
  ActividadMarketingApi,
  ClienteApi,
  ConsultaPedidosApi,
  Cotizacion,
  DescuentoResultado,
  MateriaPrimaApi,
  MensajeChat,
  MovimientoApi,
  NuevaSolicitudPayload,
  OrdenCompraApi,
  PedidoApi,
  ProductoApi,
  ProductoConReceta,
  ProductoPublico,
  ProveedorApi,
  RecetaApi,
  ResumenDashboardApi,
  ResumenSolicitudes,
  RespuestaPaginada,
  RolApi,
  SeguimientoSolicitud,
  SolicitudCotizacion,
  EstadoSolicitud,
  TableroProduccion,
  OrdenProduccionApi,
  ControlCalidadApi,
  Identificador,
  NuevoUsuarioPayload,
  ActualizarUsuarioPayload,
  Usuario,
} from '../models/llamma.models';

/**
 * Cliente HTTP de la API de Llamma.
 *
 * El backend expone los endpoints públicos del portal y los internos
 * protegidos por token de sesión. Todos los datos de la aplicación provienen
 * de estas llamadas: no hay arreglos en memoria.
 */

export interface ImagenMockupPreparada {
  dataUrl: string;
  ancho: number;
  alto: number;
  anchoOriginal: number;
  altoOriginal: number;
  calidadImpresion: 'alta' | 'media' | 'baja';
}

@Injectable({ providedIn: 'root' })
export class LlammaService {
  prepararImagenMockup(
    archivo: File,
    opciones?: { quitarFondo?: boolean; recortar?: boolean; umbral?: number },
  ): Observable<ImagenMockupPreparada> {
    const form = new FormData();
    form.append('imagen', archivo, archivo.name);
    if (opciones?.quitarFondo) form.append('quitarFondo', 'true');
    if (opciones?.recortar === false) form.append('recortar', 'false');
    if (opciones?.umbral != null) form.append('umbral', String(opciones.umbral));
    return this.http.post<ImagenMockupPreparada>(
      `${this.apiUrl}/public/mockups/preparar-imagen`,
      form,
    );
  }

  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api';
  private catalogoPublico$: Observable<{ items: ProductoPublico[]; total: number }> | null = null;

  /* ------------------------------ Público ------------------------------ */

  /**
   * El catálogo público se comparte entre las vistas que lo muestran. La
   * respuesta se reutiliza mientras haya suscriptores; las mutaciones del
   * catálogo piden `refrescar = true` para invalidar la copia.
   */
  listarProductosPublicos(refrescar = false): Observable<{
    items: ProductoPublico[];
    total: number;
  }> {
    if (refrescar || !this.catalogoPublico$) {
      this.catalogoPublico$ = this.http
        .get<{ items: ProductoPublico[]; total: number }>(`${this.apiUrl}/public/productos`)
        .pipe(shareReplay({ bufferSize: 1, refCount: true }));
    }
    return this.catalogoPublico$;
  }

  crearSolicitud(payload: NuevaSolicitudPayload): Observable<{
    mensaje: string;
    folio: string;
    solicitud: SolicitudCotizacion;
  }> {
    const form = new FormData();
    form.append('nombreCliente', payload.nombreCliente);
    form.append('correo', payload.correo);
    form.append('segmento', payload.segmento);
    form.append('metodoEntrega', payload.metodoEntrega);
    if (payload.empresa) form.append('empresa', payload.empresa);
    if (payload.telefono) form.append('telefono', payload.telefono);
    if (payload.mensaje) form.append('mensaje', payload.mensaje);
    if (payload.fechaDeseada) form.append('fechaDeseada', payload.fechaDeseada);
    form.append('items', JSON.stringify(payload.items));
    for (const archivo of payload.archivos ?? []) {
      form.append('archivos', archivo, archivo.name);
    }
    if (payload.mockups?.length) {
      form.append('mockups', JSON.stringify(payload.mockups));
    }
    return this.http.post<{ mensaje: string; folio: string; solicitud: SolicitudCotizacion }>(
      `${this.apiUrl}/public/solicitudes`,
      form,
    );
  }

  consultarSolicitud(folio: string, correo: string): Observable<SeguimientoSolicitud> {
    const params = new HttpParams().set('correo', correo);
    return this.http.get<SeguimientoSolicitud>(
      `${this.apiUrl}/public/solicitudes/${encodeURIComponent(folio.trim().toUpperCase())}`,
      { params },
    );
  }

  listarMensajesPublicos(
    folio: string,
    correo: string,
  ): Observable<{ items: MensajeChat[]; total: number }> {
    const params = new HttpParams().set('correo', correo);
    return this.http.get<{ items: MensajeChat[]; total: number }>(
      `${this.apiUrl}/public/solicitudes/${encodeURIComponent(folio.trim().toUpperCase())}/mensajes`,
      { params },
    );
  }

  enviarMensajePublico(
    folio: string,
    correo: string,
    mensaje: string,
    archivo?: File | null,
  ): Observable<{ mensaje: string; mensajeChat: MensajeChat }> {
    const form = new FormData();
    form.append('correo', correo);
    if (mensaje.trim()) form.append('mensaje', mensaje.trim());
    if (archivo) form.append('archivo', archivo);
    return this.http.post<{ mensaje: string; mensajeChat: MensajeChat }>(
      `${this.apiUrl}/public/solicitudes/${encodeURIComponent(folio.trim().toUpperCase())}/mensajes`,
      form,
    );
  }

  descargarAdjuntoPublico(folio: string, correo: string, mensajeId: number): Observable<Blob> {
    const params = new HttpParams().set('correo', correo);
    return this.http.get(
      `${this.apiUrl}/public/solicitudes/${encodeURIComponent(folio.trim().toUpperCase())}/mensajes/${mensajeId}/archivo`,
      { params, responseType: 'blob' },
    );
  }

  /* ----------------------------- Solicitudes --------------------------- */

  resumenSolicitudes(): Observable<ResumenSolicitudes> {
    return this.http.get<ResumenSolicitudes>(`${this.apiUrl}/solicitudes/resumen`);
  }

  listarSolicitudes(filtros: {
    estado?: string;
    produccion?: string;
    entrega?: string;
    q?: string;
    page?: number;
    perPage?: number;
  }): Observable<RespuestaPaginada<SolicitudCotizacion>> {
    let params = new HttpParams();
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.produccion) params = params.set('produccion', filtros.produccion);
    if (filtros.entrega) params = params.set('entrega', filtros.entrega);
    if (filtros.q) params = params.set('q', filtros.q);
    if (filtros.page) params = params.set('page', filtros.page);
    if (filtros.perPage) params = params.set('perPage', filtros.perPage);
    return this.http.get<RespuestaPaginada<SolicitudCotizacion>>(`${this.apiUrl}/solicitudes`, {
      params,
    });
  }

  detalleSolicitud(id: number): Observable<SolicitudCotizacion> {
    return this.http.get<SolicitudCotizacion>(`${this.apiUrl}/solicitudes/${id}`);
  }

  listarMensajesSolicitud(id: number): Observable<{ items: MensajeChat[]; total: number }> {
    return this.http.get<{ items: MensajeChat[]; total: number }>(
      `${this.apiUrl}/solicitudes/${id}/mensajes`,
    );
  }

  enviarMensajeInterno(
    id: number,
    mensaje: string,
    archivo?: File | null,
  ): Observable<{ mensaje: string; mensajeChat: MensajeChat }> {
    const form = new FormData();
    if (mensaje.trim()) form.append('mensaje', mensaje.trim());
    if (archivo) form.append('archivo', archivo);
    return this.http.post<{ mensaje: string; mensajeChat: MensajeChat }>(
      `${this.apiUrl}/solicitudes/${id}/mensajes`,
      form,
    );
  }

  descargarAdjuntoMensaje(mensajeId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/mensajes/${mensajeId}/archivo`, {
      responseType: 'blob',
    });
  }

  cambiarEstadoSolicitud(id: number, estado: EstadoSolicitud): Observable<SolicitudCotizacion> {
    return this.http.patch<SolicitudCotizacion>(`${this.apiUrl}/solicitudes/${id}/estado`, {
      estado,
    });
  }

  convertirSolicitudACotizacion(
    id: number,
    body: { notas?: string; vigenciaDias?: number; estado?: string } = {},
  ): Observable<Cotizacion> {
    return this.http.post<Cotizacion>(
      `${this.apiUrl}/solicitudes/${id}/convertir-cotizacion`,
      body,
    );
  }

  /* ----------------------------- Cotizaciones -------------------------- */

  crearCotizacion(body: {
    solicitudId?: number;
    clienteId?: number;
    cliente?: {
      nombre: string;
      correo: string;
      telefono?: string;
      empresa?: string;
      segmento?: string;
      rfc?: string;
      direccion?: string;
    };
    nombreCliente?: string;
    correo?: string;
    telefono?: string;
    empresa?: string;
    segmento?: string;
    rfc?: string;
    direccion?: string;
    notas?: string;
    vigenciaDias?: number;
    estado?: string;
    items: Array<{
      productoId?: number | null;
      descripcion: string;
      especificaciones?: string;
      cantidad: number;
      precioUnitario: number;
    }>;
  }): Observable<Cotizacion> {
    return this.http.post<Cotizacion>(`${this.apiUrl}/cotizaciones`, body);
  }

  detalleCotizacion(id: number): Observable<Cotizacion> {
    return this.http.get<Cotizacion>(`${this.apiUrl}/cotizaciones/${id}`);
  }

  listarCotizaciones(
    filtros: {
      estado?: string;
      q?: string;
      page?: number;
      perPage?: number;
    } = {},
  ): Observable<RespuestaPaginada<Cotizacion>> {
    let params = new HttpParams();
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.q) params = params.set('q', filtros.q);
    params = params.set('page', filtros.page ?? 1);
    params = params.set('perPage', filtros.perPage ?? 20);
    return this.http.get<RespuestaPaginada<Cotizacion>>(`${this.apiUrl}/cotizaciones`, { params });
  }

  cambiarEstadoCotizacion(
    id: number,
    estado: string,
  ): Observable<Cotizacion & { descuento?: DescuentoResultado }> {
    return this.http.patch<Cotizacion & { descuento?: DescuentoResultado }>(
      `${this.apiUrl}/cotizaciones/${id}/estado`,
      { estado },
    );
  }

  convertirCotizacionAPedido(
    id: number,
    body: {
      fechaEntrega?: string;
      notaEntrega?: string;
      prioridad?: string;
      anticipoPagado?: boolean;
      metodoPago?: string;
      referenciaPago?: string;
    } = {},
  ): Observable<PedidoApi & { descuento?: DescuentoResultado }> {
    return this.http.post<PedidoApi & { descuento?: DescuentoResultado }>(
      `${this.apiUrl}/cotizaciones/${id}/convertir-pedido`,
      body,
    );
  }

  /* -------------------------------- Catálogo --------------------------- */

  listarProductos(): Observable<{ items: ProductoApi[]; total: number }> {
    return this.http.get<{ items: ProductoApi[]; total: number }>(`${this.apiUrl}/productos`);
  }

  listarInsumosPorProducto(): Observable<{ items: ProductoConReceta[]; total: number }> {
    return this.http.get<{ items: ProductoConReceta[]; total: number }>(
      `${this.apiUrl}/productos/insumos`,
    );
  }

  detalleProducto(id: number): Observable<ProductoApi & { receta?: RecetaApi | null }> {
    return this.http.get<ProductoApi & { receta?: RecetaApi | null }>(
      `${this.apiUrl}/productos/${id}`,
    );
  }

  crearProducto(body: Record<string, unknown>): Observable<ProductoApi> {
    return this.http.post<ProductoApi>(`${this.apiUrl}/productos`, body);
  }

  actualizarProducto(id: number, body: Record<string, unknown>): Observable<ProductoApi> {
    return this.http.put<ProductoApi>(`${this.apiUrl}/productos/${id}`, body);
  }

  desactivarProducto(id: number): Observable<{ mensaje: string; id: number }> {
    return this.http.delete<{ mensaje: string; id: number }>(`${this.apiUrl}/productos/${id}`);
  }

  /* -------------------------------- Clientes --------------------------- */

  listarClientes(
    filtros: {
      q?: string;
      segmento?: string;
      activo?: boolean;
      page?: number;
      perPage?: number;
    } = {},
  ): Observable<RespuestaPaginada<ClienteApi>> {
    let params = new HttpParams()
      .set('page', filtros.page ?? 1)
      .set('perPage', filtros.perPage ?? 20);
    if (filtros.q) params = params.set('q', filtros.q);
    if (filtros.segmento) params = params.set('segmento', filtros.segmento);
    if (filtros.activo !== undefined) params = params.set('activo', filtros.activo ? '1' : '0');
    return this.http.get<RespuestaPaginada<ClienteApi>>(`${this.apiUrl}/clientes`, { params });
  }

  detalleCliente(id: number): Observable<ClienteApi> {
    return this.http.get<ClienteApi>(`${this.apiUrl}/clientes/${id}`);
  }

  crearCliente(body: Record<string, unknown>): Observable<ClienteApi> {
    return this.http.post<ClienteApi>(`${this.apiUrl}/clientes`, body);
  }

  actualizarCliente(id: number, body: Record<string, unknown>): Observable<ClienteApi> {
    return this.http.put<ClienteApi>(`${this.apiUrl}/clientes/${id}`, body);
  }

  desactivarCliente(id: number): Observable<{ mensaje: string; id: number }> {
    return this.http.delete<{ mensaje: string; id: number }>(`${this.apiUrl}/clientes/${id}`);
  }

  /* -------------------------------- Pedidos ---------------------------- */

  listarPedidos(
    filtros: {
      estado?: string;
      q?: string;
      page?: number;
      perPage?: number;
    } = {},
  ): Observable<RespuestaPaginada<PedidoApi>> {
    let params = new HttpParams()
      .set('page', filtros.page ?? 1)
      .set('perPage', filtros.perPage ?? 20);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.q) params = params.set('q', filtros.q);
    return this.http.get<RespuestaPaginada<PedidoApi>>(`${this.apiUrl}/pedidos`, { params });
  }

  detallePedido(id: number): Observable<PedidoApi> {
    return this.http.get<PedidoApi>(`${this.apiUrl}/pedidos/${id}`);
  }

  consultarPedidos(
    filtros: {
      q?: string;
      estado?: string;
      linea?: string;
      clienteId?: number;
      desde?: string;
      hasta?: string;
      page?: number;
      perPage?: number;
    } = {},
  ): Observable<ConsultaPedidosApi> {
    let params = new HttpParams()
      .set('page', filtros.page ?? 1)
      .set('perPage', filtros.perPage ?? 10);
    if (filtros.q) params = params.set('q', filtros.q);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.linea) params = params.set('linea', filtros.linea);
    if (filtros.clienteId) params = params.set('clienteId', filtros.clienteId);
    if (filtros.desde) params = params.set('desde', filtros.desde);
    if (filtros.hasta) params = params.set('hasta', filtros.hasta);
    return this.http.get<ConsultaPedidosApi>(`${this.apiUrl}/consultas/pedidos`, { params });
  }
  cambiarEstadoPedido(id: number, estado: string): Observable<PedidoApi> {
    return this.http.patch<PedidoApi>(`${this.apiUrl}/pedidos/${id}/estado`, { estado });
  }

  actualizarEntregaPedido(
    id: number,
    body: { fechaEntrega: string; notaEntrega?: string | null },
  ): Observable<PedidoApi> {
    return this.http.patch<PedidoApi>(`${this.apiUrl}/pedidos/${id}/entrega`, body);
  }

  registrarPago(
    pedidoId: number,
    body: {
      tipo: string;
      metodo: string;
      monto: number;
      referencia?: string;
      confirmado?: boolean;
    },
  ): Observable<{ pago: unknown; pedido: PedidoApi }> {
    return this.http.post<{ pago: unknown; pedido: PedidoApi }>(
      `${this.apiUrl}/pedidos/${pedidoId}/pagos`,
      body,
    );
  }

  /* ----------------------- Inventario y abastecimiento ----------------- */

  listarMaterias(filtros: { categoria?: string; bajoStock?: boolean } = {}): Observable<{
    items: MateriaPrimaApi[];
    total: number;
  }> {
    let params = new HttpParams();
    if (filtros.categoria) params = params.set('categoria', filtros.categoria);
    if (filtros.bajoStock) params = params.set('bajoStock', 'true');
    return this.http.get<{ items: MateriaPrimaApi[]; total: number }>(
      `${this.apiUrl}/materias-primas`,
      { params },
    );
  }

  crearMateria(body: Record<string, unknown>): Observable<MateriaPrimaApi> {
    return this.http.post<MateriaPrimaApi>(`${this.apiUrl}/materias-primas`, body);
  }

  actualizarMateria(id: number, body: Record<string, unknown>): Observable<MateriaPrimaApi> {
    return this.http.put<MateriaPrimaApi>(`${this.apiUrl}/materias-primas/${id}`, body);
  }

  desactivarMateria(id: number): Observable<{ mensaje: string; id: number }> {
    return this.http.delete<{ mensaje: string; id: number }>(
      `${this.apiUrl}/materias-primas/${id}`,
    );
  }

  ajustarInventario(
    id: number,
    body: { tipo: string; cantidad: number; referencia?: string; motivo?: string },
  ): Observable<{ materia: MateriaPrimaApi }> {
    return this.http.post<{ materia: MateriaPrimaApi }>(
      `${this.apiUrl}/materias-primas/${id}/ajuste`,
      body,
    );
  }

  listarMovimientos(
    filtros: {
      materiaPrimaId?: number;
      page?: number;
      perPage?: number;
    } = {},
  ): Observable<RespuestaPaginada<MovimientoApi>> {
    let params = new HttpParams()
      .set('page', filtros.page ?? 1)
      .set('perPage', filtros.perPage ?? 30);
    if (filtros.materiaPrimaId) params = params.set('materiaPrimaId', filtros.materiaPrimaId);
    return this.http.get<RespuestaPaginada<MovimientoApi>>(`${this.apiUrl}/movimientos`, {
      params,
    });
  }

  listarProveedores(): Observable<{ items: ProveedorApi[]; total: number }> {
    return this.http.get<{ items: ProveedorApi[]; total: number }>(`${this.apiUrl}/proveedores`);
  }

  crearProveedor(body: Record<string, unknown>): Observable<ProveedorApi> {
    return this.http.post<ProveedorApi>(`${this.apiUrl}/proveedores`, body);
  }

  listarOrdenesCompra(
    filtros: { page?: number; perPage?: number } = {},
  ): Observable<RespuestaPaginada<OrdenCompraApi>> {
    const params = new HttpParams()
      .set('page', filtros.page ?? 1)
      .set('perPage', filtros.perPage ?? 20);
    return this.http.get<RespuestaPaginada<OrdenCompraApi>>(`${this.apiUrl}/ordenes-compra`, {
      params,
    });
  }

  crearOrdenCompra(body: Record<string, unknown>): Observable<OrdenCompraApi> {
    return this.http.post<OrdenCompraApi>(`${this.apiUrl}/ordenes-compra`, body);
  }

  cambiarEstadoOrdenCompra(id: number, estado: string): Observable<OrdenCompraApi> {
    return this.http.patch<OrdenCompraApi>(`${this.apiUrl}/ordenes-compra/${id}/estado`, {
      estado,
    });
  }

  /* ------------------------------ Producción --------------------------- */

  tableroProduccion(): Observable<TableroProduccion> {
    return this.http.get<TableroProduccion>(`${this.apiUrl}/produccion/tablero`);
  }

  actualizarOrdenProduccion(
    id: number,
    body: { etapa?: string; estado?: string; observaciones?: string; responsableId?: number },
  ): Observable<OrdenProduccionApi> {
    return this.http.patch<OrdenProduccionApi>(`${this.apiUrl}/produccion/ordenes/${id}`, body);
  }

  registrarCalidad(
    id: number,
    body: { criterio: string; aprobado: boolean; observaciones?: string },
  ): Observable<ControlCalidadApi> {
    return this.http.post<ControlCalidadApi>(
      `${this.apiUrl}/produccion/ordenes/${id}/calidad`,
      body,
    );
  }

  /* ------------------------------- Usuarios ---------------------------- */

  listarUsuarios(): Observable<{ items: Usuario[]; total: number }> {
    return this.http.get<{ items: Usuario[]; total: number }>(`${this.apiUrl}/usuarios`);
  }

  listarRoles(): Observable<{ items: RolApi[]; total: number }> {
    return this.http.get<{ items: RolApi[]; total: number }>(`${this.apiUrl}/roles`);
  }

  crearUsuario(body: NuevoUsuarioPayload): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.apiUrl}/usuarios`, body);
  }

  actualizarUsuario(id: Identificador, body: ActualizarUsuarioPayload): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.apiUrl}/usuarios/${id}`, body);
  }

  /* ------------------------------- Marketing --------------------------- */

  listarActividades(): Observable<{ items: ActividadMarketingApi[]; total: number }> {
    return this.http.get<{ items: ActividadMarketingApi[]; total: number }>(
      `${this.apiUrl}/marketing/actividades`,
    );
  }

  crearActividad(body: Record<string, unknown>): Observable<ActividadMarketingApi> {
    return this.http.post<ActividadMarketingApi>(`${this.apiUrl}/marketing/actividades`, body);
  }

  actualizarActividad(
    id: number,
    body: Record<string, unknown>,
  ): Observable<ActividadMarketingApi> {
    return this.http.put<ActividadMarketingApi>(`${this.apiUrl}/marketing/actividades/${id}`, body);
  }

  /* ------------------------------- Archivos ---------------------------- */

  descargarArchivo(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/archivos/${id}`, { responseType: 'blob' });
  }

  /* ------------------------------ Dashboard ---------------------------- */

  resumenDashboard(): Observable<ResumenDashboardApi> {
    return this.http.get<ResumenDashboardApi>(`${this.apiUrl}/dashboard/resumen`);
  }
}

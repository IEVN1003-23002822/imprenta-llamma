import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Cotizacion,
  NuevaSolicitudPayload,
  ProductoPublico,
  ResumenDashboard,
  ResumenSolicitudes,
  RespuestaPaginada,
  SeguimientoSolicitud,
  SolicitudCotizacion,
  EstadoSolicitud,
} from './llamma.models';

/**
 * Cliente HTTP de la API de Llamma.
 *
 * El backend expone los endpoints públicos del portal y los internos
 * protegidos por token de sesión.
 */
@Injectable({ providedIn: 'root' })
export class LlammaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api';

  /* ------------------------------ Público ------------------------------ */

  listarProductosPublicos(): Observable<{ items: ProductoPublico[]; total: number }> {
    return this.http.get<{ items: ProductoPublico[]; total: number }>(
      `${this.apiUrl}/public/productos`,
    );
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

  /* ----------------------------- Solicitudes --------------------------- */

  resumenSolicitudes(): Observable<ResumenSolicitudes> {
    return this.http.get<ResumenSolicitudes>(`${this.apiUrl}/solicitudes/resumen`);
  }

  listarSolicitudes(filtros: {
    estado?: string;
    q?: string;
    page?: number;
    perPage?: number;
  }): Observable<RespuestaPaginada<SolicitudCotizacion>> {
    let params = new HttpParams();
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.q) params = params.set('q', filtros.q);
    if (filtros.page) params = params.set('page', filtros.page);
    if (filtros.perPage) params = params.set('perPage', filtros.perPage);
    return this.http.get<RespuestaPaginada<SolicitudCotizacion>>(
      `${this.apiUrl}/solicitudes`,
      { params },
    );
  }

  detalleSolicitud(id: number): Observable<SolicitudCotizacion> {
    return this.http.get<SolicitudCotizacion>(`${this.apiUrl}/solicitudes/${id}`);
  }

  cambiarEstadoSolicitud(
    id: number,
    estado: EstadoSolicitud,
  ): Observable<SolicitudCotizacion> {
    return this.http.patch<SolicitudCotizacion>(`${this.apiUrl}/solicitudes/${id}/estado`, {
      estado,
    });
  }

  convertirSolicitudACotizacion(
    id: number,
    body: { notas?: string; vigenciaDias?: number; estado?: string } = {},
  ): Observable<Cotizacion> {
    return this.http.post<Cotizacion>(`${this.apiUrl}/solicitudes/${id}/convertir-cotizacion`, body);
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

  convertirCotizacionAPedido(
    id: number,
    body: {
      fechaEntrega?: string;
      prioridad?: string;
      anticipoPagado?: boolean;
      metodoPago?: string;
      referenciaPago?: string;
    } = {},
  ): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/cotizaciones/${id}/convertir-pedido`, body);
  }

  /* -------------------------------- Catálogo --------------------------- */

  listarProductos(): Observable<{ items: ProductoPublico[]; total: number }> {
    return this.http.get<{ items: ProductoPublico[]; total: number }>(
      `${this.apiUrl}/productos`,
    );
  }

  listarClientes(q?: string): Observable<RespuestaPaginada<unknown>> {
    let params = new HttpParams().set('perPage', 100);
    if (q) params = params.set('q', q);
    return this.http.get<RespuestaPaginada<unknown>>(`${this.apiUrl}/clientes`, { params });
  }

  /* ------------------------------- Archivos ---------------------------- */

  descargarArchivo(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/archivos/${id}`, { responseType: 'blob' });
  }

  /* ------------------------------ Dashboard ---------------------------- */

  resumenDashboard(): Observable<ResumenDashboard> {
    return this.http.get<ResumenDashboard>(`${this.apiUrl}/dashboard/resumen`);
  }
}

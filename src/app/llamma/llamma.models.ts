/**
 * Contratos de datos de Llamma.
 *
 * Este archivo contiene únicamente definiciones de tipos e interfaces.
 * No incluye lógica de negocio ni implementaciones.
 */

export type Identificador = string | number;

export type UnidadMedida = 'm2' | 'ml' | 'pieza' | 'hoja' | 'kg' | 'litro';

export type CategoriaMateriaPrima =
  | 'lona'
  | 'vinil'
  | 'tinta'
  | 'herrajes'
  | 'estructura'
  | 'lamina'
  | 'laminado'
  | 'adhesivo'
  | 'papel'
  | 'perfil'
  | 'textil'
  | 'promocional'
  | 'otro';

export type LineaProduccion = 'gran-formato' | 'textil' | 'promocionales' | 'papeleria';

export type CategoriaProducto =
  | 'display'
  | 'senaletica'
  | 'rotulacion'
  | 'bastidor'
  | 'textil'
  | 'promocional'
  | 'papeleria'
  | 'otro';

export type EstadoPedido =
  | 'cotizacion'
  | 'confirmado'
  | 'en-produccion'
  | 'listo'
  | 'entregado'
  | 'cancelado';

export type PrioridadPedido = 'baja' | 'media' | 'alta' | 'urgente';

export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste' | 'merma' | 'devolucion';

export type EtapaProduccion =
  | 'diseno'
  | 'impresion'
  | 'laminado'
  | 'corte'
  | 'confeccion'
  | 'armado'
  | 'acabado'
  | 'entrega';

export type EstadoProduccion = 'pendiente' | 'en-proceso' | 'pausada' | 'completada' | 'rechazada';

export type RolUsuario = 'admin' | 'ventas' | 'produccion' | 'inventario' | 'marketing';

export type SegmentoCliente =
  | 'corporativo'
  | 'pyme'
  | 'escolar'
  | 'gobierno'
  | 'eventos'
  | 'particular'
  | 'otro';

export type CanalMarketing =
  | 'redes-sociales'
  | 'google-ads'
  | 'correo'
  | 'punto-de-venta'
  | 'referidos'
  | 'otro';

export type EstadoActividadMarketing = 'planeada' | 'activa' | 'finalizada' | 'cancelada';

export interface Cliente {
  id: Identificador;
  nombre: string;
  empresa?: string;
  correo: string;
  telefono: string;
  direccion?: string;
  rfc?: string;
  segmento: SegmentoCliente;
  fechaRegistro: string;
  activo: boolean;
  notas?: string;
}

export interface Proveedor {
  id: Identificador;
  nombre: string;
  contacto: string;
  telefono: string;
  correo: string;
  condicionesPago?: string;
  activo: boolean;
}

export interface MateriaPrima {
  id: Identificador;
  nombre: string;
  categoria: CategoriaMateriaPrima;
  unidadMedida: UnidadMedida;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
  costoUnitario: number;
  proveedorId?: Identificador;
  activo: boolean;
}

export interface Producto {
  id: Identificador;
  nombre: string;
  descripcion?: string;
  categoria: CategoriaProducto;
  lineaProduccion: LineaProduccion;
  precioBase: number;
  unidadVenta: UnidadMedida;
  recetaId?: Identificador;
  activo: boolean;
}

export interface RecetaComponente {
  materiaPrimaId: Identificador;
  cantidad: number;
  unidadMedida: UnidadMedida;
  desperdicioPorcentaje?: number;
}

export interface Receta {
  id: Identificador;
  productoId: Identificador;
  nombre: string;
  rendimiento: number;
  unidadRendimiento: UnidadMedida;
  componentes: RecetaComponente[];
  costoEstimado: number;
  tiempoProduccionMin: number;
}

export interface DetallePedido {
  id: Identificador;
  pedidoId: Identificador;
  productoId: Identificador;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  importe: number;
  personalizacion?: string;
  archivoDiseno?: string;
}

export interface Pedido {
  id: Identificador;
  folio: string;
  clienteId: Identificador;
  fechaPedido: string;
  fechaEntrega: string;
  estado: EstadoPedido;
  prioridad: PrioridadPedido;
  subtotal: number;
  impuestos: number;
  total: number;
  anticipo: number;
  saldo: number;
  notas?: string;
  detalles: DetallePedido[];
}

export interface MovimientoInventario {
  id: Identificador;
  materiaPrimaId: Identificador;
  tipo: TipoMovimiento;
  cantidad: number;
  unidadMedida: UnidadMedida;
  fecha: string;
  referencia?: string;
  motivo?: string;
  usuarioId?: Identificador;
  costoUnitario?: number;
}

export interface ControlCalidad {
  aprobado: boolean;
  observaciones?: string;
  revisadoPor?: Identificador;
  fecha?: string;
}

export interface OrdenProduccion {
  id: Identificador;
  pedidoId: Identificador;
  etapa: EtapaProduccion;
  estado: EstadoProduccion;
  responsable?: Identificador;
  fechaInicio?: string;
  fechaFin?: string;
  observaciones?: string;
  controlCalidad?: ControlCalidad;
}

export interface Usuario {
  id: Identificador;
  nombre: string;
  correo: string;
  telefono?: string;
  rol: RolUsuario;
  permisos?: string[];
  activo: boolean;
  ultimoAcceso?: string | null;
}

export interface ActividadMarketing {
  id: Identificador;
  nombre: string;
  canal: CanalMarketing;
  fechaInicio: string;
  fechaFin: string;
  presupuesto: number;
  inversionReal?: number;
  ingresosAtribuidos?: number;
  roi?: number;
  estado: EstadoActividadMarketing;
  descripcion?: string;
}

export interface ResumenDashboard {
  ventasPeriodo: number;
  pedidosPeriodo: number;
  ticketPromedio: number;
  ordenesEnProduccion: number;
  materiasPrimasBajoStock: number;
  clientesActivos: number;
  solicitudesNuevas?: number;
  solicitudesEnRevision?: number;
}

/* ---------------------------------------------------------------------------
 * Portal público: solicitudes de cotización
 * ------------------------------------------------------------------------- */

export type EstadoSolicitud = 'nueva' | 'en-revision' | 'cotizada' | 'convertida' | 'descartada';

export type MetodoEntrega = 'taller' | 'domicilio' | 'paqueteria' | 'instalacion';

export type OrigenSolicitud = 'web' | 'whatsapp' | 'mostrador' | 'referido';

export type EstadoCotizacion =
  | 'borrador'
  | 'enviada'
  | 'aprobada'
  | 'rechazada'
  | 'vencida'
  | 'convertida';

export type TipoPago = 'anticipo' | 'saldo' | 'abono';

export interface ItemSolicitud {
  id?: number;
  productoId?: number | null;
  nombreProducto: string;
  especificaciones?: string;
  cantidad: number;
  precioEstimado?: number | null;
}

export interface ArchivoAdjunto {
  id: number;
  nombreOriginal: string;
  nombreGuardado?: string;
  mimeType?: string;
  tamanoBytes: number;
  url: string;
}

export interface SolicitudCotizacion {
  id: number;
  folio: string;
  nombreCliente: string;
  empresa?: string | null;
  correo: string;
  telefono?: string | null;
  segmento: SegmentoCliente;
  mensaje?: string | null;
  fechaDeseada?: string | null;
  metodoEntrega: MetodoEntrega;
  estado: EstadoSolicitud;
  origen: string;
  fechaCreacion: string;
  totalItems?: number;
  totalArchivos?: number;
  itemsSolicitados?: ItemSolicitud[];
  archivosAdjuntos?: ArchivoAdjunto[];
  cotizacionId?: number | null;
}

export interface ResumenSolicitudes {
  total: number;
  porEstado: Record<EstadoSolicitud, number>;
  nuevas: number;
  enRevision: number;
}

export interface ArchivoSeguimiento {
  nombre: string;
  tamanoBytes: number;
}

export interface SeguimientoSolicitud {
  folio: string;
  estado: EstadoSolicitud;
  fechaCreacion: string;
  fechaDeseada?: string | null;
  nombreCliente: string;
  empresa?: string | null;
  mensaje?: string | null;
  items: ItemSolicitud[];
  archivos: ArchivoSeguimiento[];
  cotizacion: { folio: string; estado: EstadoCotizacion; total: number } | null;
  actualizadoEn: string;
}

export interface RespuestaPaginada<T> {
  items: T[];
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
}

export interface RespuestaLogin {
  token: string;
  tokenType: string;
  expiraEn: string;
  usuario: Usuario;
  permisos: string[];
}

export interface AuthSession {
  usuario: Usuario;
  token: string;
  permisos: string[];
  expiraEn?: string;
}

export interface ProductoPublico {
  id: number;
  nombre: string;
  descripcion?: string | null;
  categoria: CategoriaProducto;
  lineaProduccion: LineaProduccion;
  precioBase: number;
  unidadVenta: UnidadMedida;
  icono?: string;
}

export interface ItemCotizacion {
  productoId?: number | null;
  descripcion: string;
  especificaciones?: string;
  cantidad: number;
  precioUnitario: number;
  importe: number;
}

export interface Cotizacion {
  id: number;
  folio: string;
  solicitudId?: number | null;
  clienteId: number;
  cliente?: string;
  usuario?: string;
  estado: EstadoCotizacion;
  fechaEmision: string;
  vigenciaDias: number;
  subtotal: number;
  impuestos: number;
  total: number;
  anticipo: number;
  saldo: number;
  notas?: string | null;
  creadoEn: string;
  items?: ItemCotizacion[];
}

export interface NuevaSolicitudPayload {
  nombreCliente: string;
  empresa?: string;
  correo: string;
  telefono?: string;
  segmento: SegmentoCliente;
  mensaje?: string;
  fechaDeseada?: string | null;
  metodoEntrega: MetodoEntrega;
  items: ItemSolicitud[];
  archivos?: File[];
}


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
  'cotizacion' | 'confirmado' | 'en-produccion' | 'listo' | 'entregado' | 'cancelado';

export type PrioridadPedido = 'baja' | 'media' | 'alta' | 'urgente';

export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste' | 'merma' | 'devolucion';

export type EtapaProduccion =
  | 'diseno'
  | 'impresion'
  | 'laminado'
  | 'corte'
  | 'plasmado'
  | 'confeccion'
  | 'armado'
  | 'acabado'
  | 'empaquetado'
  | 'entrega';

export type EstadoProduccion = 'pendiente' | 'en-proceso' | 'pausada' | 'completada' | 'rechazada';

export type RolUsuario = 'admin' | 'ventas' | 'produccion' | 'inventario' | 'marketing';

export type SegmentoCliente =
  'corporativo' | 'pyme' | 'escolar' | 'gobierno' | 'eventos' | 'particular' | 'otro';

export type CanalMarketing =
  'redes-sociales' | 'google-ads' | 'correo' | 'punto-de-venta' | 'referidos' | 'otro';

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
  imagenUrl?: string | null;
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

export interface RolApi {
  id: number;
  nombre: RolUsuario;
  descripcion?: string | null;
  permisos?: string[];
}

export interface NuevoUsuarioPayload {
  nombre: string;
  correo: string;
  password: string;
  rol: RolUsuario;
  telefono?: string;
}

export interface ActualizarUsuarioPayload {
  nombre: string;
  correo: string;
  rol: RolUsuario;
  password?: string;
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
  'borrador' | 'enviada' | 'aprobada' | 'rechazada' | 'vencida' | 'convertida';

export type TipoPago = 'anticipo' | 'saldo' | 'abono';

export interface ItemSolicitud {
  id?: number;
  productoId?: number | null;
  nombreProducto: string;
  especificaciones?: string;
  cantidad: number;
  precioEstimado?: number | null;
  /** Descuento de mayoreo ya incluido en `precioEstimado` (6+ unidades). */
  descuentoMayoreo?: number | null;
}

export interface CapaMockup {
  nombre: string;
  x: number;
  y: number;
  escala: number;
  rotacion: number;
}

/** Metadatos técnicos del diseño personalizado que acompañan a la captura. */
export interface MockupDisenoData {
  productoId: number | null;
  productoNombre: string;
  vista: '2d' | '3d';
  color: string;
  material?: string | null;
  medidas?: { ancho: number; alto: number } | null;
  capas: CapaMockup[];
  capturadoEn: string;
}

export interface ArchivoAdjunto {
  id: number;
  nombreOriginal: string;
  nombreGuardado?: string;
  mimeType?: string;
  tamanoBytes: number;
  mockupData?: MockupDisenoData | null;
  esMockup?: boolean;
  url: string;
}

export interface ProduccionResumenSolicitud {
  estado: EstadoProduccion;
  etapa: EtapaProduccion;
  fechaFin?: string | null;
}

export interface PedidoResumenSolicitud {
  id: number;
  folio: string;
  estado: EstadoPedido;
  fechaEntrega?: string | null;
  produccion?: ProduccionResumenSolicitud | null;
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
  mensajes?: MensajeChat[];
  cotizacionId?: number | null;
  pedido?: PedidoResumenSolicitud | null;
}

export interface ResumenSolicitudes {
  total: number;
  porEstado: Record<EstadoSolicitud, number>;
  nuevas: number;
  enRevision: number;
  enProduccion: number;
  produccionCompletada: number;
  entregados: number;
}

export interface ArchivoSeguimiento {
  nombre: string;
  tamanoBytes: number;
}

export type RemitenteChat = 'cliente' | 'interno';

export interface AdjuntoChat {
  nombre: string;
  mimeType?: string | null;
  tamanoBytes: number;
}

export interface MensajeChat {
  id: number;
  solicitudId: number;
  remitenteTipo: RemitenteChat;
  usuarioId?: number | null;
  autor: string;
  mensaje: string;
  adjunto?: AdjuntoChat | null;
  creadoEn: string;
}

export interface SeguimientoEtapa {
  id: number;
  etapa: EtapaProduccion;
  estado: EstadoProduccion;
  inicio?: string | null;
  fin?: string | null;
  creadoEn?: string | null;
}

export interface SeguimientoPedido {
  folio: string;
  estado: EstadoPedido;
  fechaDeseada?: string | null;
  fechaEntrega?: string | null;
  notaEntrega?: string | null;
  confirmadoEn?: string | null;
  entregaConfirmadaEn?: string | null;
  entregaConfirmadaPor?: string | null;
  actualizadoEn?: string | null;
  etapaActual?: EtapaProduccion | null;
  estadoProduccion?: EstadoProduccion | null;
  historialEtapas: SeguimientoEtapa[];
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
  mensajes: MensajeChat[];
  cotizacion: { folio: string; estado: EstadoCotizacion; total: number } | null;
  pedido?: SeguimientoPedido | null;
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
  imagenUrl?: string | null;
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
  fechaDeseada?: string | null;
  vigenciaDias: number;
  subtotal: number;
  impuestos: number;
  total: number;
  anticipo: number;
  saldo: number;
  notas?: string | null;
  inventarioDescontado?: boolean;
  descuento?: DescuentoResultado;
  creadoEn: string;
  items?: ItemCotizacion[];
}

export interface DescuentoResultado {
  descontados: Array<{
    materia: string;
    cantidad: number;
    stock_restante: number;
    bajo_stock: boolean;
  }>;
  alertas: string[];
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
  /** Metadatos de los archivos que son capturas de mockup, indexados por nombre. */
  mockups?: Array<{ nombre: string; datos: MockupDisenoData }>;
}

/* ---------------------------------------------------------------------------
 * Contratos de la API interna (ERP)
 * ------------------------------------------------------------------------- */

export interface ClienteApi {
  id: number;
  nombre: string;
  empresa?: string | null;
  correo: string;
  telefono?: string | null;
  direccion?: string | null;
  rfc?: string | null;
  segmento: SegmentoCliente;
  notas?: string | null;
  activo: boolean;
  fechaRegistro: string;
  totalPedidos?: number;
  totalFacturado?: number;
}

export interface ProductoApi {
  id: number;
  nombre: string;
  descripcion?: string | null;
  categoria: CategoriaProducto;
  lineaProduccion: LineaProduccion;
  precioBase: number;
  unidadVenta: UnidadMedida;
  icono?: string;
  imagenUrl?: string | null;
  publicado: boolean;
  activo: boolean;
  tieneReceta?: boolean;
}

export interface RecetaComponenteApi {
  id: number;
  materiaPrimaId: number;
  materiaPrima?: string;
  cantidad: number;
  unidadMedida: UnidadMedida;
  desperdicioPorcentaje: number;
}

export interface RecetaApi {
  id: number;
  productoId: number;
  nombre: string;
  rendimiento: number;
  unidadRendimiento: UnidadMedida;
  costoEstimado: number;
  tiempoProduccionMin: number;
  componentes: RecetaComponenteApi[];
}

export interface ComponenteReceta {
  id: number;
  materiaPrimaId: number;
  nombreMateriaPrima: string;
  cantidad: number;
  unidadMedida: UnidadMedida;
  desperdicioPorcentaje: number;
  stockActual: number;
  bajoStock: boolean;
}

export interface RecetaInsumos {
  id: number;
  nombre: string;
  rendimiento: number;
  unidadRendimiento: UnidadMedida;
  componentes: ComponenteReceta[];
}

export interface ProductoConReceta extends ProductoApi {
  receta: RecetaInsumos | null;
}

export interface MateriaPrimaApi {
  id: number;
  nombre: string;
  categoria: CategoriaMateriaPrima | string;
  unidadMedida: UnidadMedida;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
  costoUnitario: number;
  proveedorId?: number | null;
  proveedor?: string | null;
  activo: boolean;
  bajoStock?: boolean;
}

export interface MovimientoApi {
  id: number;
  materiaPrimaId: number;
  materiaPrima?: string;
  tipo: TipoMovimiento;
  cantidad: number;
  unidadMedida: UnidadMedida;
  costoUnitario?: number;
  referencia?: string | null;
  motivo?: string | null;
  usuario?: string | null;
  fecha: string;
}

export interface ProveedorApi {
  id: number;
  nombre: string;
  contacto?: string | null;
  telefono?: string | null;
  correo?: string | null;
  condicionesPago?: string | null;
  activo: boolean;
}

export interface OrdenCompraItemApi {
  id: number;
  materiaPrimaId: number;
  materiaPrima?: string;
  cantidad: number;
  unidadMedida: UnidadMedida;
  precioUnitario: number;
  importe: number;
}

export interface OrdenCompraApi {
  id: number;
  folio: string;
  proveedorId: number;
  proveedor?: string;
  estado: string;
  fechaEmision: string;
  fechaEntrega?: string | null;
  subtotal: number;
  impuestos: number;
  total: number;
  notas?: string | null;
  items: OrdenCompraItemApi[];
}

export interface PagoApi {
  id: number;
  pedidoId: number;
  tipo: TipoPago;
  metodo: string;
  monto: number;
  referencia?: string | null;
  fechaPago: string;
  confirmado: boolean;
}

export interface PedidoItemApi {
  id: number;
  productoId?: number | null;
  descripcion: string;
  especificaciones?: string | null;
  cantidad: number;
  precioUnitario: number;
  importe: number;
  archivoDiseno?: string | null;
}

export interface ProduccionEtapaApi {
  id: number;
  etapa: EtapaProduccion;
  estado: string;
  responsable?: string | null;
  inicio?: string | null;
  fin?: string | null;
  notas?: string | null;
  creadoEn: string;
}

export interface ControlCalidadApi {
  id: number;
  criterio: string;
  aprobado: boolean;
  observaciones?: string | null;
  revisadoPor?: string | null;
  fecha?: string | null;
}

export interface OrdenProduccionApi {
  id: number;
  pedidoId: number;
  pedidoFolio?: string;
  etapa: EtapaProduccion;
  estado: EstadoProduccion;
  responsableId?: number | null;
  responsable?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  observaciones?: string | null;
  historialEtapas: ProduccionEtapaApi[];
  controlesCalidad: ControlCalidadApi[];
}

export interface PedidoApi {
  id: number;
  folio: string;
  cotizacionId?: number | null;
  clienteId: number;
  cliente?: string | null;
  estado: EstadoPedido;
  prioridad: PrioridadPedido;
  fechaPedido: string;
  fechaEntrega?: string | null;
  notaEntrega?: string | null;
  entregaConfirmadaEn?: string | null;
  entregaConfirmadaPor?: string | null;
  entregaConfirmadaPorId?: number | null;
  subtotal: number;
  impuestos: number;
  total: number;
  anticipo: number;
  saldo: number;
  pagado?: number;
  notas?: string | null;
  items?: PedidoItemApi[];
  pagos?: PagoApi[];
  ordenProduccion?: OrdenProduccionApi | null;
  inventarioDescontado?: boolean;
  descuento?: DescuentoResultado;
}

export interface TableroProduccion {
  columnas: Array<{ etapa: EtapaProduccion; ordenes: OrdenProduccionApi[] }>;
  etapas?: EtapaProduccion[];
  total: number;
}

export interface ActividadMarketingApi {
  id: number;
  nombre: string;
  canal: CanalMarketing;
  fechaInicio: string;
  fechaFin?: string | null;
  presupuesto: number;
  inversionReal: number;
  ingresosAtribuidos: number;
  roi: number;
  estado: EstadoActividadMarketing;
  descripcion?: string | null;
}

export interface ResumenDashboardApi extends ResumenDashboard {
  pedidosRecientes: PedidoApi[];
  bajoStock: MateriaPrimaApi[];
  produccionPorEtapa: Array<{ etapa: EtapaProduccion; total: number }>;
  ventasPorLinea: Array<{ linea: string; total: number }>;
  ventasMesAnterior: number;
  variacionVentas: number;
}

export interface NotificacionResultado {
  mensaje: string;
}

export interface PedidoConsultaApi extends PedidoApi {
  lineas: string[];
  partidas: number;
}

export interface ResumenConsultaApi {
  pedidos: number;
  monto: number;
  ticket: number;
  entregados: number;
}

export interface ConsultaPedidosApi extends RespuestaPaginada<PedidoConsultaApi> {
  resumen: ResumenConsultaApi;
  ventasPorLinea: Array<{ linea: string; total: number }>;
  topClientes: Array<{ id: number; nombre: string; pedidos: number; total: number }>;
}

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
  rol: RolUsuario;
  activo: boolean;
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
}

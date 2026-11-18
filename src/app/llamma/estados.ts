import type {
  CanalMarketing,
  CategoriaMateriaPrima,
  CategoriaProducto,
  EstadoActividadMarketing,
  EstadoCotizacion,
  EstadoPedido,
  EstadoProduccion,
  EstadoSolicitud,
  EtapaProduccion,
  LineaProduccion,
  PrioridadPedido,
  SegmentoCliente,
  TipoMovimiento,
  UnidadMedida,
} from './llamma.models';

/**
 * Catálogo único de estados y opciones compartidas por el portal y el ERP.
 *
 * Los valores deben coincidir con las constantes del backend
 * (`Flask_Llamma_API/estados.py`) y con las uniones de `llamma.models.ts`.
 * Así, un estado nuevo se declara una sola vez por lado y no se dispersa en
 * etiquetas y badges de cada pantalla.
 */
export interface Opcion<T extends string = string> {
  valor: T;
  etiqueta: string;
  /** Variante plural para filtros y contadores. */
  plural?: string;
  /** Clase de badge compartida. */
  badge?: string;
  /** Icono de Bootstrap Icons. */
  icono?: string;
  /** Unidad abreviada (`m²`, `pza`). */
  corta?: string;
  /** Punto de color de tableros y gráficas. */
  dot?: string;
  /** Signo del movimiento de inventario. */
  signo?: string;
}

/* ------------------------------ Solicitudes ------------------------------ */

export const ESTADOS_SOLICITUD: readonly Opcion<EstadoSolicitud>[] = [
  { valor: 'nueva', etiqueta: 'Nueva', plural: 'Nuevas', badge: 'badge-soft-cyan' },
  {
    valor: 'en-revision',
    etiqueta: 'En revisión',
    plural: 'En revisión',
    badge: 'badge-soft-warning',
  },
  { valor: 'cotizada', etiqueta: 'Cotizada', plural: 'Cotizadas', badge: 'badge-soft-magenta' },
  {
    valor: 'convertida',
    etiqueta: 'Convertida',
    plural: 'Convertidas',
    badge: 'badge-soft-success',
  },
  { valor: 'descartada', etiqueta: 'Descartada', plural: 'Descartadas', badge: 'badge-soft-muted' },
];

/* ------------------------------ Cotizaciones ----------------------------- */

export const ESTADOS_COTIZACION: readonly Opcion<EstadoCotizacion>[] = [
  { valor: 'borrador', etiqueta: 'Borrador', badge: 'badge-soft-muted' },
  { valor: 'enviada', etiqueta: 'Enviada', badge: 'badge-soft-cyan' },
  { valor: 'aprobada', etiqueta: 'Aprobada', badge: 'badge-soft-success' },
  { valor: 'rechazada', etiqueta: 'Rechazada', badge: 'badge-soft-danger' },
  { valor: 'vencida', etiqueta: 'Vencida', badge: 'badge-soft-muted' },
  { valor: 'convertida', etiqueta: 'Convertida a pedido', badge: 'badge-soft-success' },
];

/* -------------------------------- Pedidos -------------------------------- */

export const ESTADOS_PEDIDO: readonly Opcion<EstadoPedido>[] = [
  { valor: 'cotizacion', etiqueta: 'Cotización', badge: 'badge-soft-cyan' },
  { valor: 'confirmado', etiqueta: 'Confirmado', badge: 'badge-soft-warning' },
  { valor: 'en-produccion', etiqueta: 'En producción', badge: 'badge-soft-cyan' },
  { valor: 'listo', etiqueta: 'Listo', badge: 'badge-soft-success' },
  { valor: 'entregado', etiqueta: 'Entregado', badge: 'badge-soft-success' },
  { valor: 'cancelado', etiqueta: 'Cancelado', badge: 'badge-soft-danger' },
];

export const PRIORIDADES: readonly Opcion<PrioridadPedido>[] = [
  { valor: 'baja', etiqueta: 'Prioridad baja' },
  { valor: 'media', etiqueta: 'Prioridad media' },
  { valor: 'alta', etiqueta: 'Prioridad alta' },
  { valor: 'urgente', etiqueta: 'Prioridad urgente' },
];

/* ------------------------------- Producción ------------------------------ */

export const ETAPAS_PRODUCCION: readonly Opcion<EtapaProduccion>[] = [
  { valor: 'diseno', etiqueta: 'Diseño', icono: 'bi-vector-pen', dot: 'dot-cyan' },
  { valor: 'impresion', etiqueta: 'Impresión', icono: 'bi-printer', dot: 'dot-magenta' },
  { valor: 'laminado', etiqueta: 'Laminado', icono: 'bi-layers', dot: 'dot-cyan' },
  { valor: 'corte', etiqueta: 'Corte', icono: 'bi-scissors', dot: 'dot-yellow' },
  { valor: 'confeccion', etiqueta: 'Confección', icono: 'bi-bag', dot: 'dot-magenta' },
  { valor: 'armado', etiqueta: 'Armado', icono: 'bi-tools', dot: 'dot-yellow' },
  { valor: 'acabado', etiqueta: 'Acabado', icono: 'bi-stars', dot: 'dot-ink' },
  { valor: 'entrega', etiqueta: 'Entrega', icono: 'bi-box-seam', dot: 'dot-ink' },
];

export const ESTADOS_PRODUCCION: readonly Opcion<EstadoProduccion>[] = [
  { valor: 'pendiente', etiqueta: 'Pendiente', badge: 'badge-soft-muted' },
  { valor: 'en-proceso', etiqueta: 'En proceso', badge: 'badge-soft-cyan' },
  { valor: 'pausada', etiqueta: 'Pausada', badge: 'badge-soft-warning' },
  { valor: 'completada', etiqueta: 'Completada', badge: 'badge-soft-success' },
  { valor: 'rechazada', etiqueta: 'Rechazada', badge: 'badge-soft-danger' },
];

/* ------------------------------ Compras ---------------------------------- */

export const ESTADOS_COMPRA: readonly Opcion[] = [
  { valor: 'pendiente', etiqueta: 'Pendiente', badge: 'badge-soft-muted' },
  { valor: 'confirmada', etiqueta: 'Confirmada', badge: 'badge-soft-warning' },
  { valor: 'en-transito', etiqueta: 'En tránsito', badge: 'badge-soft-cyan' },
  { valor: 'recibida', etiqueta: 'Recibida', badge: 'badge-soft-success' },
  { valor: 'cancelada', etiqueta: 'Cancelada', badge: 'badge-soft-danger' },
];

/** Estados de una OC que todavía no llega a bodega. */
export const COMPRAS_ABIERTAS = new Set(['pendiente', 'confirmada', 'en-transito']);

/* ------------------------------- Marketing ------------------------------- */

export const CANALES_MARKETING: readonly Opcion<CanalMarketing>[] = [
  { valor: 'redes-sociales', etiqueta: 'Redes sociales', icono: 'bi-camera', dot: 'dot-cyan' },
  { valor: 'google-ads', etiqueta: 'Google Ads', icono: 'bi-google', dot: 'dot-yellow' },
  { valor: 'correo', etiqueta: 'Email', icono: 'bi-envelope-paper', dot: 'dot-ink' },
  { valor: 'punto-de-venta', etiqueta: 'Punto de venta', icono: 'bi-shop', dot: 'dot-magenta' },
  { valor: 'referidos', etiqueta: 'Referidos', icono: 'bi-people', dot: 'dot-cyan' },
  { valor: 'otro', etiqueta: 'Otro', icono: 'bi-three-dots', dot: 'dot-ink' },
];

export const ESTADOS_ACTIVIDAD: readonly Opcion<EstadoActividadMarketing>[] = [
  { valor: 'planeada', etiqueta: 'Planeación', badge: 'badge-soft-warning' },
  { valor: 'activa', etiqueta: 'Activa', badge: 'badge-soft-cyan' },
  { valor: 'finalizada', etiqueta: 'Finalizada', badge: 'badge-soft-success' },
  { valor: 'cancelada', etiqueta: 'Cancelada', badge: 'badge-soft-danger' },
];

/* -------------------------------- Clientes ------------------------------- */

export const SEGMENTOS_CLIENTE: readonly Opcion<SegmentoCliente>[] = [
  { valor: 'corporativo', etiqueta: 'Corporativo', badge: 'badge-soft-cyan' },
  { valor: 'pyme', etiqueta: 'Pyme', badge: 'badge-soft-magenta' },
  { valor: 'eventos', etiqueta: 'Eventos', badge: 'badge-soft-yellow' },
  { valor: 'escolar', etiqueta: 'Escolar', badge: 'badge-soft-muted' },
  { valor: 'particular', etiqueta: 'Particular', badge: 'badge-soft-success' },
  { valor: 'gobierno', etiqueta: 'Gobierno', badge: 'badge-soft-cyan' },
  { valor: 'otro', etiqueta: 'Otro', badge: 'badge-soft-muted' },
];

/* ------------------------------ Catálogo --------------------------------- */

export const LINEAS_PRODUCCION: readonly Opcion<LineaProduccion>[] = [
  { valor: 'gran-formato', etiqueta: 'Gran formato' },
  { valor: 'textil', etiqueta: 'Textil' },
  { valor: 'promocionales', etiqueta: 'Promocionales' },
  { valor: 'papeleria', etiqueta: 'Papelería' },
];

export const CATEGORIAS_PRODUCTO: readonly Opcion<CategoriaProducto>[] = [
  { valor: 'display', etiqueta: 'Display' },
  { valor: 'senaletica', etiqueta: 'Señalética' },
  { valor: 'rotulacion', etiqueta: 'Rotulación' },
  { valor: 'bastidor', etiqueta: 'Bastidor' },
  { valor: 'textil', etiqueta: 'Textil' },
  { valor: 'promocional', etiqueta: 'Promocional' },
  { valor: 'papeleria', etiqueta: 'Papelería' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export const CATEGORIAS_MATERIA: readonly Opcion<CategoriaMateriaPrima>[] = [
  { valor: 'lona', etiqueta: 'Lonas', icono: 'bi-layers' },
  { valor: 'vinil', etiqueta: 'Viniles', icono: 'bi-square' },
  { valor: 'tinta', etiqueta: 'Tintas', icono: 'bi-droplet-half' },
  { valor: 'papel', etiqueta: 'Papeles', icono: 'bi-file-earmark-text' },
  { valor: 'herrajes', etiqueta: 'Herrajes', icono: 'bi-disc' },
  { valor: 'estructura', etiqueta: 'Estructuras', icono: 'bi-bounding-box' },
  { valor: 'lamina', etiqueta: 'Rígidos', icono: 'bi-grid-3x3' },
  { valor: 'laminado', etiqueta: 'Acabados', icono: 'bi-arrow-repeat' },
  { valor: 'adhesivo', etiqueta: 'Adhesivos', icono: 'bi-stickies' },
  { valor: 'perfil', etiqueta: 'Perfiles', icono: 'bi-bounding-box-circles' },
  { valor: 'textil', etiqueta: 'Textil', icono: 'bi-bag' },
  { valor: 'promocional', etiqueta: 'Promocionales', icono: 'bi-gift' },
  { valor: 'otro', etiqueta: 'Otros', icono: 'bi-box-seam' },
];

export const UNIDADES: readonly Opcion<UnidadMedida>[] = [
  { valor: 'pieza', etiqueta: 'Pieza', corta: 'pza' },
  { valor: 'm2', etiqueta: 'Metro cuadrado (m²)', corta: 'm²' },
  { valor: 'ml', etiqueta: 'Metro lineal (ml)', corta: 'ml' },
  { valor: 'hoja', etiqueta: 'Hoja', corta: 'hoja' },
  { valor: 'kg', etiqueta: 'Kilogramo', corta: 'kg' },
  { valor: 'litro', etiqueta: 'Litro', corta: 'L' },
];

export const TIPOS_MOVIMIENTO: readonly Opcion<TipoMovimiento>[] = [
  { valor: 'entrada', etiqueta: 'Entrada', signo: '+' },
  { valor: 'salida', etiqueta: 'Salida', signo: '−' },
  { valor: 'ajuste', etiqueta: 'Ajuste de conteo', signo: '=' },
  { valor: 'merma', etiqueta: 'Merma', signo: '−' },
  { valor: 'devolucion', etiqueta: 'Devolución', signo: '+' },
];

/* ------------------------------- Archivos -------------------------------- */

export const EXTENSIONES_ARCHIVO = ['pdf', 'ai', 'psd', 'png', 'jpg', 'jpeg', 'svg', 'zip'];
export const MAX_BYTES_ARCHIVO = 25 * 1024 * 1024;

/* ------------------------------- Ayudas ---------------------------------- */

/** Etiqueta legible de un valor; si no existe, devuelve el valor original. */
export function etiquetaDe(lista: readonly Opcion[], valor: string | null | undefined): string {
  if (!valor) return '';
  return lista.find((opcion) => opcion.valor === valor)?.etiqueta ?? valor;
}

/** Badge asociado a un valor, con el tono neutro como respaldo. */
export function badgeDe(
  lista: readonly Opcion[],
  valor: string | null | undefined,
  respaldo = 'badge-soft-muted',
): string {
  if (!valor) return respaldo;
  return lista.find((opcion) => opcion.valor === valor)?.badge ?? respaldo;
}

/** Icono asociado a un valor, con un icono genérico como respaldo. */
export function iconoDe(
  lista: readonly Opcion[],
  valor: string | null | undefined,
  respaldo = 'bi-circle',
): string {
  if (!valor) return respaldo;
  return lista.find((opcion) => opcion.valor === valor)?.icono ?? respaldo;
}

/** Convierte una lista de opciones en un mapa `valor → etiqueta`. */
export function mapaEtiquetas(lista: readonly Opcion[]): Record<string, string> {
  return Object.fromEntries(lista.map((opcion) => [opcion.valor, opcion.etiqueta]));
}

/** Convierte una lista de opciones en un mapa `valor → icono`. */
export function mapaIconos(lista: readonly Opcion[]): Record<string, string> {
  return Object.fromEntries(
    lista.filter((opcion) => opcion.icono).map((opcion) => [opcion.valor, opcion.icono as string]),
  );
}

/** Convierte una lista de opciones en un mapa `valor → unidad corta`. */
export function mapaCortas(lista: readonly Opcion[]): Record<string, string> {
  return Object.fromEntries(
    lista.filter((opcion) => opcion.corta).map((opcion) => [opcion.valor, opcion.corta as string]),
  );
}

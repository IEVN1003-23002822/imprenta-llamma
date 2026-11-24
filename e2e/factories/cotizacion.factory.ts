export interface CotizacionInput {
  solicitudId?: number;
  clienteId?: number;
  items: Array<{
    productoId?: number;
    descripcion?: string;
    cantidad: number;
    precioUnitario?: number;
    precioEstimado?: number;
  }>;
  vigenciaDias?: number;
  notas?: string;
}

export const cotizacionFactory = {
  desdeSolicitud(solicitudId: number, items: CotizacionInput['items']): CotizacionInput {
    return { solicitudId, items, vigenciaDias: 15, notas: 'Cotización E2E' };
  },
  manual(clienteId: number, items: CotizacionInput['items']): CotizacionInput {
    return { clienteId, items, vigenciaDias: 15 };
  },
};

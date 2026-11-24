import { correoUnico, unico } from '../helpers/datos';

export interface SolicitudInput {
  nombre: string;
  correo: string;
  telefono: string;
  empresa: string;
  mensaje: string;
  items: Array<{
    productoId: number | null;
    nombreProducto: string;
    cantidad: number;
    especificaciones?: string;
    precioEstimado?: number;
  }>;
}

export const solicitudFactory = {
  valida(
    producto: { id: number | null; nombre: string },
    overrides: Partial<SolicitudInput> = {},
  ): SolicitudInput {
    return {
      nombre: `Cliente ${unico('e2e')}`,
      correo: correoUnico('cliente'),
      telefono: '5551234567',
      empresa: 'Empresa E2E',
      mensaje: 'Solicitud generada por la suite E2E',
      items: [
        {
          productoId: producto.id,
          nombreProducto: producto.nombre,
          cantidad: 2,
          especificaciones: 'Medida por confirmar',
        },
      ],
      ...overrides,
    };
  },
};

export interface PedidoInput {
  clienteId: number;
  items: Array<{ productoId: number; cantidad: number; precioUnitario?: number }>;
  estado?: string;
  prioridad?: string;
}

export const pedidoFactory = {
  valido(clienteId: number, productoId: number, cantidad = 1): PedidoInput {
    return {
      clienteId,
      items: [{ productoId, cantidad }],
      estado: 'confirmado',
      prioridad: 'media',
    };
  },
};

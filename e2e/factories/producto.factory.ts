import { unico } from '../helpers/datos';

export interface ProductoInput {
  nombre: string;
  descripcion: string;
  categoria: string;
  lineaProduccion: string;
  precioBase: number;
  unidadVenta: string;
  icono: string;
  imagenUrl: string;
  publicado: boolean;
  activo: boolean;
  receta?: {
    rendimiento: number;
    unidadRendimiento: string;
    componentes: Array<{
      materiaPrimaId: number;
      cantidad: number;
      unidadMedida: string;
      desperdicioPorcentaje: number;
    }>;
  };
}

export const productoFactory = {
  valido(overrides: Partial<ProductoInput> = {}): ProductoInput {
    return {
      nombre: `Producto ${unico('e2e')}`,
      descripcion: 'Producto creado por la suite E2E',
      categoria: 'gran-formato',
      lineaProduccion: 'gran-formato',
      precioBase: 220,
      unidadVenta: 'm2',
      icono: 'bi-layers',
      imagenUrl: '/assets/images/catalogo/gran-formato/lona-frontlit-impresa.webp',
      publicado: true,
      activo: true,
      ...overrides,
    };
  },
};

export const productoInvalido = {
  precioNegativo: (overrides: Partial<ProductoInput> = {}) =>
    productoFactory.valido({ precioBase: -50, ...overrides }),
  nombreVacio: (overrides: Partial<ProductoInput> = {}) =>
    productoFactory.valido({ nombre: '', ...overrides }),
};

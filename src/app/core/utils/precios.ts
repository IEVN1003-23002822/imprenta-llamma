/** Reglas de precio compartidas por el cotizador público y el comprobante. */

export const PIEZAS_MAYOREO = 6;
export const DESCUENTO_MAYOREO_UNITARIO = 20;
export const PRECIO_MINIMO = 0.01;

export function redondearMoneda(valor: number): number {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

export interface ResultadoMayoreo {
  total: number;
  descuento: number;
}

/**
 * Aplica $20 de descuento por unidad a partir de 6 unidades.
 *
 * Se calcula sobre el promedio unitario de la línea para que también funcione
 * con partidas por m². Si el promedio unitario es de $20 o menos, se conserva
 * el importe original para no dejar la partida en cero o negativa.
 */
export function precioLineaMayoreo(cantidad: number, baseLinea: number): ResultadoMayoreo {
  const unidades = Number(cantidad);
  const base = redondearMoneda(Math.max(0, Number(baseLinea) || 0));
  if (!Number.isFinite(unidades) || unidades < PIEZAS_MAYOREO || base <= 0) {
    return { total: base, descuento: 0 };
  }

  const unitario = base / unidades;
  if (!Number.isFinite(unitario) || unitario <= DESCUENTO_MAYOREO_UNITARIO) {
    return { total: base, descuento: 0 };
  }

  const descuento = Math.min(
    redondearMoneda(DESCUENTO_MAYOREO_UNITARIO * unidades),
    redondearMoneda(base - PRECIO_MINIMO),
  );
  return {
    total: redondearMoneda(base - descuento),
    descuento: redondearMoneda(descuento),
  };
}

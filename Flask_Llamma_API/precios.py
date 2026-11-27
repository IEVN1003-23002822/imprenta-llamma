"""Reglas centrales de precio de mayoreo para solicitudes y cotizaciones.

La rebaja es de $20 por unidad a partir de 6 unidades. Se calcula sobre el
promedio unitario de la línea para que también funcione con partidas vendidas
por m² (lona/vinil). Si el promedio unitario es de $20 o menos, no se aplica
la rebaja para no dejar la partida en cero o negativa.

Los valores de lona/vinil deben coincidir con LONA_BASE, LONA_ADICIONAL,
VINIL_BASE y VINIL_ADICIONAL de `src/app/features/cotizar/cotizar.component.ts`.
"""

from __future__ import annotations

PIEZAS_MAYOREO = 6
DESCUENTO_MAYOREO_UNITARIO = 20.0
PRECIO_MINIMO = 0.01

LONA_BASE = 220.0
LONA_ADICIONAL = 120.0
VINIL_BASE = 180.0
VINIL_ADICIONAL = 90.0


def redondear_moneda(valor: float) -> float:
    return round(float(valor) + 1e-9, 2)


def precio_linea_mayoreo(cantidad: float, base_linea: float) -> tuple[float, float]:
    """Devuelve `(total_final, descuento)` de una línea.

    La rebaja es de $20 por unidad cuando la línea tiene 6 o más unidades.
    Se evita un total negativo o en cero: si la base es muy baja, no se aplica
    el descuento y se conserva el importe original.
    """
    unidades = max(float(cantidad or 0), 0)
    base = max(float(base_linea or 0), 0)
    if unidades < PIEZAS_MAYOREO or base <= 0:
        return redondear_moneda(base), 0.0

    unitario = base / unidades
    if unitario <= DESCUENTO_MAYOREO_UNITARIO:
        return redondear_moneda(base), 0.0

    descuento = min(
        redondear_moneda(DESCUENTO_MAYOREO_UNITARIO * unidades),
        redondear_moneda(base - PRECIO_MINIMO),
    )
    return redondear_moneda(base - descuento), redondear_moneda(descuento)


def es_lona_vinil(producto) -> bool:
    nombre = (getattr(producto, "nombre", "") or "").lower()
    return "lona/vinil" in nombre or "lona frontlit" in nombre


def es_vinil(nombre_producto: str, especificaciones: str | None) -> bool:
    texto = f"{nombre_producto or ''} {especificaciones or ''}".lower()
    return "(vinil)" in texto or "material: vinil" in texto


def precio_base_lona_vinil(
    cantidad: float, nombre_producto: str, especificaciones: str | None
) -> float:
    """Precio base de lona/vinil: primera unidad + adicionales por m².

    La fórmula replica la del cotizador público para que el importe guardado y
    el comprobante no cambien al aplicar mayoreo.
    """
    if es_vinil(nombre_producto, especificaciones):
        base, adicional = VINIL_BASE, VINIL_ADICIONAL
    else:
        base, adicional = LONA_BASE, LONA_ADICIONAL
    return redondear_moneda(base + max(0.0, float(cantidad or 0) - 1) * adicional)

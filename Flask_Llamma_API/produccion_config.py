"""Configuración central de pasos de producción por producto.

Los valores deben existir en `estados.ETAPAS` y en el catálogo del frontend
(`src/app/core/models/estados.ts`). Los pedidos nuevos reciben estos pasos al
crear su orden; los pedidos existentes conservan sus etapas históricas.
"""

from __future__ import annotations

PASOS_POR_LINEA: dict[str, tuple[str, ...]] = {
    "textil": ("diseno", "impresion", "plasmado", "empaquetado"),
    "gran-formato": ("diseno", "impresion", "corte", "empaquetado"),
    "promocionales": ("diseno", "impresion", "plasmado", "empaquetado"),
    "papeleria": ("diseno", "impresion", "corte", "empaquetado"),
}

PASOS_ROLLUP = ("diseno", "impresion", "empaquetado")
PASOS_STICKER = ("diseno", "impresion", "corte", "empaquetado")
PASOS_GENERALES = ("diseno", "impresion", "empaquetado")
ORDEN_PASOS = ("diseno", "impresion", "corte", "plasmado", "empaquetado")


def pasos_para_producto(producto) -> tuple[str, ...]:
    """Devuelve la secuencia del producto, con excepciones por nombre."""
    if producto is None:
        return PASOS_GENERALES
    nombre = (producto.nombre or "").lower()
    if "roll-up" in nombre or "roll up" in nombre:
        return PASOS_ROLLUP
    if "sticker" in nombre:
        return PASOS_STICKER
    return PASOS_POR_LINEA.get(producto.linea_produccion, PASOS_GENERALES)


def pasos_para_items(items) -> tuple[str, ...]:
    """Une los pasos de todas las partidas y los devuelve en orden canónico."""
    from models import Producto

    encontrados: set[str] = set()
    for item in items:
        producto = getattr(item, "producto", None)
        producto_id = getattr(item, "producto_id", None)
        if producto is None and producto_id:
            producto = Producto.query.get(producto_id)
        if producto is None:
            continue
        encontrados.update(pasos_para_producto(producto))
    if not encontrados:
        return PASOS_GENERALES
    return tuple(paso for paso in ORDEN_PASOS if paso in encontrados)

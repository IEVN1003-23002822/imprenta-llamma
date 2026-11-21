"""Catálogo de estados compartidos por la API.

Los valores deben coincidir con `src/app/core/models/estados.ts` para que el
contrato API ↔ frontend no se desincronice. Aquí viven como conjuntos porque
los endpoints solo validan pertenencia y ordenan para los mensajes de error;
`ETAPAS` es una tupla porque el tablero de producción depende de su orden.
"""

from __future__ import annotations

ESTADOS_SOLICITUD = {"nueva", "en-revision", "cotizada", "convertida", "descartada"}
ESTADOS_COTIZACION = {"borrador", "enviada", "aprobada", "rechazada", "vencida", "convertida"}
ESTADOS_PEDIDO = {"cotizacion", "confirmado", "en-produccion", "listo", "entregado", "cancelado"}
ETAPAS = (
    "diseno",
    "impresion",
    "laminado",
    "corte",
    "confeccion",
    "armado",
    "acabado",
    "entrega",
)
ESTADOS_PRODUCCION = {"pendiente", "en-proceso", "pausada", "completada", "rechazada"}
ESTADOS_COMPRA = {"pendiente", "confirmada", "en-transito", "recibida", "cancelada"}
CANALES = {"redes-sociales", "google-ads", "correo", "punto-de-venta", "referidos", "otro"}
TIPOS_MOVIMIENTO = {"entrada", "salida", "ajuste", "merma", "devolucion"}

__all__ = [
    "ESTADOS_SOLICITUD",
    "ESTADOS_COTIZACION",
    "ESTADOS_PEDIDO",
    "ETAPAS",
    "ESTADOS_PRODUCCION",
    "ESTADOS_COMPRA",
    "CANALES",
    "TIPOS_MOVIMIENTO",
]

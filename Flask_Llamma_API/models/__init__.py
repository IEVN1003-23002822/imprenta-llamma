"""Modelos SQLAlchemy de Llamma (27 tablas), organizados por dominio.

El esquema cubre seguridad/RBAC, clientes, catálogo y recetas, abastecimiento,
solicitudes públicas, cotizaciones, pedidos, producción y marketing.
"""

from __future__ import annotations

from models.base import TimestampMixin, iso, utcnow
from models.usuarios import Permiso, Rol, RolPermiso, SesionUsuario, Usuario
from models.catalogos import Cliente, Producto, Receta, RecetaComponente
from models.inventario import MateriaPrima, MovimientoInventario, Proveedor
from models.compras import OrdenCompra, OrdenCompraItem
from models.solicitudes import MensajeChat, SolicitudArchivo, SolicitudCotizacion, SolicitudItem
from models.ventas import Cotizacion, CotizacionItem, Pago, Pedido, PedidoItem
from models.produccion import ControlCalidad, OrdenProduccion, ProduccionEtapa
from models.marketing import ActividadMarketing

__all__ = [
    "TimestampMixin",
    "iso",
    "utcnow",
    "ActividadMarketing",
    "Cliente",
    "ControlCalidad",
    "Cotizacion",
    "CotizacionItem",
    "MateriaPrima",
    "MensajeChat",
    "MovimientoInventario",
    "OrdenCompra",
    "OrdenCompraItem",
    "OrdenProduccion",
    "Pago",
    "Pedido",
    "PedidoItem",
    "Permiso",
    "ProduccionEtapa",
    "Producto",
    "Proveedor",
    "Receta",
    "RecetaComponente",
    "Rol",
    "RolPermiso",
    "SesionUsuario",
    "SolicitudArchivo",
    "SolicitudCotizacion",
    "SolicitudItem",
    "Usuario",
    "TABLAS",
]

TABLAS = [
    Rol,
    Permiso,
    RolPermiso,
    Usuario,
    SesionUsuario,
    Cliente,
    Producto,
    Receta,
    RecetaComponente,
    Proveedor,
    MateriaPrima,
    MovimientoInventario,
    OrdenCompra,
    OrdenCompraItem,
    SolicitudCotizacion,
    SolicitudItem,
    SolicitudArchivo,
    MensajeChat,
    Cotizacion,
    CotizacionItem,
    Pedido,
    PedidoItem,
    Pago,
    OrdenProduccion,
    ProduccionEtapa,
    ControlCalidad,
    ActividadMarketing,
]

assert len(TABLAS) == 27, "El esquema de Llamma debe contener 27 tablas"

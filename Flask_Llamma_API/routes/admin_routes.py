"""Punto de entrada de las rutas internas del ERP.

Los endpoints están separados por dominio en `routes/*_routes.py`; este módulo
los reúne para que `register_blueprints` los registre bajo `/api` sin cambiar
ninguna URL pública.
"""

from __future__ import annotations

from routes.archivos_routes import archivos_bp
from routes.clientes_routes import clientes_bp
from routes.compras_routes import compras_bp
from routes.cotizaciones_routes import cotizaciones_bp
from routes.dashboard_routes import dashboard_bp
from routes.inventario_routes import inventario_bp
from routes.marketing_routes import marketing_bp
from routes.pedidos_routes import pedidos_bp
from routes.produccion_routes import produccion_bp
from routes.productos_routes import productos_bp
from routes.solicitudes_routes import solicitudes_bp
from routes.usuarios_routes import usuarios_bp

ADMIN_BLUEPRINTS = (
    solicitudes_bp,
    cotizaciones_bp,
    pedidos_bp,
    clientes_bp,
    productos_bp,
    inventario_bp,
    compras_bp,
    produccion_bp,
    marketing_bp,
    dashboard_bp,
    usuarios_bp,
    archivos_bp,
)

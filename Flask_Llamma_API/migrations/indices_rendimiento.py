"""Crea de forma idempotente los índices de rendimiento del esquema.

Uso (desde Flask_Llamma_API, con la base configurada en DATABASE_URL):
    .venv\\Scripts\\python.exe migrations\\indices_rendimiento.py
"""

from __future__ import annotations

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from sqlalchemy import inspect, text  # noqa: E402

from app import app  # noqa: E402
from extensions import db  # noqa: E402

# (tabla, índice, columnas en orden). Los nombres coinciden con models/*.py.
INDICES: list[tuple[str, str, str]] = [
    ("clientes", "ix_clientes_nombre", "nombre"),
    ("clientes", "ix_clientes_segmento", "segmento"),
    ("productos", "ix_productos_categoria", "categoria"),
    ("productos", "ix_productos_linea_produccion", "linea_produccion"),
    ("productos", "ix_productos_catalogo", "activo, publicado"),
    ("solicitudes_cotizacion", "ix_solicitudes_cotizacion_creado_en", "creado_en"),
    ("cotizaciones", "ix_cotizaciones_estado", "estado"),
    ("cotizaciones", "ix_cotizaciones_fecha_emision", "fecha_emision"),
    ("cotizaciones", "ix_cotizaciones_creado_en", "creado_en"),
    ("pedidos", "ix_pedidos_fecha_pedido", "fecha_pedido"),
    ("pedidos", "ix_pedidos_creado_en", "creado_en"),
    ("pedidos", "ix_pedidos_estado_fecha", "estado, fecha_pedido"),
    ("pagos", "ix_pagos_fecha_pago", "fecha_pago"),
    ("ordenes_produccion", "ix_ordenes_produccion_etapa", "etapa"),
    ("ordenes_produccion", "ix_ordenes_produccion_creado_en", "creado_en"),
    ("ordenes_compra", "ix_ordenes_compra_estado", "estado"),
    ("ordenes_compra", "ix_ordenes_compra_fecha_emision", "fecha_emision"),
    ("ordenes_compra", "ix_ordenes_compra_creado_en", "creado_en"),
    ("materias_primas", "ix_materias_primas_nombre", "nombre"),
    ("materias_primas", "ix_materias_primas_categoria", "categoria"),
    ("materias_primas", "ix_materias_primas_activo_categoria", "activo, categoria"),
    ("movimientos_inventario", "ix_movimientos_inventario_tipo", "tipo"),
    ("movimientos_inventario", "ix_movimientos_inventario_creado_en", "creado_en"),
    ("actividades_marketing", "ix_actividades_marketing_estado", "estado"),
    ("actividades_marketing", "ix_actividades_marketing_fecha_inicio", "fecha_inicio"),
]


def main() -> None:
    with app.app_context():
        inspector = inspect(db.engine)
        existentes = {
            tabla: {indice["name"] for indice in inspector.get_indexes(tabla)}
            for tabla in inspector.get_table_names()
        }
        preparer = db.engine.dialect.identifier_preparer
        creados = 0
        with db.engine.begin() as conexion:
            for tabla, nombre, columnas in INDICES:
                if nombre in existentes.get(tabla, set()):
                    continue
                columnas_sql = ", ".join(
                    preparer.quote(columna.strip()) for columna in columnas.split(",")
                )
                conexion.execute(
                    text(
                        f"CREATE INDEX {preparer.quote(nombre)} "
                        f"ON {preparer.quote(tabla)} ({columnas_sql})"
                    )
                )
                creados += 1
        print(f"{creados} índices creados; {len(INDICES) - creados} ya existían")


if __name__ == "__main__":
    main()

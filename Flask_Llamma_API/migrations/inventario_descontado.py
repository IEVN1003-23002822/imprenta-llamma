"""Agrega la bandera de descuento de inventario a cotizaciones y pedidos.

Uso (desde Flask_Llamma_API, con la base configurada en DATABASE_URL):
    .venv\\Scripts\\python.exe migrations\\inventario_descontado.py

Es idempotente. En bases existentes marca como descontados los pedidos y las
cotizaciones ya convertidas, porque el flujo anterior descontaba al crear el
pedido; así se evita un segundo descuento al aprobar/convertir.
"""

from __future__ import annotations

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from sqlalchemy import inspect, text  # noqa: E402

from app import app  # noqa: E402
from extensions import db  # noqa: E402


def main() -> None:
    with app.app_context():
        inspector = inspect(db.engine)
        for tabla in ("cotizaciones", "pedidos"):
            columnas = {columna["name"] for columna in inspector.get_columns(tabla)}
            if "inventario_descontado" not in columnas:
                db.session.execute(
                    text(
                        f"ALTER TABLE {tabla} ADD COLUMN "
                        "inventario_descontado BOOLEAN NOT NULL DEFAULT 0"
                    )
                )
                print(f"{tabla}: columna inventario_descontado agregada")
            else:
                print(f"{tabla}: columna inventario_descontado ya existe")

        db.session.execute(text("UPDATE pedidos SET inventario_descontado = 1"))
        db.session.execute(
            text(
                "UPDATE cotizaciones SET inventario_descontado = 1 "
                "WHERE estado = 'convertida' "
                "OR id IN (SELECT cotizacion_id FROM pedidos WHERE cotizacion_id IS NOT NULL)"
            )
        )
        db.session.commit()
        print("Banderas históricas actualizadas")


if __name__ == "__main__":
    main()

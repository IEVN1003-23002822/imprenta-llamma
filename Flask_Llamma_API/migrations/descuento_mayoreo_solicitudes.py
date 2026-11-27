"""Agrega el descuento de mayoreo a las partidas de solicitud.

Uso (desde Flask_Llamma_API, con la base configurada en DATABASE_URL):
    .venv\\Scripts\\python.exe migrations\\descuento_mayoreo_solicitudes.py

Es idempotente. El importe final sigue viviendo en `precio_estimado`; esta
columna conserva cuánto se descontó para mostrarlo en el resumen y el PDF.
"""

from __future__ import annotations

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from sqlalchemy import inspect, text  # noqa: E402

from app import app  # noqa: E402
from extensions import db  # noqa: E402

TABLA = "solicitud_items"
COLUMNA = "descuento_mayoreo"


def main() -> None:
    with app.app_context():
        inspector = inspect(db.engine)
        if TABLA not in inspector.get_table_names():
            print(f"{TABLA}: la tabla no existe; crea el esquema con `flask --app app init-db`")
            return

        columnas = {columna["name"] for columna in inspector.get_columns(TABLA)}
        if COLUMNA not in columnas:
            db.session.execute(
                text(f"ALTER TABLE {TABLA} ADD COLUMN {COLUMNA} DECIMAL(12, 2) NOT NULL DEFAULT 0")
            )
            db.session.commit()
            print(f"{TABLA}: columna {COLUMNA} agregada")
        else:
            print(f"{TABLA}: columna {COLUMNA} ya existe")


if __name__ == "__main__":
    main()

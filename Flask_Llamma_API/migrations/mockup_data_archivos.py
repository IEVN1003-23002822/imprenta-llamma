"""Agrega la columna JSON de metadatos de mockup a los archivos de solicitud.

Uso (desde Flask_Llamma_API, con la base configurada en DATABASE_URL):
    .venv\\Scripts\\python.exe migrations\\mockup_data_archivos.py

Es idempotente. Guarda posición, escala, color y medidas del diseño que el
cliente personalizó en el cotizador (2D o 3D) para que producción lo replique.
"""

from __future__ import annotations

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from sqlalchemy import inspect, text  # noqa: E402

from app import app  # noqa: E402
from extensions import db  # noqa: E402

TABLA = "solicitud_archivos"
COLUMNA = "mockup_data"


def main() -> None:
    with app.app_context():
        inspector = inspect(db.engine)
        if TABLA not in inspector.get_table_names():
            print(f"{TABLA}: la tabla no existe; crea el esquema con `flask --app app init-db`")
            return

        columnas = {columna["name"] for columna in inspector.get_columns(TABLA)}
        if COLUMNA not in columnas:
            db.session.execute(text(f"ALTER TABLE {TABLA} ADD COLUMN {COLUMNA} JSON NULL"))
            db.session.commit()
            print(f"{TABLA}: columna {COLUMNA} agregada")
        else:
            print(f"{TABLA}: columna {COLUMNA} ya existe")


if __name__ == "__main__":
    main()

"""Agrega la confirmación y la nota de entrega a los pedidos.

Uso (desde Flask_Llamma_API, con la base configurada en DATABASE_URL):
    .venv\\Scripts\\python.exe migrations\\entrega_confirmada_pedidos.py

Es idempotente. `fecha_entrega` ya existía; estas columnas permiten distinguir
la fecha comprometida por el equipo de la fecha deseada por el cliente y
conservar quién/cuándo la confirmó, además de una nota pública de logística.
"""

from __future__ import annotations

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from sqlalchemy import inspect, text  # noqa: E402

from app import app  # noqa: E402
from extensions import db  # noqa: E402

TABLA = "pedidos"
COLUMNAS = {
    "nota_entrega": "VARCHAR(240) NULL",
    "entrega_confirmada_en": "DATETIME NULL",
    "entrega_confirmada_por": "INTEGER NULL",
}
FK = "fk_pedidos_entrega_confirmada_por"


def main() -> None:
    with app.app_context():
        inspector = inspect(db.engine)
        if TABLA not in inspector.get_table_names():
            print(f"{TABLA}: la tabla no existe; crea el esquema con `flask --app app init-db`")
            return

        existentes = {columna["name"] for columna in inspector.get_columns(TABLA)}
        for columna, tipo in COLUMNAS.items():
            if columna in existentes:
                print(f"{TABLA}: columna {columna} ya existe")
                continue
            db.session.execute(text(f"ALTER TABLE {TABLA} ADD COLUMN {columna} {tipo}"))
            db.session.commit()
            print(f"{TABLA}: columna {columna} agregada")

        if db.engine.dialect.name == "mysql":
            foraneas = {
                foranea.get("name") for foranea in inspect(db.engine).get_foreign_keys(TABLA)
            }
            if FK not in foraneas:
                db.session.execute(
                    text(
                        f"ALTER TABLE {TABLA} ADD CONSTRAINT {FK} "
                        "FOREIGN KEY (entrega_confirmada_por) REFERENCES usuarios(id)"
                    )
                )
                db.session.commit()
                print(f"{TABLA}: llave foránea {FK} agregada")
            else:
                print(f"{TABLA}: llave foránea {FK} ya existe")

        # Los pedidos históricos ya tienen una fecha comprometida: se toma el
        # último cambio y el usuario que creó el pedido como confirmación base.
        db.session.execute(
            text(
                f"UPDATE {TABLA} "
                "SET entrega_confirmada_en = actualizado_en, "
                "    entrega_confirmada_por = creado_por "
                "WHERE entrega_confirmada_en IS NULL AND fecha_entrega IS NOT NULL"
            )
        )
        db.session.commit()
        print(f"{TABLA}: confirmaciones históricas completadas")


if __name__ == "__main__":
    main()

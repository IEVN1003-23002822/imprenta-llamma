"""Alinea la línea de catálogo de Tote bag y Sticker con las tarjetas del inicio.

Uso (desde Flask_Llamma_API, con DATABASE_URL configurada):
    .venv\\Scripts\\python.exe migrations\\reclasificar_lineas_catalogo.py

- Tote bag de manta pasa a la línea Textil.
- Sticker troquelado pasa a la línea Papelería.

Es idempotente y solo modifica el catálogo; las partidas históricas conservan su
descripción y los pedidos su historial.
"""

from __future__ import annotations

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app import app  # noqa: E402
from extensions import db  # noqa: E402
from models import Producto  # noqa: E402

CAMBIOS = (
    ("Tote bag de manta", "textil", "textil"),
    ("Sticker troquelado", "papeleria", "papeleria"),
)


def main() -> None:
    with app.app_context():
        cambios = 0
        for nombre, linea, categoria in CAMBIOS:
            producto = Producto.query.filter_by(nombre=nombre).first()
            if not producto:
                print(f"{nombre}: no encontrado; se omite")
                continue
            if producto.linea_produccion == linea and producto.categoria == categoria:
                print(f"{nombre}: ya está en {linea}; sin cambios")
                continue
            producto.linea_produccion = linea
            producto.categoria = categoria
            cambios += 1
            print(f"{nombre}: línea y categoría -> {linea}")
        db.session.commit()
        print(f"Productos actualizados: {cambios}")


if __name__ == "__main__":
    main()

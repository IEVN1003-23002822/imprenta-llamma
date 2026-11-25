"""Actualiza medidas y valida las recetas de los productos de producción.

Uso (desde Flask_Llamma_API, con la base configurada en DATABASE_URL):
    .venv\\Scripts\\python.exe migrations\\recetas_medidas.py

Idempotente. Ajusta el sticker a 5 × 5 cm (0.0025 m² de vinil) y reporta las
recetas que no tengan componentes para revisarlas manualmente.
"""

from __future__ import annotations

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app import app  # noqa: E402
from extensions import db  # noqa: E402
from models import Producto  # noqa: E402

PRODUCTOS_RECETA = (
    "Playera DTF 29 × 29 cm",
    "Playera DTF menor a 29 × 29 cm",
    "Taza cerámica sublimada",
    "Tote bag de manta",
    "Lona Frontlit impresa",
    "Sticker troquelado",
)


def main() -> None:
    with app.app_context():
        sticker = Producto.query.filter_by(nombre="Sticker troquelado").first()
        if sticker:
            sticker.descripcion = "Vinil adhesivo brillante con corte de precisión, 5 × 5 cm."
            if sticker.receta:
                componente = next(
                    (
                        item
                        for item in sticker.receta.componentes
                        if item.materia_prima
                        and item.materia_prima.nombre == "Vinil adhesivo brillante"
                    ),
                    None,
                )
                if componente:
                    componente.cantidad = 0.0025
            print("Sticker troquelado actualizado a 5 × 5 cm (0.0025 m²)")
        else:
            print("Sticker troquelado no existe en esta base")

        for nombre in PRODUCTOS_RECETA:
            producto = Producto.query.filter_by(nombre=nombre).first()
            if not producto:
                print(f"AVISO: no existe el producto {nombre}")
            elif not producto.receta or not producto.receta.componentes:
                print(f"AVISO: {nombre} no tiene componentes de receta")
            else:
                print(f"OK: {nombre} con {len(producto.receta.componentes)} componentes")

        db.session.commit()


if __name__ == "__main__":
    main()

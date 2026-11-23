"""Asigna las vistas previas WebP a los productos del catálogo (idempotente)."""

from __future__ import annotations

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app import app  # noqa: E402
from extensions import db  # noqa: E402
from models import Producto  # noqa: E402

IMAGENES = {
    "Lona Frontlit impresa": "assets/images/catalogo/gran-formato/lona-frontlit-impresa.webp",
    "Roll-up premium 85 × 200 cm": "assets/images/catalogo/gran-formato/roll-up-premium.webp",
    "Playera DTF 29 × 29 cm": "assets/images/catalogo/textil/playera-dtf-29x29.webp",
    "Playera DTF menor a 29 × 29 cm": "assets/images/catalogo/textil/playera-dtf-menor-29x29.webp",
    "Tote bag de manta": "assets/images/catalogo/textil/tote-bag-manta.webp",
    "Taza cerámica sublimada": "assets/images/catalogo/promocionales/taza-ceramica-sublimada.webp",
    "Sticker troquelado": "assets/images/catalogo/promocionales/sticker-troquelado.webp",
    "Tarjetas Couché 300g": "assets/images/catalogo/papeleria/tarjetas-couche-300g.webp",
}


def main() -> None:
    with app.app_context():
        actualizados = 0
        for nombre, ruta in IMAGENES.items():
            producto = Producto.query.filter_by(nombre=nombre).first()
            if producto and producto.imagen_url != ruta:
                producto.imagen_url = ruta
                actualizados += 1
        db.session.commit()
        print(f"{actualizados} productos actualizados con vista previa WebP.")


if __name__ == "__main__":
    main()

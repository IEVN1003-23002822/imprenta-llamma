"""Renombra el producto «Lona Frontlit impresa» a «Lona/Vinil».

Uso (desde Flask_Llamma_API, con la base configurada en DATABASE_URL):
    .venv\\Scripts\\python.exe migrations\\renombrar_lona_vinil.py

Es idempotente. Actualiza el catálogo y las referencias históricas exactas
(solicitudes, cotizaciones, pedidos y recetas) sin borrar ningún dato. Si ya
existe un producto con el nombre nuevo, no fusiona registros: solo informa.
"""

from __future__ import annotations

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app import app  # noqa: E402
from extensions import db  # noqa: E402
from models import (  # noqa: E402
    CotizacionItem,
    PedidoItem,
    Producto,
    Receta,
    SolicitudItem,
)

ANTERIOR = "Lona Frontlit impresa"
NUEVO = "Lona/Vinil"


def main() -> None:
    with app.app_context():
        anterior = Producto.query.filter_by(nombre=ANTERIOR).first()
        nuevo = Producto.query.filter_by(nombre=NUEVO).first()

        if nuevo:
            print(f"Producto: «{NUEVO}» ya existe; no se renombra ni se fusiona.")
            return
        if not anterior:
            print(f"Producto: «{ANTERIOR}» no encontrado; nada que hacer.")
            return

        anterior.nombre = NUEVO
        SolicitudItem.query.filter_by(nombre_producto=ANTERIOR).update(
            {SolicitudItem.nombre_producto: NUEVO}, synchronize_session=False
        )
        CotizacionItem.query.filter_by(descripcion=ANTERIOR).update(
            {CotizacionItem.descripcion: NUEVO}, synchronize_session=False
        )
        PedidoItem.query.filter_by(descripcion=ANTERIOR).update(
            {PedidoItem.descripcion: NUEVO}, synchronize_session=False
        )
        Receta.query.filter_by(nombre=f"Receta {ANTERIOR}").update(
            {Receta.nombre: f"Receta {NUEVO}"}, synchronize_session=False
        )
        db.session.commit()
        print(f"Producto renombrado: «{ANTERIOR}» -> «{NUEVO}».")


if __name__ == "__main__":
    main()

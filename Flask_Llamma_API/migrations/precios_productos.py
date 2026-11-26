"""Actualiza precios y variantes oficiales de productos (idempotente).

Uso desde Flask_Llamma_API:
    .venv\\Scripts\\python.exe migrations\\precios_productos.py
"""

from __future__ import annotations

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app import app  # noqa: E402
from extensions import db  # noqa: E402
from models import Producto, Receta, RecetaComponente  # noqa: E402

PLAYERA = "Playera DTF 29 × 29 cm"
PLAYERA_MENOR = "Playera DTF menor a 29 × 29 cm"
LONA = "Lona/Vinil"
TAZA = "Taza cerámica sublimada"


def main() -> None:
    with app.app_context():
        lona = Producto.query.filter_by(nombre=LONA).first()
        if lona:
            lona.precio_base = 220
            lona.descripcion = (
                "Impresión gran formato CMYK. Precio base 1 m × 1 m = $220; "
                "cada m² adicional $120."
            )

        playera = Producto.query.filter(
            Producto.nombre.in_([PLAYERA, "Playera DTF unisex"])
        ).first()
        if playera:
            playera.nombre = PLAYERA
            playera.precio_base = 220
            playera.descripcion = (
                "Camiseta de algodón con estampado DTF a todo color. "
                "Impresión de 29 × 29 cm."
            )

        menor = Producto.query.filter_by(nombre=PLAYERA_MENOR).first()
        if not menor:
            menor = Producto(
                nombre=PLAYERA_MENOR,
                descripcion=(
                    "Camiseta de algodón con estampado DTF a todo color. "
                    "Impresión menor a 29 × 29 cm."
                ),
                categoria="textil",
                linea_produccion="textil",
                precio_base=200,
                unidad_venta="pieza",
                icono="bi-person-standing-dress",
                publicado=True,
                activo=True,
            )
            db.session.add(menor)
            db.session.flush()
        else:
            menor.precio_base = 200
            menor.descripcion = (
                "Camiseta de algodón con estampado DTF a todo color. "
                "Impresión menor a 29 × 29 cm."
            )
            menor.activo = True

        if playera and not menor.receta and playera.receta:
            origen = playera.receta
            receta = Receta(
                producto=menor,
                nombre=f"Receta {PLAYERA_MENOR}",
                rendimiento=origen.rendimiento,
                unidad_rendimiento=origen.unidad_rendimiento,
                costo_estimado=90,
                tiempo_produccion_min=origen.tiempo_produccion_min,
            )
            db.session.add(receta)
            for componente in origen.componentes:
                receta.componentes.append(
                    RecetaComponente(
                        materia_prima_id=componente.materia_prima_id,
                        cantidad=componente.cantidad,
                        unidad_medida=componente.unidad_medida,
                        desperdicio_porcentaje=componente.desperdicio_porcentaje,
                    )
                )

        taza = Producto.query.filter_by(nombre=TAZA).first()
        if taza:
            taza.precio_base = 85
            taza.descripcion = (
                "Taza de 11 oz con sublimación full color y caja individual. "
                "Precio unitario."
            )

        db.session.commit()
        print("Precios de lona, playera y taza actualizados.")


if __name__ == "__main__":
    main()

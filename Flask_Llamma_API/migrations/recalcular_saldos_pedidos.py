"""Recalcula el saldo de los pedidos a partir de pagos confirmados.

Uso (desde Flask_Llamma_API, con DATABASE_URL apuntando a la base real):
    .venv\\Scripts\\python.exe migrations\\recalcular_saldos_pedidos.py

Regla: `saldo = total - suma(pagos confirmados)`. El campo `anticipo` es una
referencia del 50% y no se descuenta hasta que exista un pago registrado.
Es idempotente y no modifica estados ni pagos.
"""

from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from sqlalchemy.orm import selectinload  # noqa: E402

from app import app  # noqa: E402
from extensions import db  # noqa: E402
from models import Pedido  # noqa: E402


def _dinero(valor) -> Decimal:
    return Decimal(str(valor or 0)).quantize(Decimal("0.01"))


def main() -> None:
    with app.app_context():
        pedidos = Pedido.query.options(selectinload(Pedido.pagos)).all()
        cambios: list[tuple[int, float, float]] = []

        for pedido in pedidos:
            total = _dinero(pedido.total)
            pagado = sum(
                (_dinero(pago.monto) for pago in pedido.pagos if pago.confirmado),
                Decimal("0.00"),
            )
            saldo = max(total - pagado, Decimal("0.00"))
            anterior = _dinero(pedido.saldo)
            if anterior != saldo:
                pedido.saldo = float(saldo)
                cambios.append((pedido.id, float(anterior), float(saldo)))

        db.session.commit()
        print(f"Pedidos revisados: {len(pedidos)}; saldos corregidos: {len(cambios)}")
        for pedido_id, anterior, nuevo in cambios:
            print(f"  Pedido {pedido_id}: {anterior:.2f} -> {nuevo:.2f}")


if __name__ == "__main__":
    main()

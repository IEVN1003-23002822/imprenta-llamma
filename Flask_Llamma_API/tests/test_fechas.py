"""Pruebas de la regla de días hábiles para fechas de entrega."""

from __future__ import annotations

import unittest
from datetime import date

from utils import calcular_fecha_minima_entrega

FESTIVOS = (
    "2026-01-01",
    "2026-02-02",
    "2026-03-16",
    "2026-05-01",
    "2026-09-16",
    "2026-11-16",
    "2026-12-24",
    "2026-12-25",
)


class FechasEntregaTest(unittest.TestCase):
    def test_lunes_suma_dos_dias_habiles(self) -> None:
        self.assertEqual(
            calcular_fecha_minima_entrega(date(2026, 11, 23), 2, FESTIVOS),
            date(2026, 11, 25),
        )

    def test_viernes_salta_el_fin_de_semana(self) -> None:
        self.assertEqual(
            calcular_fecha_minima_entrega(date(2026, 11, 27), 2, FESTIVOS),
            date(2026, 12, 1),
        )

    def test_navidad_salta_festivos_y_fin_de_semana(self) -> None:
        # 24 y 25 son festivos; 26 y 27 fin de semana; 28 y 29 hábiles.
        self.assertEqual(
            calcular_fecha_minima_entrega(date(2026, 12, 23), 2, FESTIVOS),
            date(2026, 12, 29),
        )

    def test_festivo_antes_de_contar(self) -> None:
        # Si la fecha base es el 1 de mayo, el conteo inicia el lunes 4.
        self.assertEqual(
            calcular_fecha_minima_entrega(date(2026, 5, 1), 1, FESTIVOS),
            date(2026, 5, 4),
        )

    def test_cero_dias_devuelve_la_fecha_base(self) -> None:
        self.assertEqual(
            calcular_fecha_minima_entrega(date(2026, 11, 23), 0, FESTIVOS),
            date(2026, 11, 23),
        )


if __name__ == "__main__":
    unittest.main()

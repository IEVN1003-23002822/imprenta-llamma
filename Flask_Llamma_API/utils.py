"""Utilidades compartidas: folios, archivos y respuestas."""

from __future__ import annotations

import os
import re
import uuid
from datetime import date, timedelta

from flask import current_app
from sqlalchemy import func

from extensions import db
from models import utcnow

_CARACTERES_SEGUROS = re.compile(r"[^A-Za-z0-9._-]+")


def generar_folio(
    prefijo: str,
    modelo,
    campo: str = "folio",
    *,
    con_anio: bool = True,
    relleno: int = 3,
    inicio: int = 1,
) -> str:
    """Genera un folio consecutivo, por ejemplo SOL-2026-004 o LLM-1048."""
    if con_anio:
        base = f"{prefijo}-{utcnow().year}-"
    else:
        base = f"{prefijo}-"

    columna = getattr(modelo, campo)
    ultimo = (
        db.session.query(func.max(columna)).filter(columna.like(f"{base}%")).scalar()
    )
    siguiente = inicio
    if ultimo:
        try:
            siguiente = int(str(ultimo).split("-")[-1]) + 1
        except (TypeError, ValueError):
            siguiente = inicio
    return f"{base}{siguiente:0{relleno}d}"


MENSAJE_FECHA_MINIMA = (
    "La fecha de entrega solicitada no es válida. "
    "El margen mínimo es de 2 días hábiles."
)


def calcular_fecha_minima_entrega(
    fecha_inicio: date,
    dias_habiles: int = 2,
    festivos: tuple[str, ...] | list[str] | None = None,
) -> date:
    """Suma días hábiles saltando sábados, domingos y días festivos.

    `festivos` se recibe como fechas ISO (`YYYY-MM-DD`); si se omite, usa
    `DIAS_FESTIVOS` de la configuración de Flask. La fecha de inicio no cuenta.
    """
    if dias_habiles <= 0:
        return fecha_inicio

    if festivos is None:
        festivos = current_app.config.get("DIAS_FESTIVOS", ())

    cierres: set[date] = set()
    for valor in festivos:
        try:
            cierres.add(date.fromisoformat(str(valor)[:10]))
        except ValueError:
            continue

    actual = fecha_inicio
    contados = 0
    while contados < dias_habiles:
        actual += timedelta(days=1)
        if actual.weekday() >= 5 or actual in cierres:
            continue
        contados += 1
    return actual


def parse_fecha(valor: str | None) -> date | None:
    """Convierte YYYY-MM-DD en date, devolviendo None si no es válido."""
    if not valor:
        return None
    try:
        return date.fromisoformat(str(valor)[:10])
    except ValueError:
        return None


def parse_decimal(valor, default: float = 0.0) -> float:
    try:
        return float(valor)
    except (TypeError, ValueError):
        return default


def parse_int(valor, default: int | None = None) -> int | None:
    try:
        return int(valor)
    except (TypeError, ValueError):
        return default


def extension_permitida(nombre: str) -> bool:
    if "." not in nombre:
        return False
    extension = nombre.rsplit(".", 1)[1].lower()
    return extension in current_app.config["ALLOWED_EXTENSIONS"]


def nombre_archivo_seguro(nombre: str) -> str:
    limpio = _CARACTERES_SEGUROS.sub("_", nombre).strip("._") or "archivo"
    return f"{uuid.uuid4().hex[:12]}-{limpio[:120]}"


def guardar_archivo(storage) -> tuple[str, str, int] | None:
    """Guarda un archivo subido y devuelve (nombre original, nombre guardado, tamaño)."""
    if not storage or not storage.filename:
        return None
    if not extension_permitida(storage.filename):
        return None

    carpeta = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(carpeta, exist_ok=True)

    nombre_guardado = nombre_archivo_seguro(storage.filename)
    destino = os.path.join(carpeta, nombre_guardado)
    storage.save(destino)
    tamano = os.path.getsize(destino)
    return storage.filename, nombre_guardado, tamano


def paginar(query, page: int, per_page: int, serializador) -> dict:
    page = max(page, 1)
    per_page = min(max(per_page, 1), 100)
    paginado = query.paginate(page=page, per_page=per_page, error_out=False)
    return {
        "items": [serializador(item) for item in paginado.items],
        "total": paginado.total,
        "pagina": paginado.page,
        "porPagina": paginado.per_page,
        "paginas": paginado.pages,
    }

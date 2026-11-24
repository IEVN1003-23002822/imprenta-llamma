"""Utilidades y mezclas compartidas por los modelos."""

from __future__ import annotations

from datetime import datetime, timezone

from extensions import db


def utcnow() -> datetime:
    """Fecha UTC naive, compatible con columnas DATETIME de MySQL."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(value: datetime | None) -> str | None:
    return value.isoformat(timespec="seconds") if value else None


class TimestampMixin:
    creado_en = db.Column(db.DateTime, default=utcnow, nullable=False)
    actualizado_en = db.Column(db.DateTime, default=utcnow, onupdate=utcnow, nullable=False)

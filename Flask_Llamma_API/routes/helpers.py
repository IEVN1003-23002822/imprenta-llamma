"""Helpers de entrada/salida para las rutas de la API."""

from __future__ import annotations

import json
import re

from flask import jsonify, request

_CORREO_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def payload() -> dict:
    """Devuelve JSON o form-data como diccionario."""
    if request.is_json:
        return request.get_json(silent=True) or {}
    if request.form:
        return request.form.to_dict()
    return request.get_json(silent=True) or {}


def campo(data: dict, *nombres, default=None):
    """Lee la primera clave disponible (soporta camelCase y snake_case)."""
    for nombre in nombres:
        if nombre in data and data[nombre] not in (None, ""):
            return data[nombre]
    return default


def lista_items(data: dict) -> list:
    bruto = campo(data, "items", "itemsSolicitados")
    if bruto is None:
        return []
    if isinstance(bruto, str):
        try:
            bruto = json.loads(bruto)
        except json.JSONDecodeError:
            return []
    return bruto if isinstance(bruto, list) else []


def correo_valido(valor: str | None) -> bool:
    return bool(valor and _CORREO_RE.match(str(valor).strip()))


def error(mensaje: str, status: int = 400, codigo: str = "solicitud_invalida"):
    return jsonify({"error": mensaje, "codigo": codigo}), status


def no_encontrado(recurso: str = "Recurso"):
    return error(f"{recurso} no encontrado", 404, "no_encontrado")

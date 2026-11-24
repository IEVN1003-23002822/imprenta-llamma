"""Límite de peticiones en memoria, sin dependencias externas.

Sirve para una sola instancia o para desarrollo. Con varios workers/procesos
cada uno lleva su propia cuenta, así que en producción conviene sustituirlo
por Flask-Limiter con un backend compartido (Redis) manteniendo esta interfaz.
"""

from __future__ import annotations

import threading
import time
from collections import deque

from flask import current_app, jsonify, request

_LOCK = threading.Lock()
_REGISTRO: dict[str, deque[float]] = {}
_MAX_CLAVES = 20_000


def cliente_ip() -> str:
    """IP del cliente; solo confía en X-Forwarded-For si está configurado."""
    if current_app.config.get("TRUST_PROXY_HEADERS"):
        reenviada = request.headers.get("X-Forwarded-For", "")
        if reenviada:
            return reenviada.split(",")[0].strip()[:64]
    return (request.remote_addr or "desconocida")[:64]


def _consumir(clave: str, maximo: int, ventana: int) -> int | None:
    """Registra una petición y devuelve los segundos de espera si sobra."""
    if maximo <= 0 or ventana <= 0:
        return None

    ahora = time.monotonic()
    with _LOCK:
        if len(_REGISTRO) > _MAX_CLAVES:
            _REGISTRO.clear()

        cola = _REGISTRO.setdefault(clave, deque())
        while cola and ahora - cola[0] >= ventana:
            cola.popleft()

        if len(cola) >= maximo:
            return max(1, int(ventana - (ahora - cola[0])) + 1)

        cola.append(ahora)
        return None


def excedido(*reglas: tuple[str, str, int, int]) -> int | None:
    """Evalúa varias reglas `(nombre, identificador, máximo, ventana)`.

    Devuelve el mayor `Retry-After` si alguna se rebasa, o `None` si todas
    están dentro del límite.
    """
    espera_maxima: int | None = None
    for nombre, identificador, maximo, ventana in reglas:
        clave = f"{nombre}:{identificador or '-'}"
        espera = _consumir(clave, maximo, ventana)
        if espera is not None and (espera_maxima is None or espera > espera_maxima):
            espera_maxima = espera
    return espera_maxima


def reiniciar(nombre: str, identificador: str) -> None:
    """Limpia el contador de una clave (por ejemplo, tras un login correcto)."""
    with _LOCK:
        _REGISTRO.pop(f"{nombre}:{identificador or '-'}", None)


def demasiadas_peticiones(espera: int, mensaje: str | None = None):
    """Respuesta 429 uniforme con cabecera Retry-After."""
    respuesta = jsonify(
        {
            "error": mensaje or "Demasiadas solicitudes. Espera un momento e intenta de nuevo.",
            "codigo": "demasiadas_solicitudes",
        }
    )
    respuesta.headers["Retry-After"] = str(espera)
    return respuesta, 429

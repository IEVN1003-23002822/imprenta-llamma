"""Configuración de la API de Llamma."""

from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# "production" exige SECRET_KEY y desactiva el modo depuración. Cualquier otro
# valor se considera desarrollo local.
ENTORNO = os.getenv("LLAMMA_ENV", "development").strip().lower()
ES_PRODUCCION = ENTORNO == "production"


def _entero(nombre: str, default: int) -> int:
    """Lee un entero del entorno sin romper el arranque si viene mal escrito."""
    try:
        return int(os.getenv(nombre, str(default)))
    except (TypeError, ValueError):
        return default


def _lista(nombre: str, default: str) -> list[str]:
    return [valor.strip() for valor in os.getenv(nombre, default).split(",") if valor.strip()]


class Config:
    """Configuración base, sobreescribible por variables de entorno."""

    ENTORNO = ENTORNO
    ES_PRODUCCION = ES_PRODUCCION

    # En producción la clave es obligatoria (create_app falla si falta). En
    # desarrollo se usa una clave fija para no frenar el trabajo local.
    SECRET_KEY = os.getenv("SECRET_KEY", "") or (
        "" if ES_PRODUCCION else "llamma-dev-secret-solo-local"
    )

    DEBUG = not ES_PRODUCCION and os.getenv("FLASK_DEBUG", "0") == "1"

    # MySQL/MariaDB de Laragon con el usuario root sin contraseña.
    # Se puede sobreescribir con la variable de entorno DATABASE_URL, por
    # ejemplo para pruebas con SQLite: DATABASE_URL=sqlite:///llamma_dev.db
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://root:@127.0.0.1:3306/llamma_db?charset=utf8mb4",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 280}

    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "uploads"))
    MAX_CONTENT_LENGTH = 25 * 1024 * 1024  # 25 MB
    ALLOWED_EXTENSIONS = {"pdf", "ai", "psd", "png", "jpg", "jpeg", "svg", "zip"}

    TOKEN_TTL_HOURS = _entero("TOKEN_TTL_HOURS", 12)

    # Orígenes permitidos para el frontend. En producción hay que declararlos
    # explícitamente con CORS_ORIGINS (separados por coma).
    CORS_ORIGINS = _lista(
        "CORS_ORIGINS",
        "http://localhost:4200,http://127.0.0.1:4200",
    )

    # Solo activar si la API está detrás de un proxy de confianza: la cabecera
    # X-Forwarded-For se puede falsificar si se acepta de cualquier cliente.
    TRUST_PROXY_HEADERS = os.getenv("TRUST_PROXY_HEADERS", "0") == "1"

    # Límites de peticiones (en memoria, por proceso).
    LOGIN_MAX_INTENTOS = _entero("LOGIN_MAX_INTENTOS", 10)
    LOGIN_VENTANA_SEGUNDOS = _entero("LOGIN_VENTANA_SEGUNDOS", 60)
    LOGIN_MAX_POR_CUENTA = _entero("LOGIN_MAX_POR_CUENTA", 5)
    LOGIN_VENTANA_CUENTA_SEGUNDOS = _entero("LOGIN_VENTANA_CUENTA_SEGUNDOS", 300)

    PUBLICO_MAX_SOLICITUDES = _entero("PUBLICO_MAX_SOLICITUDES", 5)
    PUBLICO_VENTANA_SEGUNDOS = _entero("PUBLICO_VENTANA_SEGUNDOS", 3600)
    PUBLICO_MAX_CONSULTAS = _entero("PUBLICO_MAX_CONSULTAS", 60)
    PUBLICO_VENTANA_CONSULTAS_SEGUNDOS = _entero("PUBLICO_VENTANA_CONSULTAS_SEGUNDOS", 60)
    CHAT_MAX_MENSAJES = _entero("CHAT_MAX_MENSAJES", 20)
    CHAT_VENTANA_SEGUNDOS = _entero("CHAT_VENTANA_SEGUNDOS", 600)

    IVA_RATE = 0.16
    ANTICIPO_RATE = 0.50

    JSON_SORT_KEYS = False

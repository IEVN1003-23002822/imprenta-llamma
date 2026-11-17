"""Configuración de la API de Llamma."""

from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


class Config:
    """Configuración base, sobreescribible por variables de entorno."""

    SECRET_KEY = os.getenv("SECRET_KEY", "llamma-dev-secret-cambiar-en-produccion")

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

    TOKEN_TTL_HOURS = int(os.getenv("TOKEN_TTL_HOURS", "12"))

    IVA_RATE = 0.16
    ANTICIPO_RATE = 0.50

    JSON_SORT_KEYS = False

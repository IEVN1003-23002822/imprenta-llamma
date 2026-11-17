"""API REST de Llamma.

Fábrica de la aplicación Flask, configuración, manejo de errores y comandos
de inicialización de la base de datos.
"""

from __future__ import annotations

import os

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from config import Config
from extensions import db
from routes import register_blueprints


def create_app(config_object: type[Config] = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_object)

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    db.init_app(app)

    CORS(
        app,
        resources={r"/api/*": {"origins": "*"}},
        allow_headers=["Content-Type", "Authorization", "X-Auth-Token"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    register_blueprints(app)
    _registrar_errores(app)
    _registrar_comandos(app)

    @app.get("/")
    def index():
        return jsonify(
            {
                "servicio": "Llamma API",
                "estado": "ok",
                "docs": {
                    "publico": "/api/public/productos",
                    "salud": "/api/health",
                    "login": "/api/auth/login",
                },
            }
        )

    return app


def _registrar_errores(app: Flask) -> None:
    @app.errorhandler(HTTPException)
    def manejar_http(error: HTTPException):
        if request.path.startswith("/api"):
            return (
                jsonify(
                    {
                        "error": error.description,
                        "codigo": error.name.lower().replace(" ", "_"),
                    }
                ),
                error.code,
            )
        return error

    @app.errorhandler(413)
    def archivo_demasiado_grande(_):
        limite = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
        return (
            jsonify(
                {
                    "error": f"El archivo supera el límite de {limite} MB",
                    "codigo": "archivo_demasiado_grande",
                }
            ),
            413,
        )

    @app.errorhandler(Exception)
    def manejar_error(error: Exception):
        db.session.rollback()
        app.logger.exception("Error no controlado: %s", error)
        if request.path.startswith("/api"):
            return (
                jsonify(
                    {
                        "error": "Ocurrió un error interno. Intenta de nuevo.",
                        "codigo": "error_interno",
                    }
                ),
                500,
            )
        raise error


def _registrar_comandos(app: Flask) -> None:
    @app.cli.command("init-db")
    def init_db():
        """Crea las 27 tablas del esquema."""
        from models import TABLAS

        db.create_all()
        print(f"Base de datos inicializada con {len(TABLAS)} tablas:")
        print(", ".join(modelo.__tablename__ for modelo in TABLAS))

    @app.cli.command("seed-db")
    def seed_db():
        """Carga datos de demostración."""
        from seed import seed_database

        seed_database()


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)

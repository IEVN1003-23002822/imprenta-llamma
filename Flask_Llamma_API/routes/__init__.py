"""Registro de blueprints de la API."""

from routes.auth_routes import auth_bp
from routes.public_routes import public_bp
from routes.admin_routes import admin_bp


def register_blueprints(app) -> None:
    app.register_blueprint(public_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(admin_bp, url_prefix="/api")

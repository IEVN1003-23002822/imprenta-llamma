"""Registro de blueprints de la API."""

from routes.admin_routes import ADMIN_BLUEPRINTS
from routes.auth_routes import auth_bp
from routes.public_routes import public_bp


def register_blueprints(app) -> None:
    app.register_blueprint(public_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    for blueprint in ADMIN_BLUEPRINTS:
        app.register_blueprint(blueprint, url_prefix="/api")

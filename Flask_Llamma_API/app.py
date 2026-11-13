"""API REST de Llamma (esqueleto).

Punto de entrada de la aplicación Flask. La configuración de la base de datos,
los modelos SQLAlchemy y los endpoints REST se implementarán en fases
posteriores.
"""

from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def create_app() -> Flask:
    """Crea la instancia base de la aplicación Flask."""
    app = Flask(__name__)
    CORS(app)
    db.init_app(app)
    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)

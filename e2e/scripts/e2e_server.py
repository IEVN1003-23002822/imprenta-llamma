"""Servidor Flask aislado para la suite E2E.

Usa SQLite en `e2e/.tmp/`, nunca `llamma_db`. Borra la base al arrancar salvo
que `E2E_REUSE_DB=1`, y la siembra con `seed.py` si está vacía.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
API = RAIZ / "Flask_Llamma_API"
TMP = RAIZ / "e2e" / ".tmp"
TMP.mkdir(parents=True, exist_ok=True)
BASE = TMP / "e2e.db"

if os.environ.get("E2E_REUSE_DB") != "1" and BASE.exists():
    BASE.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{BASE.as_posix()}"
os.environ["UPLOAD_FOLDER"] = str(TMP / "uploads")
os.environ["LLAMMA_ENV"] = "development"
os.environ["FLASK_DEBUG"] = "0"
# Límites holgados para la suite; el rate limit de login se prueba por cuenta.
os.environ["LOGIN_MAX_INTENTOS"] = "100"
os.environ["PUBLICO_MAX_SOLICITUDES"] = "100"
os.environ["PUBLICO_MAX_CONSULTAS"] = "1000"
os.environ["CHAT_MAX_MENSAJES"] = "200"

sys.path.insert(0, str(API))
os.chdir(API)

from app import create_app  # noqa: E402
from extensions import db  # noqa: E402

app = create_app()

with app.app_context():
    db.create_all()
    from models import Usuario  # noqa: E402

    if not Usuario.query.first():
        from seed import seed_database  # noqa: E402

        seed_database()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=False, use_reloader=False)

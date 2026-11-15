"""Autenticación por token de sesión y control de roles/permisos."""

from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta
from functools import wraps

from flask import current_app, g, jsonify, request

from extensions import db
from models import SesionUsuario, Usuario, utcnow


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def crear_sesion(usuario: Usuario, req=None) -> str:
    """Crea una sesión persistida y devuelve el token en claro (solo una vez)."""
    req = req or request
    token = secrets.token_urlsafe(40)
    ahora = utcnow()
    sesion = SesionUsuario(
        usuario_id=usuario.id,
        token_hash=hash_token(token),
        ip=_ip_cliente(req),
        user_agent=(req.headers.get("User-Agent") or "")[:255],
        creado_en=ahora,
        ultimo_uso=ahora,
        expira_en=ahora + timedelta(hours=current_app.config["TOKEN_TTL_HOURS"]),
    )
    usuario.ultimo_acceso = ahora
    db.session.add(sesion)
    db.session.commit()
    return token


def _ip_cliente(req) -> str:
    forwarded = req.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return (req.remote_addr or "")[:64]


def revocar_sesion(sesion: SesionUsuario) -> None:
    sesion.revocado = True
    db.session.commit()


def _leer_token() -> str | None:
    encabezado = request.headers.get("Authorization", "")
    if encabezado.lower().startswith("bearer "):
        return encabezado[7:].strip()
    return request.headers.get("X-Auth-Token") or request.args.get("token")


def sesion_actual() -> SesionUsuario | None:
    token = _leer_token()
    if not token:
        return None

    sesion = SesionUsuario.query.filter_by(token_hash=hash_token(token), revocado=False).first()
    if not sesion:
        return None
    if sesion.expira_en <= utcnow() or not sesion.usuario or not sesion.usuario.activo:
        return None

    # Refresca la marca de uso sin escribir en cada petición.
    if (utcnow() - sesion.ultimo_uso).total_seconds() > 300:
        sesion.ultimo_uso = utcnow()
        db.session.commit()
    return sesion


def token_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        sesion = sesion_actual()
        if not sesion:
            return jsonify({"error": "Sesión no válida o expirada", "codigo": "no_autorizado"}), 401
        g.sesion = sesion
        g.usuario = sesion.usuario
        return func(*args, **kwargs)

    return wrapper


def role_required(*roles: str):
    """Restringe el endpoint a uno o varios roles, además de exigir token."""

    def decorador(func):
        @wraps(func)
        @token_required
        def wrapper(*args, **kwargs):
            if g.usuario.rol is None or g.usuario.rol.nombre not in roles:
                return (
                    jsonify(
                        {
                            "error": "Tu rol no tiene acceso a esta operación",
                            "codigo": "prohibido",
                            "rolesPermitidos": list(roles),
                        }
                    ),
                    403,
                )
            return func(*args, **kwargs)

        return wrapper

    return decorador


def permiso_required(clave: str):
    def decorador(func):
        @wraps(func)
        @token_required
        def wrapper(*args, **kwargs):
            if clave not in g.usuario.permisos:
                return (
                    jsonify(
                        {
                            "error": f"Falta el permiso '{clave}'",
                            "codigo": "prohibido",
                        }
                    ),
                    403,
                )
            return func(*args, **kwargs)

        return wrapper

    return decorador

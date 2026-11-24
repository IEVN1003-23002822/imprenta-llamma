"""Autenticación de empleados y sesiones."""

from __future__ import annotations

from flask import Blueprint, current_app, g, jsonify, request

from auth import crear_sesion, revocar_sesion, role_required, token_required
from extensions import db
from models import SesionUsuario, Usuario, utcnow
from ratelimit import cliente_ip, demasiadas_peticiones, excedido, reiniciar
from routes.helpers import campo, error, payload

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/login")
def login():
    data = payload()
    correo = str(campo(data, "correo", "email", default="")).strip().lower()
    password = str(campo(data, "password", "contrasena", "contraseña", default=""))

    if not correo or not password:
        return error("Correo y contraseña son obligatorios")

    # Frena la fuerza bruta por IP y por cuenta sin bloquear a todo un taller
    # que comparte salida a internet.
    espera = excedido(
        (
            "login-ip",
            cliente_ip(),
            current_app.config["LOGIN_MAX_INTENTOS"],
            current_app.config["LOGIN_VENTANA_SEGUNDOS"],
        ),
        (
            "login-cuenta",
            correo,
            current_app.config["LOGIN_MAX_POR_CUENTA"],
            current_app.config["LOGIN_VENTANA_CUENTA_SEGUNDOS"],
        ),
    )
    if espera is not None:
        current_app.logger.warning("Login limitado para %s desde %s", correo, cliente_ip())
        return demasiadas_peticiones(
            espera, "Demasiados intentos de acceso. Espera antes de volver a intentarlo."
        )

    usuario = Usuario.query.filter(db.func.lower(Usuario.correo) == correo).first()
    if not usuario or not usuario.check_password(password):
        current_app.logger.warning("Login fallido para %s desde %s", correo, cliente_ip())
        return error("Credenciales incorrectas", 401, "credenciales_invalidas")
    if not usuario.activo:
        current_app.logger.warning("Login de cuenta inactiva: %s", correo)
        return error("La cuenta está desactivada", 403, "cuenta_inactiva")

    reiniciar("login-cuenta", correo)
    reiniciar("login-ip", cliente_ip())
    token = crear_sesion(usuario)
    sesion = SesionUsuario.query.filter_by(usuario_id=usuario.id).order_by(
        SesionUsuario.creado_en.desc()
    ).first()

    return jsonify(
        {
            "token": token,
            "tokenType": "Bearer",
            "expiraEn": sesion.expira_en.isoformat(timespec="seconds") if sesion else None,
            "usuario": usuario.to_dict(),
            "permisos": usuario.permisos,
        }
    )


@auth_bp.get("/me")
@token_required
def me():
    return jsonify({"usuario": g.usuario.to_dict(), "permisos": g.usuario.permisos})


@auth_bp.post("/logout")
@token_required
def logout():
    revocar_sesion(g.sesion)
    return jsonify({"mensaje": "Sesión cerrada"})


@auth_bp.get("/sesiones")
@role_required("admin")
def sesiones_recientes():
    limite = min(int(request.args.get("limite", 12)), 50)
    sesiones = (
        SesionUsuario.query.order_by(SesionUsuario.creado_en.desc()).limit(limite).all()
    )
    ahora = utcnow()
    return jsonify(
        {
            "items": [
                {
                    **sesion.to_dict(),
                    "usuario": sesion.usuario.nombre if sesion.usuario else None,
                    "correo": sesion.usuario.correo if sesion.usuario else None,
                    "rol": sesion.usuario.rol.nombre if sesion.usuario and sesion.usuario.rol else None,
                    "activa": (not sesion.revocado) and sesion.expira_en > ahora,
                }
                for sesion in sesiones
            ]
        }
    )

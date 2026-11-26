"""Usuarios del ERP, roles y permisos."""

from __future__ import annotations

from flask import Blueprint, jsonify
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from auth import role_required
from extensions import db
from models import Permiso, Rol, SesionUsuario, Usuario
from routes.helpers import campo, correo_valido, error, no_encontrado, payload

usuarios_bp = Blueprint("usuarios", __name__)

# Límites alineados con las columnas de `usuarios` y con el formulario de la UI.
MAX_NOMBRE = 120
MAX_CORREO = 160
MIN_PASSWORD = 8
MAX_PASSWORD = 128


def _texto(data: dict, *nombres: str, default: str = "") -> str | None:
    """Lee un campo de texto recortado; None si llega con un tipo inválido."""
    valor = campo(data, *nombres, default=default)
    if not isinstance(valor, str):
        return None
    return valor.strip()


def _password(data: dict) -> str | None:
    """La contraseña no se recorta: los espacios pueden ser parte de la clave."""
    valor = campo(data, "password", "contrasena", default="")
    return valor if isinstance(valor, str) else None


@usuarios_bp.get("/usuarios")
@role_required("admin")
def listar_usuarios():
    usuarios = Usuario.query.order_by(Usuario.nombre.asc()).all()
    return jsonify({"items": [u.to_dict() for u in usuarios], "total": len(usuarios)})


@usuarios_bp.post("/usuarios")
@role_required("admin")
def crear_usuario():
    data = payload()
    correo_bruto = _texto(data, "correo", "email")
    correo = correo_bruto.lower() if correo_bruto is not None else None
    nombre = _texto(data, "nombre")
    password = _password(data)
    rol_nombre = _texto(data, "rol", default="ventas")

    if nombre is None or not (2 <= len(nombre) <= MAX_NOMBRE):
        return error(
            f"El nombre debe tener entre 2 y {MAX_NOMBRE} caracteres.",
            400,
            "nombre_invalido",
        )
    if correo is None or len(correo) > MAX_CORREO or not correo_valido(correo):
        return error(
            f"Ingresa un correo válido de hasta {MAX_CORREO} caracteres.",
            400,
            "correo_invalido",
        )
    if password is None or not (MIN_PASSWORD <= len(password) <= MAX_PASSWORD):
        return error(
            f"La contraseña debe tener entre {MIN_PASSWORD} y {MAX_PASSWORD} caracteres.",
            400,
            "password_invalida",
        )
    if Usuario.query.filter(func.lower(Usuario.correo) == correo).first():
        return error("El correo ya está en uso.", 409, "correo_duplicado")

    rol = Rol.query.filter_by(nombre=rol_nombre).first()
    if not rol:
        return error("Rol inválido")

    usuario = Usuario(
        nombre=nombre,
        correo=correo,
        rol_id=rol.id,
        telefono=str(campo(data, "telefono", default="") or "")[:30] or None,
    )
    usuario.set_password(password)
    db.session.add(usuario)
    try:
        db.session.commit()
    except IntegrityError:
        # Otra petición pudo crear el mismo correo entre la consulta y el alta.
        db.session.rollback()
        return error("El correo ya está en uso.", 409, "correo_duplicado")
    return jsonify(usuario.to_dict()), 201


@usuarios_bp.route("/usuarios/<int:usuario_id>", methods=["PUT", "PATCH"])
@role_required("admin")
def actualizar_usuario(usuario_id: int):
    usuario = db.session.get(Usuario, usuario_id)
    if not usuario:
        return no_encontrado("Usuario")

    data = payload()
    correo_bruto = _texto(data, "correo", "email")
    correo = correo_bruto.lower() if correo_bruto is not None else None
    nombre = _texto(data, "nombre")
    password = _password(data)
    rol_nombre = _texto(data, "rol")

    if nombre is None or not (2 <= len(nombre) <= MAX_NOMBRE):
        return error(
            f"El nombre debe tener entre 2 y {MAX_NOMBRE} caracteres.",
            400,
            "nombre_invalido",
        )
    if correo is None or len(correo) > MAX_CORREO or not correo_valido(correo):
        return error(
            f"Ingresa un correo válido de hasta {MAX_CORREO} caracteres.",
            400,
            "correo_invalido",
        )
    if password is None or (password and not (MIN_PASSWORD <= len(password) <= MAX_PASSWORD)):
        return error(
            f"La contraseña debe tener entre {MIN_PASSWORD} y {MAX_PASSWORD} caracteres.",
            400,
            "password_invalida",
        )

    rol = Rol.query.filter_by(nombre=rol_nombre).first()
    if not rol:
        return error("Rol inválido")

    duplicado = Usuario.query.filter(
        func.lower(Usuario.correo) == correo, Usuario.id != usuario.id
    ).first()
    if duplicado:
        return error("El correo ya está en uso.", 409, "correo_duplicado")

    usuario.nombre = nombre
    usuario.correo = correo
    usuario.rol_id = rol.id
    # Solo cambia la contraseña si se envía una nueva; vacío = conservar la actual.
    # Al cambiarla se revocan las sesiones abiertas de ese usuario.
    if password:
        usuario.set_password(password)
        SesionUsuario.query.filter_by(usuario_id=usuario.id, revocado=False).update(
            {SesionUsuario.revocado: True}, synchronize_session=False
        )

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return error("El correo ya está en uso.", 409, "correo_duplicado")
    return jsonify(usuario.to_dict())


@usuarios_bp.get("/roles")
@role_required("admin")
def listar_roles():
    roles = Rol.query.order_by(Rol.id.asc()).all()
    return jsonify({"items": [r.to_dict() for r in roles], "total": len(roles)})


@usuarios_bp.get("/permisos")
@role_required("admin")
def listar_permisos():
    permisos = Permiso.query.order_by(Permiso.modulo.asc(), Permiso.clave.asc()).all()
    return jsonify({"items": [p.to_dict() for p in permisos], "total": len(permisos)})

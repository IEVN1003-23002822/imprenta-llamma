"""Usuarios del ERP, roles y permisos."""

from __future__ import annotations

from flask import Blueprint, jsonify
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from auth import role_required
from extensions import db
from models import Permiso, Rol, Usuario
from routes.helpers import campo, correo_valido, error, no_encontrado, payload

usuarios_bp = Blueprint("usuarios", __name__)


@usuarios_bp.get("/usuarios")
@role_required("admin")
def listar_usuarios():
    usuarios = Usuario.query.order_by(Usuario.nombre.asc()).all()
    return jsonify({"items": [u.to_dict() for u in usuarios], "total": len(usuarios)})


@usuarios_bp.post("/usuarios")
@role_required("admin")
def crear_usuario():
    data = payload()
    correo = str(campo(data, "correo", "email", default="")).strip().lower()
    nombre = str(campo(data, "nombre", default="")).strip()
    password = str(campo(data, "password", "contrasena", default=""))
    rol_nombre = str(campo(data, "rol", default="ventas")).strip()

    if not nombre or not correo_valido(correo) or len(password) < 8:
        return error("Nombre, correo válido y contraseña de al menos 8 caracteres son obligatorios")
    if Usuario.query.filter(func.lower(Usuario.correo) == correo).first():
        return error("El correo ya está en uso.", 409, "correo_duplicado")

    rol = Rol.query.filter_by(nombre=rol_nombre).first()
    if not rol:
        return error("Rol inválido")

    usuario = Usuario(
        nombre=nombre[:120],
        correo=correo[:160],
        rol_id=rol.id,
        telefono=str(campo(data, "telefono", default="") or "")[:30] or None,
    )
    usuario.set_password(password)
    db.session.add(usuario)
    db.session.commit()
    return jsonify(usuario.to_dict()), 201


@usuarios_bp.route("/usuarios/<int:usuario_id>", methods=["PUT", "PATCH"])
@role_required("admin")
def actualizar_usuario(usuario_id: int):
    usuario = db.session.get(Usuario, usuario_id)
    if not usuario:
        return no_encontrado("Usuario")

    data = payload()
    correo = str(campo(data, "correo", "email", default="")).strip().lower()
    nombre = str(campo(data, "nombre", default="")).strip()
    password = str(campo(data, "password", "contrasena", default=""))
    rol_nombre = str(campo(data, "rol", default="")).strip()

    if not nombre or not correo_valido(correo):
        return error("Nombre y correo válido son obligatorios")
    if password and len(password) < 8:
        return error("La contraseña debe tener al menos 8 caracteres")

    rol = Rol.query.filter_by(nombre=rol_nombre).first()
    if not rol:
        return error("Rol inválido")

    duplicado = Usuario.query.filter(
        func.lower(Usuario.correo) == correo, Usuario.id != usuario.id
    ).first()
    if duplicado:
        return error("El correo ya está en uso.", 409, "correo_duplicado")

    usuario.nombre = nombre[:120]
    usuario.correo = correo[:160]
    usuario.rol_id = rol.id
    # Solo cambia la contraseña si se envía una nueva; vacío = conservar la actual.
    if password:
        usuario.set_password(password)

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

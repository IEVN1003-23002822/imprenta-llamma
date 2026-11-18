"""Clientes del ERP: listado, alta, edición y baja lógica."""

from __future__ import annotations

from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from auth import role_required, token_required
from extensions import db
from models import Cliente
from routes.comun import cliente_por_correo
from routes.helpers import campo, correo_valido, error, no_encontrado, payload
from utils import paginar, parse_int

clientes_bp = Blueprint("clientes", __name__)


@clientes_bp.get("/clientes")
@token_required
def listar_clientes():
    query = Cliente.query
    if request.args.get("segmento"):
        query = query.filter(Cliente.segmento == request.args["segmento"])
    if request.args.get("activo") in {"0", "false"}:
        query = query.filter(Cliente.activo.is_(False))
    elif request.args.get("activo") in {"1", "true"}:
        query = query.filter(Cliente.activo.is_(True))
    busqueda = (request.args.get("q") or "").strip()
    if busqueda:
        patron = f"%{busqueda}%"
        query = query.filter(
            or_(
                Cliente.nombre.ilike(patron),
                Cliente.empresa.ilike(patron),
                Cliente.correo.ilike(patron),
                Cliente.rfc.ilike(patron),
            )
        )
    query = query.order_by(Cliente.nombre.asc())
    return jsonify(
        paginar(
            query,
            parse_int(request.args.get("page"), 1) or 1,
            parse_int(request.args.get("perPage"), 20) or 20,
            lambda c: c.to_dict(incluir_metricas=True),
        )
    )


@clientes_bp.get("/clientes/<int:cliente_id>")
@token_required
def detalle_cliente(cliente_id: int):
    cliente = Cliente.query.get(cliente_id)
    if not cliente:
        return no_encontrado("Cliente")
    return jsonify(cliente.to_dict(incluir_metricas=True))


@clientes_bp.post("/clientes")
@role_required("admin", "ventas")
def crear_cliente():
    data = payload()
    correo = str(campo(data, "correo", "email", default="")).strip().lower()
    nombre = str(campo(data, "nombre", "nombreCliente", default="")).strip()
    if not nombre or not correo_valido(correo):
        return error("Nombre y correo válido son obligatorios")
    if cliente_por_correo(correo):
        return error("Ya existe un cliente con ese correo", 409, "correo_duplicado")

    cliente = Cliente(
        nombre=nombre[:140],
        empresa=str(campo(data, "empresa", default="") or "")[:140] or None,
        correo=correo[:160],
        telefono=str(campo(data, "telefono", default="") or "")[:30] or None,
        direccion=str(campo(data, "direccion", default="") or "")[:240] or None,
        rfc=str(campo(data, "rfc", default="") or "")[:20] or None,
        segmento=str(campo(data, "segmento", default="particular"))[:30],
        notas=str(campo(data, "notas", default="") or "") or None,
        activo=bool(campo(data, "activo", default=True)),
    )
    db.session.add(cliente)
    db.session.commit()
    return jsonify(cliente.to_dict()), 201


@clientes_bp.put("/clientes/<int:cliente_id>")
@role_required("admin", "ventas")
def actualizar_cliente(cliente_id: int):
    cliente = Cliente.query.get(cliente_id)
    if not cliente:
        return no_encontrado("Cliente")
    data = payload()
    for atributo, claves in {
        "nombre": ("nombre",),
        "empresa": ("empresa",),
        "correo": ("correo", "email"),
        "telefono": ("telefono",),
        "direccion": ("direccion",),
        "rfc": ("rfc",),
        "segmento": ("segmento",),
        "notas": ("notas",),
    }.items():
        valor = campo(data, *claves)
        if valor is not None:
            setattr(cliente, atributo, str(valor))
    if "activo" in data:
        cliente.activo = bool(data["activo"])
    db.session.commit()
    return jsonify(cliente.to_dict(incluir_metricas=True))


@clientes_bp.delete("/clientes/<int:cliente_id>")
@role_required("admin")
def desactivar_cliente(cliente_id: int):
    cliente = Cliente.query.get(cliente_id)
    if not cliente:
        return no_encontrado("Cliente")
    cliente.activo = False
    db.session.commit()
    return jsonify({"mensaje": "Cliente desactivado", "id": cliente.id})

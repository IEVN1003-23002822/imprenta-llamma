"""Materias primas, ajustes de existencias y movimientos de inventario."""

from __future__ import annotations

from flask import Blueprint, g, jsonify, request
from sqlalchemy.orm import joinedload

from auth import role_required
from estados import TIPOS_MOVIMIENTO
from extensions import db
from models import MateriaPrima, MovimientoInventario
from routes.helpers import campo, error, no_encontrado, payload
from utils import paginar, parse_decimal, parse_int

inventario_bp = Blueprint("inventario", __name__)


@inventario_bp.get("/materias-primas")
@role_required("admin", "ventas", "inventario", "produccion")
def listar_materias():
    query = MateriaPrima.query.options(joinedload(MateriaPrima.proveedor)).filter_by(activo=True)
    if request.args.get("categoria"):
        query = query.filter(MateriaPrima.categoria == request.args["categoria"])
    if request.args.get("bajoStock") in {"1", "true"}:
        query = query.filter(MateriaPrima.stock_actual <= MateriaPrima.stock_minimo)
    materias = query.order_by(MateriaPrima.nombre.asc()).all()
    return jsonify({"items": [m.to_dict() for m in materias], "total": len(materias)})


@inventario_bp.post("/materias-primas")
@role_required("admin", "inventario", "produccion")
def crear_materia():
    data = payload()
    nombre = str(campo(data, "nombre", default="")).strip()
    if not nombre:
        return error("El nombre es obligatorio")
    materia = MateriaPrima(
        nombre=nombre[:160],
        categoria=str(campo(data, "categoria", default="otro"))[:40],
        unidad_medida=str(campo(data, "unidadMedida", "unidad_medida", default="pieza"))[:20],
        stock_actual=parse_decimal(campo(data, "stockActual", "stock_actual"), 0),
        stock_minimo=parse_decimal(campo(data, "stockMinimo", "stock_minimo"), 0),
        stock_maximo=parse_decimal(campo(data, "stockMaximo", "stock_maximo"), 0),
        costo_unitario=parse_decimal(campo(data, "costoUnitario", "costo_unitario"), 0),
        proveedor_id=parse_int(campo(data, "proveedorId", "proveedor_id")),
    )
    db.session.add(materia)
    db.session.commit()
    return jsonify(materia.to_dict()), 201


@inventario_bp.put("/materias-primas/<int:materia_id>")
@role_required("admin", "inventario", "produccion")
def actualizar_materia(materia_id: int):
    materia = MateriaPrima.query.get(materia_id)
    if not materia:
        return no_encontrado("Materia prima")
    data = payload()
    for atributo, claves in {
        "nombre": ("nombre",),
        "categoria": ("categoria",),
        "unidad_medida": ("unidadMedida", "unidad_medida"),
    }.items():
        valor = campo(data, *claves)
        if valor is not None:
            setattr(materia, atributo, str(valor))
    for atributo, claves in {
        "stock_actual": ("stockActual", "stock_actual"),
        "stock_minimo": ("stockMinimo", "stock_minimo"),
        "stock_maximo": ("stockMaximo", "stock_maximo"),
        "costo_unitario": ("costoUnitario", "costo_unitario"),
    }.items():
        valor = campo(data, *claves)
        if valor is not None:
            setattr(materia, atributo, parse_decimal(valor, 0))
    proveedor_id = campo(data, "proveedorId", "proveedor_id")
    if proveedor_id is not None:
        materia.proveedor_id = parse_int(proveedor_id)
    if "activo" in data:
        materia.activo = bool(data["activo"])
    db.session.commit()
    return jsonify(materia.to_dict())


@inventario_bp.delete("/materias-primas/<int:materia_id>")
@role_required("admin", "inventario", "produccion")
def desactivar_materia(materia_id: int):
    materia = MateriaPrima.query.get(materia_id)
    if not materia:
        return no_encontrado("Materia prima")
    materia.activo = False
    db.session.commit()
    return jsonify({"mensaje": "Insumo desactivado", "id": materia.id})


@inventario_bp.post("/materias-primas/<int:materia_id>/ajuste")
@role_required("admin", "inventario", "produccion")
def ajustar_inventario(materia_id: int):
    materia = MateriaPrima.query.get(materia_id)
    if not materia:
        return no_encontrado("Materia prima")

    data = payload()
    tipo = str(campo(data, "tipo", default="ajuste"))
    cantidad = parse_decimal(campo(data, "cantidad"), 0)
    if tipo not in TIPOS_MOVIMIENTO:
        return error("Tipo de movimiento inválido")

    actual = float(materia.stock_actual or 0)
    if tipo in {"entrada", "devolucion"}:
        nuevo = actual + cantidad
    elif tipo in {"salida", "merma"}:
        nuevo = max(actual - cantidad, 0)
    else:
        nuevo = max(cantidad, 0)

    materia.stock_actual = round(nuevo, 4)
    db.session.add(
        MovimientoInventario(
            materia_prima_id=materia.id,
            tipo=tipo,
            cantidad=cantidad,
            unidad_medida=materia.unidad_medida,
            costo_unitario=materia.costo_unitario,
            referencia=str(campo(data, "referencia", default="") or "") or None,
            motivo=str(campo(data, "motivo", default="") or "") or None,
            usuario_id=g.usuario.id,
        )
    )
    db.session.commit()
    return jsonify({"materia": materia.to_dict()}), 201


@inventario_bp.get("/movimientos")
@role_required("admin", "ventas", "inventario", "produccion")
def listar_movimientos():
    query = MovimientoInventario.query.options(
        joinedload(MovimientoInventario.materia_prima),
        joinedload(MovimientoInventario.usuario),
    )
    if request.args.get("materiaPrimaId"):
        query = query.filter(
            MovimientoInventario.materia_prima_id == parse_int(request.args["materiaPrimaId"])
        )
    query = query.order_by(MovimientoInventario.creado_en.desc())
    return jsonify(
        paginar(
            query,
            parse_int(request.args.get("page"), 1) or 1,
            parse_int(request.args.get("perPage"), 30) or 30,
            lambda m: m.to_dict(),
        )
    )

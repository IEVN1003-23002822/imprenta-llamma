"""CampaÃ±as y actividades de marketing."""

from __future__ import annotations

from datetime import date

from flask import Blueprint, g, jsonify

from auth import role_required
from estados import CANALES
from extensions import db
from models import ActividadMarketing
from routes.helpers import campo, error, no_encontrado, payload
from utils import parse_decimal, parse_fecha

marketing_bp = Blueprint("marketing", __name__)


@marketing_bp.get("/marketing/actividades")
@role_required("admin", "marketing")
def listar_actividades():
    actividades = ActividadMarketing.query.order_by(ActividadMarketing.fecha_inicio.desc()).all()
    return jsonify({"items": [a.to_dict() for a in actividades], "total": len(actividades)})


@marketing_bp.post("/marketing/actividades")
@role_required("admin", "marketing")
def crear_actividad():
    data = payload()
    nombre = str(campo(data, "nombre", default="")).strip()
    if not nombre:
        return error("El nombre de la campaÃ±a es obligatorio")
    canal = str(campo(data, "canal", default="redes-sociales"))
    if canal not in CANALES:
        return error("Canal invÃ¡lido")

    actividad = ActividadMarketing(
        nombre=nombre[:180],
        canal=canal,
        fecha_inicio=parse_fecha(campo(data, "fechaInicio")) or date.today(),
        fecha_fin=parse_fecha(campo(data, "fechaFin")),
        presupuesto=parse_decimal(campo(data, "presupuesto"), 0),
        inversion_real=parse_decimal(campo(data, "inversionReal"), 0),
        ingresos_atribuidos=parse_decimal(campo(data, "ingresosAtribuidos"), 0),
        estado=str(campo(data, "estado", default="planeada")),
        descripcion=str(campo(data, "descripcion", default="") or "") or None,
        creado_por=g.usuario.id,
    )
    db.session.add(actividad)
    db.session.commit()
    return jsonify(actividad.to_dict()), 201


@marketing_bp.put("/marketing/actividades/<int:actividad_id>")
@role_required("admin", "marketing")
def actualizar_actividad(actividad_id: int):
    actividad = ActividadMarketing.query.get(actividad_id)
    if not actividad:
        return no_encontrado("Actividad")
    data = payload()
    for atributo, claves in {
        "nombre": ("nombre",),
        "canal": ("canal",),
        "estado": ("estado",),
        "descripcion": ("descripcion",),
    }.items():
        valor = campo(data, *claves)
        if valor is not None:
            setattr(actividad, atributo, str(valor))
    for atributo, claves in {
        "presupuesto": ("presupuesto",),
        "inversion_real": ("inversionReal", "inversion_real"),
        "ingresos_atribuidos": ("ingresosAtribuidos", "ingresos_atribuidos"),
    }.items():
        valor = campo(data, *claves)
        if valor is not None:
            setattr(actividad, atributo, parse_decimal(valor, 0))
    fecha_inicio = campo(data, "fechaInicio", "fecha_inicio")
    if fecha_inicio:
        actividad.fecha_inicio = parse_fecha(fecha_inicio) or actividad.fecha_inicio
    fecha_fin = campo(data, "fechaFin", "fecha_fin")
    if fecha_fin:
        actividad.fecha_fin = parse_fecha(fecha_fin)
    db.session.commit()
    return jsonify(actividad.to_dict())

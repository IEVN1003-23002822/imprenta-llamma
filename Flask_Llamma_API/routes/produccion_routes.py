"""Tablero de producción, avance de órdenes y control de calidad."""

from __future__ import annotations

from flask import Blueprint, g, jsonify

from auth import role_required, token_required
from estados import ESTADOS_PRODUCCION, ETAPAS
from extensions import db
from models import ControlCalidad, OrdenProduccion, ProduccionEtapa, utcnow
from routes.helpers import campo, error, no_encontrado, payload
from utils import parse_int

produccion_bp = Blueprint("produccion", __name__)


@produccion_bp.get("/produccion/tablero")
@token_required
def tablero_produccion():
    ordenes = OrdenProduccion.query.order_by(OrdenProduccion.creado_en.asc()).all()
    columnas: dict[str, list] = {etapa: [] for etapa in ETAPAS}
    for orden in ordenes:
        if orden.estado in {"completada", "rechazada"}:
            continue
        columnas.setdefault(orden.etapa, []).append(orden.to_dict(incluir_detalle=True))
    return jsonify(
        {
            "columnas": [
                {"etapa": etapa, "ordenes": columnas.get(etapa, [])} for etapa in ETAPAS
            ],
            "total": sum(len(v) for v in columnas.values()),
        }
    )


@produccion_bp.patch("/produccion/ordenes/<int:orden_id>")
@role_required("admin", "produccion")
def actualizar_orden_produccion(orden_id: int):
    orden = OrdenProduccion.query.get(orden_id)
    if not orden:
        return no_encontrado("Orden de producción")

    data = payload()
    etapa = campo(data, "etapa")
    estado = campo(data, "estado")
    observaciones = campo(data, "observaciones")

    if etapa and etapa not in ETAPAS:
        return error("Etapa inválida")
    if estado and estado not in ESTADOS_PRODUCCION:
        return error("Estado de producción inválido")

    etapa_anterior = orden.etapa
    if etapa:
        orden.etapa = etapa
    if estado:
        orden.estado = estado
    if observaciones is not None:
        orden.observaciones = str(observaciones)
    responsable = campo(data, "responsableId", "responsable_id")
    if responsable is not None:
        orden.responsable_id = parse_int(responsable)

    if orden.fecha_inicio is None and orden.estado == "en-proceso":
        orden.fecha_inicio = utcnow()
    if orden.estado == "completada":
        orden.fecha_fin = utcnow()
        orden.pedido.estado = "listo"

    if etapa and etapa != etapa_anterior:
        orden.etapas.append(
            ProduccionEtapa(
                etapa=etapa,
                estado="en-proceso" if orden.estado != "completada" else "completada",
                responsable_id=orden.responsable_id,
                inicio=utcnow(),
                notas=str(observaciones or "") or None,
            )
        )

    db.session.commit()
    return jsonify(orden.to_dict())


@produccion_bp.post("/produccion/ordenes/<int:orden_id>/calidad")
@role_required("admin", "produccion")
def registrar_calidad(orden_id: int):
    orden = OrdenProduccion.query.get(orden_id)
    if not orden:
        return no_encontrado("Orden de producción")

    data = payload()
    criterio = str(campo(data, "criterio", default="")).strip()
    if not criterio:
        return error("Indica el criterio de calidad")

    control = ControlCalidad(
        orden_produccion_id=orden.id,
        criterio=criterio[:160],
        aprobado=bool(campo(data, "aprobado", default=False)),
        observaciones=str(campo(data, "observaciones", default="") or "") or None,
        revisado_por=g.usuario.id,
    )
    db.session.add(control)
    db.session.commit()
    return jsonify(control.to_dict()), 201

"""Tablero de producción, avance de órdenes y control de calidad."""

from __future__ import annotations

from flask import Blueprint, g, jsonify
from sqlalchemy.orm import joinedload, selectinload

from auth import role_required
from estados import ESTADOS_PRODUCCION, ETAPAS
from extensions import db
from models import ControlCalidad, OrdenProduccion, ProduccionEtapa, utcnow
from routes.helpers import campo, error, no_encontrado, payload
from utils import parse_int

produccion_bp = Blueprint("produccion", __name__)


@produccion_bp.get("/produccion/tablero")
@role_required("admin", "ventas", "inventario", "produccion")
def tablero_produccion():
    ordenes = (
        OrdenProduccion.query.filter(
            OrdenProduccion.estado.notin_(["completada", "rechazada"])
        )
        .options(
            joinedload(OrdenProduccion.pedido),
            joinedload(OrdenProduccion.responsable),
            selectinload(OrdenProduccion.etapas).joinedload(ProduccionEtapa.responsable),
            selectinload(OrdenProduccion.controles).joinedload(ControlCalidad.revisor),
        )
        .order_by(OrdenProduccion.creado_en.asc())
        .all()
    )
    etapas_vistas: set[str] = set()
    for orden in ordenes:
        pasos = [registro.etapa for registro in orden.etapas]
        # Los pedidos nuevos guardan todos sus pasos; los antiguos conservan
        # las etapas globales para no romper su tablero.
        if any(paso in ("plasmado", "empaquetado") for paso in pasos):
            etapas_vistas.update(pasos)
        else:
            etapas_vistas.update(ETAPAS)
        etapas_vistas.add(orden.etapa)
    etapas_ordenadas = [etapa for etapa in ETAPAS if etapa in etapas_vistas]
    if not etapas_ordenadas:
        etapas_ordenadas = list(ETAPAS)

    columnas: dict[str, list] = {etapa: [] for etapa in etapas_ordenadas}
    for orden in ordenes:
        columnas.setdefault(orden.etapa, []).append(orden.to_dict(incluir_detalle=True))
    return jsonify(
        {
            "columnas": [
                {"etapa": etapa, "ordenes": columnas.get(etapa, [])}
                for etapa in etapas_ordenadas
            ],
            "etapas": etapas_ordenadas,
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

    etapas_orden = [registro.etapa for registro in orden.etapas]
    tiene_pendientes = any(registro.estado == "pendiente" for registro in orden.etapas)
    if etapa and tiene_pendientes and etapa not in etapas_orden:
        return error("La etapa no corresponde a los pasos del producto")

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
        for registro in orden.etapas:
            registro.estado = "completada"
            registro.fin = registro.fin or utcnow()

    if etapa and etapa != etapa_anterior and orden.estado != "completada":
        previo = next(
            (registro for registro in orden.etapas if registro.etapa == etapa_anterior),
            None,
        )
        actual = next(
            (registro for registro in orden.etapas if registro.etapa == etapa), None
        )
        avanza = True
        if etapa_anterior in etapas_orden and etapa in etapas_orden:
            avanza = etapas_orden.index(etapa) > etapas_orden.index(etapa_anterior)

        if previo:
            if avanza:
                previo.estado = "completada"
                previo.fin = previo.fin or utcnow()
            else:
                previo.estado = "pendiente"
                previo.fin = None

        if actual:
            actual.estado = (
                "completada" if orden.estado == "completada" else "en-proceso"
            )
            actual.inicio = actual.inicio or utcnow()
            actual.responsable_id = orden.responsable_id
            actual.fin = None
        else:
            orden.etapas.append(
                ProduccionEtapa(
                    etapa=etapa,
                    estado="completada" if orden.estado == "completada" else "en-proceso",
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

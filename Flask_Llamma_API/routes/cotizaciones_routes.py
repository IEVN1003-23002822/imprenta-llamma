"""Cotizaciones: listado, alta, cambio de estado y conversión a pedido."""

from __future__ import annotations

from datetime import date, timedelta

from flask import Blueprint, g, jsonify, request
from sqlalchemy import or_

from auth import role_required, token_required
from estados import ESTADOS_COTIZACION
from extensions import db
from models import (
    Cliente,
    Cotizacion,
    OrdenProduccion,
    Pago,
    Pedido,
    PedidoItem,
    ProduccionEtapa,
    SolicitudCotizacion,
    utcnow,
)
from routes.comun import crear_cotizacion, descontar_inventario
from routes.helpers import campo, error, no_encontrado, payload
from utils import generar_folio, paginar, parse_fecha, parse_int

cotizaciones_bp = Blueprint("cotizaciones", __name__)


@cotizaciones_bp.get("/cotizaciones")
@token_required
def listar_cotizaciones():
    query = Cotizacion.query
    estado = request.args.get("estado")
    if estado:
        query = query.filter(Cotizacion.estado == estado)
    busqueda = (request.args.get("q") or "").strip()
    if busqueda:
        patron = f"%{busqueda}%"
        query = query.join(Cliente).filter(
            or_(Cotizacion.folio.ilike(patron), Cliente.nombre.ilike(patron))
        )
    query = query.order_by(Cotizacion.creado_en.desc())
    return jsonify(
        paginar(
            query,
            parse_int(request.args.get("page"), 1) or 1,
            parse_int(request.args.get("perPage"), 20) or 20,
            lambda c: c.to_dict(incluir_items=False),
        )
    )


@cotizaciones_bp.get("/cotizaciones/<int:cotizacion_id>")
@token_required
def detalle_cotizacion(cotizacion_id: int):
    cotizacion = Cotizacion.query.get(cotizacion_id)
    if not cotizacion:
        return no_encontrado("Cotización")
    return jsonify(cotizacion.to_dict())


@cotizaciones_bp.post("/cotizaciones")
@role_required("admin", "ventas")
def crear_cotizacion_desde_api():
    data = payload()
    solicitud = None
    solicitud_id = parse_int(campo(data, "solicitudId", "solicitud_id"))
    if solicitud_id:
        solicitud = SolicitudCotizacion.query.get(solicitud_id)
        if not solicitud:
            return no_encontrado("Solicitud")
        if solicitud.cotizaciones:
            return (
                jsonify(
                    {
                        "error": "La solicitud ya fue cotizada",
                        "cotizacion": solicitud.cotizaciones[0].to_dict(),
                    }
                ),
                409,
            )

    try:
        cotizacion = crear_cotizacion(solicitud, data, g.usuario)
        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        return error(str(exc))
    return jsonify(cotizacion.to_dict()), 201


@cotizaciones_bp.patch("/cotizaciones/<int:cotizacion_id>/estado")
@role_required("admin", "ventas")
def cambiar_estado_cotizacion(cotizacion_id: int):
    cotizacion = Cotizacion.query.get(cotizacion_id)
    if not cotizacion:
        return no_encontrado("Cotización")

    estado = str(campo(payload(), "estado", default="")).strip()
    if estado not in ESTADOS_COTIZACION:
        return error(f"Estado inválido. Usa: {', '.join(sorted(ESTADOS_COTIZACION))}")

    cotizacion.estado = estado
    db.session.commit()
    return jsonify(cotizacion.to_dict(incluir_items=False))


@cotizaciones_bp.post("/cotizaciones/<int:cotizacion_id>/convertir-pedido")
@role_required("admin", "ventas")
def convertir_cotizacion(cotizacion_id: int):
    cotizacion = Cotizacion.query.get(cotizacion_id)
    if not cotizacion:
        return no_encontrado("Cotización")
    if cotizacion.pedidos:
        return (
            jsonify(
                {
                    "error": "La cotización ya tiene un pedido",
                    "pedido": cotizacion.pedidos[0].to_dict(),
                }
            ),
            409,
        )

    data = payload()
    fecha_entrega = parse_fecha(campo(data, "fechaEntrega", "fecha_entrega"))
    if not fecha_entrega:
        fecha_entrega = date.today() + timedelta(days=10)

    pedido = Pedido(
        folio=generar_folio("LLM", Pedido, con_anio=False, relleno=4, inicio=1040),
        cotizacion_id=cotizacion.id,
        cliente_id=cotizacion.cliente_id,
        estado="confirmado",
        prioridad=str(campo(data, "prioridad", default="media")),
        fecha_entrega=fecha_entrega,
        subtotal=cotizacion.subtotal,
        impuestos=cotizacion.impuestos,
        total=cotizacion.total,
        anticipo=cotizacion.anticipo,
        saldo=cotizacion.saldo,
        notas=cotizacion.notas,
        creado_por=g.usuario.id,
    )

    for item in cotizacion.items:
        pedido.items.append(
            PedidoItem(
                producto_id=item.producto_id,
                descripcion=item.descripcion,
                especificaciones=item.especificaciones,
                cantidad=item.cantidad,
                precio_unitario=item.precio_unitario,
                importe=item.importe,
            )
        )

    if campo(data, "anticipoPagado", "anticipo_pagado", default=False) in (True, "true", "1", 1):
        pedido.pagos.append(
            Pago(
                tipo="anticipo",
                metodo=str(campo(data, "metodoPago", default="transferencia")),
                monto=cotizacion.anticipo,
                referencia=str(campo(data, "referenciaPago", default="") or "") or None,
                confirmado=True,
                registrado_por=g.usuario.id,
            )
        )

    orden = OrdenProduccion(
        etapa="diseno",
        estado="pendiente",
        responsable_id=parse_int(campo(data, "responsableId")),
        pedido=pedido,
    )
    orden.etapas.append(
        ProduccionEtapa(
            etapa="diseno",
            estado="en-proceso",
            responsable_id=orden.responsable_id,
            inicio=utcnow(),
            notas="Orden creada desde cotización aprobada",
        )
    )

    cotizacion.estado = "convertida"
    if cotizacion.solicitud:
        cotizacion.solicitud.estado = "convertida"

    db.session.add(pedido)
    db.session.flush()
    descontar_inventario(pedido, g.usuario)
    db.session.commit()
    return jsonify(pedido.to_dict()), 201

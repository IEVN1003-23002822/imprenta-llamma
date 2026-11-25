"""Cotizaciones: listado, alta, cambio de estado y conversión a pedido."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from flask import Blueprint, g, jsonify, request
from sqlalchemy import or_
from sqlalchemy.orm import joinedload, selectinload

from auth import role_required
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
from routes.comun import (
    DescuentoInventarioError,
    InventarioInsuficiente,
    _descontar_inventario,
    crear_cotizacion,
)
from routes.helpers import campo, error, no_encontrado, payload
from utils import (
    MENSAJE_FECHA_MINIMA,
    calcular_fecha_minima_entrega,
    generar_folio,
    paginar,
    parse_fecha,
    parse_int,
)

cotizaciones_bp = Blueprint("cotizaciones", __name__)


@cotizaciones_bp.get("/cotizaciones")
@role_required("admin", "ventas", "produccion")
def listar_cotizaciones():
    query = Cotizacion.query.options(
        joinedload(Cotizacion.cliente), joinedload(Cotizacion.usuario)
    )
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
@role_required("admin", "ventas", "produccion")
def detalle_cotizacion(cotizacion_id: int):
    cotizacion = (
        Cotizacion.query.options(
            selectinload(Cotizacion.items),
            joinedload(Cotizacion.cliente),
            joinedload(Cotizacion.usuario),
        )
        .filter_by(id=cotizacion_id)
        .first()
    )
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
    cotizacion = (
        Cotizacion.query.filter_by(id=cotizacion_id).with_for_update().first()
    )
    if not cotizacion:
        return no_encontrado("Cotización")

    estado = str(campo(payload(), "estado", default="")).strip()
    if estado not in ESTADOS_COTIZACION:
        return error(f"Estado inválido. Usa: {', '.join(sorted(ESTADOS_COTIZACION))}")

    descuento = None
    if estado == "aprobada":
        if cotizacion.inventario_descontado:
            descuento = {"descontados": [], "alertas": []}
        else:
            try:
                descuento = _descontar_inventario(cotizacion, g.usuario)
            except DescuentoInventarioError as exc:
                db.session.rollback()
                cuerpo = {
                    "error": (
                        "Inventario insuficiente"
                        if isinstance(exc, InventarioInsuficiente)
                        else str(exc)
                    ),
                    "mensaje": str(exc),
                    "detalles": exc.detalles,
                }
                return jsonify(cuerpo), 400

    cotizacion.estado = estado
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    data = cotizacion.to_dict(incluir_items=False)
    if descuento is not None:
        data["descuento"] = descuento
    return jsonify(data)


@cotizaciones_bp.post("/cotizaciones/<int:cotizacion_id>/convertir-pedido")
@role_required("admin", "ventas")
def convertir_cotizacion(cotizacion_id: int):
    cotizacion = (
        Cotizacion.query.filter_by(id=cotizacion_id).with_for_update().first()
    )
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
    if fecha_entrega and fecha_entrega < calcular_fecha_minima_entrega(date.today()):
        return error(MENSAJE_FECHA_MINIMA, 400, "fecha_invalida")
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
        anticipo = Decimal(str(cotizacion.anticipo or 0)).quantize(Decimal("0.01"))
        pedido.pagos.append(
            Pago(
                tipo="anticipo",
                metodo=str(campo(data, "metodoPago", default="transferencia")),
                monto=float(anticipo),
                referencia=str(campo(data, "referenciaPago", default="") or "") or None,
                confirmado=True,
                registrado_por=g.usuario.id,
            )
        )
        saldo_actual = Decimal(str(pedido.saldo or 0))
        pedido.saldo = float(max(saldo_actual - anticipo, Decimal("0.00")))
        if pedido.saldo <= 0 and pedido.estado == "confirmado":
            pedido.estado = "en-produccion"

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
    try:
        db.session.flush()
        if cotizacion.inventario_descontado:
            pedido.inventario_descontado = True
            descuento = {"descontados": [], "alertas": []}
        else:
            descuento = _descontar_inventario(pedido, g.usuario)
            cotizacion.inventario_descontado = True
        db.session.commit()
    except DescuentoInventarioError as exc:
        db.session.rollback()
        cuerpo = {
            "error": (
                "Inventario insuficiente"
                if isinstance(exc, InventarioInsuficiente)
                else str(exc)
            ),
            "mensaje": str(exc),
            "detalles": exc.detalles,
        }
        return jsonify(cuerpo), 400

    data = pedido.to_dict()
    data["descuento"] = descuento
    return jsonify(data), 201

"""Pedidos: listado, consulta avanzada, alta, estado y pagos."""

from __future__ import annotations

import math
from datetime import date
from decimal import Decimal

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload, selectinload

from auth import role_required
from estados import ESTADOS_PEDIDO
from extensions import db
from models import (
    Cliente,
    ControlCalidad,
    OrdenProduccion,
    Pago,
    Pedido,
    PedidoItem,
    ProduccionEtapa,
    Producto,
    utcnow,
)
from produccion_config import pasos_para_items
from routes.comun import (
    DescuentoInventarioError,
    InventarioInsuficiente,
    _descontar_inventario,
    partidas_a_cotizacion,
    totales,
)
from routes.helpers import campo, error, lista_items, no_encontrado, payload
from utils import (
    MENSAJE_FECHA_MINIMA,
    calcular_fecha_minima_entrega,
    generar_folio,
    paginar,
    parse_decimal,
    parse_fecha,
    parse_int,
)

pedidos_bp = Blueprint("pedidos", __name__)


@pedidos_bp.get("/pedidos")
@role_required("admin", "ventas", "produccion")
def listar_pedidos():
    query = Pedido.query.options(joinedload(Pedido.cliente))
    estado = request.args.get("estado")
    if estado:
        query = query.filter(Pedido.estado == estado)
    busqueda = (request.args.get("q") or "").strip()
    if busqueda:
        patron = f"%{busqueda}%"
        query = query.join(Cliente).filter(
            or_(Pedido.folio.ilike(patron), Cliente.nombre.ilike(patron))
        )
    query = query.order_by(Pedido.creado_en.desc())
    return jsonify(
        paginar(
            query,
            parse_int(request.args.get("page"), 1) or 1,
            parse_int(request.args.get("perPage"), 20) or 20,
            lambda p: p.to_dict(incluir_detalle=False),
        )
    )


@pedidos_bp.get("/pedidos/<int:pedido_id>")
@role_required("admin", "ventas", "produccion")
def detalle_pedido(pedido_id: int):
    pedido = (
        Pedido.query.options(
            joinedload(Pedido.cliente),
            joinedload(Pedido.confirmador_entrega),
            selectinload(Pedido.items),
            selectinload(Pedido.pagos),
            selectinload(Pedido.orden_produccion).options(
                joinedload(OrdenProduccion.responsable),
                joinedload(OrdenProduccion.pedido),
                selectinload(OrdenProduccion.etapas).joinedload(ProduccionEtapa.responsable),
                selectinload(OrdenProduccion.controles).joinedload(ControlCalidad.revisor),
            ),
        )
        .filter_by(id=pedido_id)
        .first()
    )
    if not pedido:
        return no_encontrado("Pedido")
    return jsonify(pedido.to_dict())


@pedidos_bp.get("/consultas/pedidos")
@role_required("admin", "ventas", "produccion")
def consultar_pedidos():
    """Búsqueda avanzada de pedidos con filtros y agregados del periodo."""
    query = Pedido.query.join(Cliente)
    busqueda = (request.args.get("q") or "").strip()
    if busqueda:
        patron = f"%{busqueda}%"
        query = (
            query.outerjoin(PedidoItem)
            .filter(
                or_(
                    Pedido.folio.ilike(patron),
                    Cliente.nombre.ilike(patron),
                    Cliente.empresa.ilike(patron),
                    PedidoItem.descripcion.ilike(patron),
                )
            )
            .distinct()
        )

    estado = (request.args.get("estado") or "").strip()
    if estado:
        query = query.filter(Pedido.estado == estado)

    cliente_id = parse_int(request.args.get("clienteId"))
    if cliente_id:
        query = query.filter(Pedido.cliente_id == cliente_id)

    desde = parse_fecha(request.args.get("desde"))
    if desde:
        query = query.filter(Pedido.fecha_pedido >= desde)
    hasta = parse_fecha(request.args.get("hasta"))
    if hasta:
        query = query.filter(Pedido.fecha_pedido <= hasta)

    linea = (request.args.get("linea") or "").strip()
    if linea:
        query = query.filter(
            Pedido.id.in_(
                db.session.query(PedidoItem.pedido_id)
                .join(Producto, Producto.id == PedidoItem.producto_id)
                .filter(Producto.linea_produccion == linea)
            )
        )

    ids = [fila[0] for fila in query.with_entities(Pedido.id).all()]
    page = parse_int(request.args.get("page"), 1) or 1
    per_page = parse_int(request.args.get("perPage"), 20) or 20

    def serializar(pedido: Pedido) -> dict:
        data = pedido.to_dict(incluir_detalle=False)
        lineas = {
            item.producto.linea_produccion
            for item in pedido.items
            if item.producto and item.producto.linea_produccion
        }
        data["lineas"] = sorted(lineas)
        data["partidas"] = len(pedido.items)
        return data

    paginado = (
        Pedido.query.filter(Pedido.id.in_(ids))
        .options(
            joinedload(Pedido.cliente),
            selectinload(Pedido.items).joinedload(PedidoItem.producto),
        )
        .order_by(Pedido.fecha_pedido.desc(), Pedido.id.desc())
        .paginate(page=max(page, 1), per_page=min(max(per_page, 1), 100), error_out=False)
    )

    resumen = (
        db.session.query(
            func.count(Pedido.id),
            func.coalesce(func.sum(Pedido.total), 0),
        )
        .filter(Pedido.id.in_(ids))
        .one()
    )
    entregados = Pedido.query.filter(Pedido.id.in_(ids), Pedido.estado == "entregado").count()
    total_monto = float(resumen[1] or 0)
    total_pedidos = int(resumen[0] or 0)

    lineas = (
        db.session.query(
            Producto.linea_produccion,
            func.coalesce(func.sum(PedidoItem.importe), 0),
        )
        .select_from(PedidoItem)
        .join(Producto, Producto.id == PedidoItem.producto_id)
        .join(Pedido, Pedido.id == PedidoItem.pedido_id)
        .filter(Pedido.id.in_(ids))
        .group_by(Producto.linea_produccion)
        .order_by(func.sum(PedidoItem.importe).desc())
        .all()
    )

    clientes = (
        db.session.query(
            Cliente.id,
            Cliente.nombre,
            func.count(Pedido.id),
            func.coalesce(func.sum(Pedido.total), 0),
        )
        .join(Pedido, Pedido.cliente_id == Cliente.id)
        .filter(Pedido.id.in_(ids))
        .group_by(Cliente.id, Cliente.nombre)
        .order_by(func.sum(Pedido.total).desc())
        .limit(5)
        .all()
    )

    return jsonify(
        {
            "items": [serializar(pedido) for pedido in paginado.items],
            "total": paginado.total,
            "pagina": paginado.page,
            "porPagina": paginado.per_page,
            "paginas": paginado.pages,
            "resumen": {
                "pedidos": total_pedidos,
                "monto": round(total_monto, 2),
                "ticket": round(total_monto / total_pedidos, 2) if total_pedidos else 0,
                "entregados": entregados,
            },
            "ventasPorLinea": [
                {"linea": fila[0] or "otro", "total": float(fila[1] or 0)} for fila in lineas
            ],
            "topClientes": [
                {
                    "id": fila[0],
                    "nombre": fila[1],
                    "pedidos": int(fila[2] or 0),
                    "total": float(fila[3] or 0),
                }
                for fila in clientes
            ],
        }
    )


@pedidos_bp.post("/pedidos")
@role_required("admin", "ventas")
def crear_pedido():
    data = payload()
    cliente_id = parse_int(campo(data, "clienteId", "cliente_id"))
    cliente = Cliente.query.get(cliente_id) if cliente_id else None
    if not cliente:
        return error("Indica un clienteId válido")

    items_brutos = lista_items(data)
    if not items_brutos:
        return error("El pedido necesita al menos una partida")

    items, subtotal = partidas_a_cotizacion(items_brutos, data)
    fecha_entrega = parse_fecha(campo(data, "fechaEntrega", "fecha_entrega"))
    if fecha_entrega and fecha_entrega < calcular_fecha_minima_entrega(date.today()):
        return error(MENSAJE_FECHA_MINIMA, 400, "fecha_invalida")

    desglose = totales(subtotal)
    # El anticipo es una referencia del 50%; sin pagos registrados se debe todo.
    desglose["saldo"] = desglose["total"]

    pedido = Pedido(
        folio=generar_folio("LLM", Pedido, con_anio=False, relleno=4, inicio=1040),
        cliente_id=cliente.id,
        estado=str(campo(data, "estado", default="confirmado")),
        prioridad=str(campo(data, "prioridad", default="media")),
        fecha_entrega=fecha_entrega,
        nota_entrega=str(campo(data, "notaEntrega", "nota_entrega", default="") or "")[:240]
        or None,
        entrega_confirmada_en=utcnow() if fecha_entrega else None,
        entrega_confirmada_por=g.usuario.id if fecha_entrega else None,
        notas=str(campo(data, "notas", default="") or "") or None,
        creado_por=g.usuario.id,
        **desglose,
    )
    pedido.items = [
        PedidoItem(
            producto_id=item.producto_id,
            descripcion=item.descripcion,
            especificaciones=item.especificaciones,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,
            importe=item.importe,
        )
        for item in items
    ]

    pasos = pasos_para_items(items)
    orden = OrdenProduccion(etapa=pasos[0], estado="pendiente", pedido=pedido)
    for indice, paso in enumerate(pasos):
        orden.etapas.append(
            ProduccionEtapa(
                etapa=paso,
                estado="en-proceso" if indice == 0 else "pendiente",
                inicio=utcnow() if indice == 0 else None,
            )
        )

    db.session.add(pedido)
    try:
        db.session.flush()
        descuento = _descontar_inventario(pedido, g.usuario)
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


@pedidos_bp.patch("/pedidos/<int:pedido_id>/entrega")
@role_required("admin", "ventas")
def actualizar_entrega_pedido(pedido_id: int):
    """Confirma o reprograma la fecha de entrega comprometida con el cliente."""
    pedido = Pedido.query.get(pedido_id)
    if not pedido:
        return no_encontrado("Pedido")

    data = payload()
    fecha_entrega = parse_fecha(campo(data, "fechaEntrega", "fecha_entrega"))
    if not fecha_entrega:
        return error(
            "Indica la fecha de entrega comprometida (AAAA-MM-DD).",
            400,
            "fecha_invalida",
        )
    if fecha_entrega < calcular_fecha_minima_entrega(date.today()):
        return error(MENSAJE_FECHA_MINIMA, 400, "fecha_invalida")

    if "notaEntrega" in data or "nota_entrega" in data:
        nota = str(campo(data, "notaEntrega", "nota_entrega", default="") or "").strip()
        if len(nota) > 240:
            return error(
                "La nota de entrega no puede exceder 240 caracteres.",
                400,
                "nota_invalida",
            )
        pedido.nota_entrega = nota or None

    pedido.fecha_entrega = fecha_entrega
    pedido.entrega_confirmada_en = utcnow()
    pedido.entrega_confirmada_por = g.usuario.id
    db.session.commit()
    return jsonify(pedido.to_dict())


@pedidos_bp.patch("/pedidos/<int:pedido_id>/estado")
@role_required("admin", "ventas", "produccion")
def cambiar_estado_pedido(pedido_id: int):
    pedido = Pedido.query.get(pedido_id)
    if not pedido:
        return no_encontrado("Pedido")
    estado = str(campo(payload(), "estado", default="")).strip()
    if estado not in ESTADOS_PEDIDO:
        return error(f"Estado inválido. Usa: {', '.join(sorted(ESTADOS_PEDIDO))}")
    pedido.estado = estado
    db.session.commit()
    return jsonify(pedido.to_dict(incluir_detalle=False))


@pedidos_bp.post("/pedidos/<int:pedido_id>/pagos")
@role_required("admin", "ventas")
def registrar_pago(pedido_id: int):
    """Registra un anticipo, abono o liquidación y recalcula el saldo."""
    pedido = Pedido.query.get(pedido_id)
    if not pedido:
        return no_encontrado("Pedido")

    data = payload()
    tipo = str(campo(data, "tipo", default="abono"))
    if tipo not in {"anticipo", "saldo", "abono"}:
        return error("Tipo de pago inválido. Usa anticipo, saldo o abono")

    monto = parse_decimal(campo(data, "monto"), 0)
    if not math.isfinite(monto) or monto <= 0:
        return error("El monto del pago debe ser mayor a cero")

    # El saldo se calcula desde los pagos confirmados; el anticipo del pedido
    # es solo una referencia del 50% y no se descuenta hasta que se registra.
    total = Decimal(str(pedido.total or 0)).quantize(Decimal("0.01"))
    pagado = sum(
        (Decimal(str(pago.monto or 0)).quantize(Decimal("0.01")) for pago in pedido.pagos if pago.confirmado),
        Decimal("0.00"),
    )
    saldo_actual = max(total - pagado, Decimal("0.00"))
    monto_decimal = Decimal(str(monto)).quantize(Decimal("0.01"))
    if monto_decimal > saldo_actual:
        return error("El pago excede el saldo pendiente del pedido")

    pago = Pago(
        tipo=tipo,
        metodo=str(campo(data, "metodo", default="transferencia"))[:30],
        monto=float(monto_decimal),
        referencia=str(campo(data, "referencia", default="") or "")[:120] or None,
        confirmado=bool(campo(data, "confirmado", default=True)),
        registrado_por=g.usuario.id,
    )
    # Se agrega a la colección para que el recálculo del saldo incluya el abono.
    pedido.pagos.append(pago)
    db.session.flush()

    if pago.confirmado:
        pedido.saldo = float(max(total - (pagado + monto_decimal), Decimal("0.00")))
    else:
        pedido.saldo = float(saldo_actual)
    if pedido.saldo <= 0 and pedido.estado == "confirmado":
        pedido.estado = "en-produccion"

    db.session.commit()
    return jsonify({"pago": pago.to_dict(), "pedido": pedido.to_dict()}), 201

"""Endpoints internos del ERP de Llamma, protegidos por rol."""

from __future__ import annotations

import os
from datetime import date, timedelta

from flask import Blueprint, current_app, g, jsonify, request, send_from_directory
from sqlalchemy import func, or_

from auth import role_required, token_required
from extensions import db
from models import (
    ActividadMarketing,
    Cliente,
    ControlCalidad,
    Cotizacion,
    CotizacionItem,
    MateriaPrima,
    MovimientoInventario,
    OrdenCompra,
    OrdenCompraItem,
    OrdenProduccion,
    Pago,
    Pedido,
    PedidoItem,
    Permiso,
    ProduccionEtapa,
    Producto,
    Proveedor,
    Receta,
    RecetaComponente,
    Rol,
    SolicitudCotizacion,
    Usuario,
    utcnow,
)
from routes.helpers import campo, correo_valido, error, lista_items, no_encontrado, payload
from utils import generar_folio, paginar, parse_decimal, parse_fecha, parse_int

admin_bp = Blueprint("admin", __name__)

ESTADOS_SOLICITUD = {"nueva", "en-revision", "cotizada", "convertida", "descartada"}
ESTADOS_COTIZACION = {"borrador", "enviada", "aprobada", "rechazada", "vencida", "convertida"}
ESTADOS_PEDIDO = {"cotizacion", "confirmado", "en-produccion", "listo", "entregado", "cancelado"}
ETAPAS = {"diseno", "impresion", "laminado", "corte", "confeccion", "armado", "acabado", "entrega"}
ESTADOS_PRODUCCION = {"pendiente", "en-proceso", "pausada", "completada", "rechazada"}
ESTADOS_COMPRA = {"pendiente", "confirmada", "en-transito", "recibida", "cancelada"}
CANALES = {"redes-sociales", "google-ads", "correo", "punto-de-venta", "referidos", "otro"}


def _totales(subtotal: float) -> dict:
    iva = current_app.config["IVA_RATE"]
    anticipo_rate = current_app.config["ANTICIPO_RATE"]
    subtotal = round(subtotal, 2)
    impuestos = round(subtotal * iva, 2)
    total = round(subtotal + impuestos, 2)
    anticipo = round(total * anticipo_rate, 2)
    return {
        "subtotal": subtotal,
        "impuestos": impuestos,
        "total": total,
        "anticipo": anticipo,
        "saldo": round(total - anticipo, 2),
    }


def _cliente_por_correo(correo: str) -> Cliente | None:
    return Cliente.query.filter(func.lower(Cliente.correo) == correo.lower()).first()


def _upsert_cliente(
    *,
    nombre: str,
    correo: str,
    telefono: str | None = None,
    empresa: str | None = None,
    segmento: str = "particular",
    rfc: str | None = None,
    direccion: str | None = None,
) -> Cliente:
    cliente = _cliente_por_correo(correo)
    if cliente:
        cliente.nombre = nombre or cliente.nombre
        cliente.telefono = telefono or cliente.telefono
        cliente.empresa = empresa or cliente.empresa
        cliente.direccion = direccion or cliente.direccion
        cliente.rfc = rfc or cliente.rfc
        return cliente

    cliente = Cliente(
        nombre=nombre[:140],
        correo=correo[:160],
        telefono=(telefono or "")[:30] or None,
        empresa=(empresa or "")[:140] or None,
        segmento=(segmento or "particular")[:30],
        rfc=(rfc or "")[:20] or None,
        direccion=(direccion or "")[:240] or None,
    )
    db.session.add(cliente)
    return cliente


def _items_a_cotizacion(items: list, data: dict) -> tuple[list[CotizacionItem], float]:
    resultantes: list[CotizacionItem] = []
    subtotal = 0.0

    for bruto in items:
        if not isinstance(bruto, dict):
            continue
        producto = None
        producto_id = campo(bruto, "productoId", "producto_id")
        if producto_id:
            producto = Producto.query.get(parse_int(producto_id))

        cantidad = max(parse_decimal(campo(bruto, "cantidad", default=1), 1), 0.01)
        precio = campo(bruto, "precioUnitario", "precio_unitario")
        if precio is None:
            if producto:
                precio = float(producto.precio_base or 0)
            else:
                precio = campo(bruto, "precioEstimado", "precio_estimado", default=0)
        precio = max(parse_decimal(precio, 0), 0)
        importe = round(precio * cantidad, 2)

        descripcion = str(
            campo(bruto, "descripcion", "nombreProducto", "nombre_producto", default="")
            or (producto.nombre if producto else "Concepto")
        ).strip()

        resultantes.append(
            CotizacionItem(
                producto_id=producto.id if producto else None,
                descripcion=descripcion[:200],
                especificaciones=(
                    str(campo(bruto, "especificaciones", "detalle", default="") or "")[:240] or None
                ),
                cantidad=cantidad,
                precio_unitario=precio,
                importe=importe,
            )
        )
        subtotal += importe

    return resultantes, round(subtotal, 2)


def _crear_cotizacion(solicitud: SolicitudCotizacion | None, data: dict, usuario: Usuario) -> Cotizacion:
    if solicitud:
        nombre = str(
            campo(data, "nombreCliente", "nombre", default=solicitud.nombre_cliente)
        ).strip()
        correo = str(campo(data, "correo", "email", default=solicitud.correo)).strip().lower()
        telefono = campo(data, "telefono", default=solicitud.telefono)
        empresa = campo(data, "empresa", default=solicitud.empresa)
        segmento = str(campo(data, "segmento", default=solicitud.segmento))
        cliente = _upsert_cliente(
            nombre=nombre,
            correo=correo,
            telefono=telefono,
            empresa=empresa,
            segmento=segmento,
            rfc=campo(data, "rfc"),
            direccion=campo(data, "direccion"),
        )
        items_brutos = lista_items(data) or [
            {
                "productoId": item.producto_id,
                "descripcion": item.nombre_producto,
                "especificaciones": item.especificaciones,
                "cantidad": float(item.cantidad),
                "precioEstimado": float(item.precio_estimado or 0),
            }
            for item in solicitud.items
        ]
    else:
        cliente_id = parse_int(campo(data, "clienteId", "cliente_id"))
        cliente = Cliente.query.get(cliente_id) if cliente_id else None
        if not cliente:
            correo = str(campo(data, "correo", "email", default="")).strip().lower()
            nombre = str(campo(data, "nombreCliente", "nombre", default="")).strip()
            if not correo_valido(correo) or not nombre:
                raise ValueError("Se requiere clienteId o los datos de un cliente nuevo")
            cliente = _upsert_cliente(
                nombre=nombre,
                correo=correo,
                telefono=campo(data, "telefono"),
                empresa=campo(data, "empresa"),
                segmento=str(campo(data, "segmento", default="particular")),
                rfc=campo(data, "rfc"),
                direccion=campo(data, "direccion"),
            )
        items_brutos = lista_items(data)

    if not items_brutos:
        raise ValueError("La cotización necesita al menos una partida")

    items, subtotal = _items_a_cotizacion(items_brutos, data)
    if not items:
        raise ValueError("Las partidas enviadas no son válidas")

    totales = _totales(subtotal)
    cotizacion = Cotizacion(
        folio=generar_folio("COT", Cotizacion),
        solicitud_id=solicitud.id if solicitud else None,
        cliente_id=cliente.id,
        usuario_id=usuario.id,
        estado=str(campo(data, "estado", default="borrador")),
        vigencia_dias=parse_int(campo(data, "vigenciaDias", "vigencia_dias"), 15) or 15,
        notas=str(campo(data, "notas", "mensaje", default="") or "") or None,
        **totales,
    )
    cotizacion.items = items
    db.session.add(cotizacion)

    if solicitud:
        solicitud.estado = "cotizada"

    db.session.flush()
    return cotizacion


def _descontar_inventario(pedido: Pedido, usuario: Usuario) -> None:
    """Descuenta insumos según la receta de cada producto del pedido."""
    for item in pedido.items:
        if not item.producto or not item.producto.receta:
            continue
        receta = item.producto.receta
        rendimiento = float(receta.rendimiento or 1) or 1
        for componente in receta.componentes:
            materia = componente.materia_prima
            if not materia:
                continue
            requerido = (
                float(componente.cantidad)
                * float(item.cantidad)
                * (1 + float(componente.desperdicio_porcentaje or 0) / 100)
                / rendimiento
            )
            requerido = round(requerido, 4)
            disponible = float(materia.stock_actual or 0)
            descontado = min(max(requerido, 0), max(disponible, 0))
            if descontado <= 0:
                continue

            materia.stock_actual = round(disponible - descontado, 4)
            db.session.add(
                MovimientoInventario(
                    materia_prima_id=materia.id,
                    tipo="salida",
                    cantidad=descontado,
                    unidad_medida=materia.unidad_medida,
                    costo_unitario=materia.costo_unitario,
                    referencia=pedido.folio,
                    motivo=f"Consumo por producción de {item.descripcion}",
                    usuario_id=usuario.id,
                )
            )


# ---------------------------------------------------------------------------
# Solicitudes de cotización (bandeja interna)
# ---------------------------------------------------------------------------


@admin_bp.get("/solicitudes")
@token_required
def listar_solicitudes():
    query = SolicitudCotizacion.query

    estado = request.args.get("estado")
    if estado:
        estados = [e.strip() for e in estado.split(",") if e.strip()]
        query = query.filter(SolicitudCotizacion.estado.in_(estados))

    busqueda = (request.args.get("q") or "").strip()
    if busqueda:
        patron = f"%{busqueda}%"
        query = query.filter(
            or_(
                SolicitudCotizacion.folio.ilike(patron),
                SolicitudCotizacion.nombre_cliente.ilike(patron),
                SolicitudCotizacion.correo.ilike(patron),
                SolicitudCotizacion.empresa.ilike(patron),
            )
        )

    query = query.order_by(SolicitudCotizacion.creado_en.desc())
    pagina = paginar(
        query,
        parse_int(request.args.get("page"), 1) or 1,
        parse_int(request.args.get("perPage"), 20) or 20,
        lambda s: s.to_dict(incluir_detalle=False),
    )
    return jsonify(pagina)


@admin_bp.get("/solicitudes/resumen")
@token_required
def resumen_solicitudes():
    conteos = dict(
        db.session.query(SolicitudCotizacion.estado, func.count(SolicitudCotizacion.id))
        .group_by(SolicitudCotizacion.estado)
        .all()
    )
    estados = {estado: conteos.get(estado, 0) for estado in ESTADOS_SOLICITUD}
    return jsonify(
        {
            "total": sum(estados.values()),
            "porEstado": estados,
            "nuevas": estados.get("nueva", 0),
            "enRevision": estados.get("en-revision", 0),
        }
    )


@admin_bp.get("/solicitudes/<int:solicitud_id>")
@token_required
def detalle_solicitud(solicitud_id: int):
    solicitud = SolicitudCotizacion.query.get(solicitud_id)
    if not solicitud:
        return no_encontrado("Solicitud")
    return jsonify(solicitud.to_dict())


@admin_bp.patch("/solicitudes/<int:solicitud_id>/estado")
@token_required
def cambiar_estado_solicitud(solicitud_id: int):
    solicitud = SolicitudCotizacion.query.get(solicitud_id)
    if not solicitud:
        return no_encontrado("Solicitud")

    data = payload()
    estado = str(campo(data, "estado", default="")).strip()
    if estado not in ESTADOS_SOLICITUD:
        return error(f"Estado inválido. Usa: {', '.join(sorted(ESTADOS_SOLICITUD))}")

    solicitud.estado = estado
    solicitud.atendido_por = g.usuario.id
    db.session.commit()
    return jsonify(solicitud.to_dict(incluir_detalle=False))


@admin_bp.delete("/solicitudes/<int:solicitud_id>")
@role_required("admin")
def eliminar_solicitud(solicitud_id: int):
    solicitud = SolicitudCotizacion.query.get(solicitud_id)
    if not solicitud:
        return no_encontrado("Solicitud")
    db.session.delete(solicitud)
    db.session.commit()
    return jsonify({"mensaje": "Solicitud eliminada"})


@admin_bp.post("/solicitudes/<int:solicitud_id>/convertir-cotizacion")
@role_required("admin", "ventas")
def convertir_solicitud(solicitud_id: int):
    solicitud = SolicitudCotizacion.query.get(solicitud_id)
    if not solicitud:
        return no_encontrado("Solicitud")

    existente = solicitud.cotizaciones[0] if solicitud.cotizaciones else None
    if existente:
        return (
            jsonify(
                {
                    "error": "La solicitud ya fue cotizada",
                    "cotizacion": existente.to_dict(),
                }
            ),
            409,
        )

    try:
        cotizacion = _crear_cotizacion(solicitud, payload(), g.usuario)
        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        return error(str(exc))

    return jsonify(cotizacion.to_dict()), 201


# ---------------------------------------------------------------------------
# Cotizaciones
# ---------------------------------------------------------------------------


@admin_bp.get("/cotizaciones")
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


@admin_bp.get("/cotizaciones/<int:cotizacion_id>")
@token_required
def detalle_cotizacion(cotizacion_id: int):
    cotizacion = Cotizacion.query.get(cotizacion_id)
    if not cotizacion:
        return no_encontrado("Cotización")
    return jsonify(cotizacion.to_dict())


@admin_bp.post("/cotizaciones")
@role_required("admin", "ventas")
def crear_cotizacion():
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
        cotizacion = _crear_cotizacion(solicitud, data, g.usuario)
        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        return error(str(exc))
    return jsonify(cotizacion.to_dict()), 201


@admin_bp.patch("/cotizaciones/<int:cotizacion_id>/estado")
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


@admin_bp.post("/cotizaciones/<int:cotizacion_id>/convertir-pedido")
@role_required("admin", "ventas")
def convertir_cotizacion(cotizacion_id: int):
    cotizacion = Cotizacion.query.get(cotizacion_id)
    if not cotizacion:
        return no_encontrado("Cotización")
    if cotizacion.pedidos:
        return (
            jsonify({"error": "La cotización ya tiene un pedido", "pedido": cotizacion.pedidos[0].to_dict()}),
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
    _descontar_inventario(pedido, g.usuario)
    db.session.commit()
    return jsonify(pedido.to_dict()), 201


# ---------------------------------------------------------------------------
# Pedidos
# ---------------------------------------------------------------------------


@admin_bp.get("/pedidos")
@token_required
def listar_pedidos():
    query = Pedido.query
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


@admin_bp.get("/pedidos/<int:pedido_id>")
@token_required
def detalle_pedido(pedido_id: int):
    pedido = Pedido.query.get(pedido_id)
    if not pedido:
        return no_encontrado("Pedido")
    return jsonify(pedido.to_dict())


@admin_bp.get("/consultas/pedidos")
@token_required
def consultar_pedidos():
    """Búsqueda avanzada de pedidos con filtros y agregados del periodo."""
    query = Pedido.query.join(Cliente)
    busqueda = (request.args.get("q") or "").strip()
    if busqueda:
        patron = f"%{busqueda}%"
        query = query.outerjoin(PedidoItem).filter(
            or_(
                Pedido.folio.ilike(patron),
                Cliente.nombre.ilike(patron),
                Cliente.empresa.ilike(patron),
                PedidoItem.descripcion.ilike(patron),
            )
        ).distinct()

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
    entregados = Pedido.query.filter(
        Pedido.id.in_(ids), Pedido.estado == "entregado"
    ).count()
    total_monto = float(resumen[1] or 0)
    total_pedidos = int(resumen[0] or 0)

    lineas = (
        db.session.query(
            Producto.linea_produccion,
            func.coalesce(func.sum(PedidoItem.importe), 0),
        )
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


@admin_bp.post("/pedidos")
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

    items, subtotal = _items_a_cotizacion(items_brutos, data)
    totales = _totales(subtotal)
    pedido = Pedido(
        folio=generar_folio("LLM", Pedido, con_anio=False, relleno=4, inicio=1040),
        cliente_id=cliente.id,
        estado=str(campo(data, "estado", default="confirmado")),
        prioridad=str(campo(data, "prioridad", default="media")),
        fecha_entrega=parse_fecha(campo(data, "fechaEntrega")),
        notas=str(campo(data, "notas", default="") or "") or None,
        creado_por=g.usuario.id,
        **totales,
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

    orden = OrdenProduccion(etapa="diseno", estado="pendiente", pedido=pedido)
    orden.etapas.append(ProduccionEtapa(etapa="diseno", estado="en-proceso", inicio=utcnow()))

    db.session.add(pedido)
    db.session.flush()
    _descontar_inventario(pedido, g.usuario)

    db.session.commit()
    return jsonify(pedido.to_dict()), 201


@admin_bp.patch("/pedidos/<int:pedido_id>/estado")
@token_required
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


@admin_bp.post("/pedidos/<int:pedido_id>/pagos")
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
    if monto <= 0:
        return error("El monto del pago debe ser mayor a cero")

    pagado = sum(float(p.monto or 0) for p in pedido.pagos if p.confirmado)
    if monto > round(float(pedido.total or 0) - pagado, 2) + 0.01:
        return error("El pago excede el saldo pendiente del pedido")

    pago = Pago(
        pedido_id=pedido.id,
        tipo=tipo,
        metodo=str(campo(data, "metodo", default="transferencia"))[:30],
        monto=round(monto, 2),
        referencia=str(campo(data, "referencia", default="") or "")[:120] or None,
        confirmado=bool(campo(data, "confirmado", default=True)),
        registrado_por=g.usuario.id,
    )
    db.session.add(pago)
    db.session.flush()

    pagado = sum(float(p.monto or 0) for p in pedido.pagos if p.confirmado)
    pedido.saldo = round(max(float(pedido.total or 0) - pagado, 0), 2)
    if pedido.saldo <= 0 and pedido.estado == "confirmado":
        pedido.estado = "en-produccion"

    db.session.commit()
    return jsonify({"pago": pago.to_dict(), "pedido": pedido.to_dict()}), 201



# ---------------------------------------------------------------------------
# Clientes
# ---------------------------------------------------------------------------


@admin_bp.get("/clientes")
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


@admin_bp.get("/clientes/<int:cliente_id>")
@token_required
def detalle_cliente(cliente_id: int):
    cliente = Cliente.query.get(cliente_id)
    if not cliente:
        return no_encontrado("Cliente")
    return jsonify(cliente.to_dict(incluir_metricas=True))


@admin_bp.post("/clientes")
@role_required("admin", "ventas")
def crear_cliente():
    data = payload()
    correo = str(campo(data, "correo", "email", default="")).strip().lower()
    nombre = str(campo(data, "nombre", "nombreCliente", default="")).strip()
    if not nombre or not correo_valido(correo):
        return error("Nombre y correo válido son obligatorios")
    if _cliente_por_correo(correo):
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


@admin_bp.put("/clientes/<int:cliente_id>")
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


@admin_bp.delete("/clientes/<int:cliente_id>")
@role_required("admin")
def desactivar_cliente(cliente_id: int):
    cliente = Cliente.query.get(cliente_id)
    if not cliente:
        return no_encontrado("Cliente")
    cliente.activo = False
    db.session.commit()
    return jsonify({"mensaje": "Cliente desactivado", "id": cliente.id})


# ---------------------------------------------------------------------------
# Productos y recetas
# ---------------------------------------------------------------------------


@admin_bp.get("/productos")
@token_required
def listar_productos():
    query = Producto.query
    if request.args.get("linea"):
        query = query.filter(Producto.linea_produccion == request.args["linea"])
    busqueda = (request.args.get("q") or "").strip()
    if busqueda:
        query = query.filter(Producto.nombre.ilike(f"%{busqueda}%"))
    productos = query.order_by(Producto.nombre.asc()).all()
    return jsonify({"items": [p.to_dict() for p in productos], "total": len(productos)})


@admin_bp.get("/productos/<int:producto_id>")
@token_required
def detalle_producto(producto_id: int):
    producto = Producto.query.get(producto_id)
    if not producto:
        return no_encontrado("Producto")
    data = producto.to_dict()
    data["receta"] = producto.receta.to_dict() if producto.receta else None
    return jsonify(data)


@admin_bp.post("/productos")
@role_required("admin", "ventas")
def crear_producto():
    data = payload()
    nombre = str(campo(data, "nombre", default="")).strip()
    if not nombre:
        return error("El nombre del producto es obligatorio")
    if Producto.query.filter(func.lower(Producto.nombre) == nombre.lower()).first():
        return error("Ya existe un producto con ese nombre", 409, "nombre_duplicado")

    producto = Producto(
        nombre=nombre[:160],
        descripcion=str(campo(data, "descripcion", default="") or "") or None,
        categoria=str(campo(data, "categoria", default="otro"))[:40],
        linea_produccion=str(campo(data, "lineaProduccion", "linea_produccion", default="gran-formato"))[:40],
        precio_base=parse_decimal(campo(data, "precioBase", "precio_base"), 0),
        unidad_venta=str(campo(data, "unidadVenta", "unidad_venta", default="pieza"))[:20],
        icono=str(campo(data, "icono", default="bi-box-seam"))[:60],
        publicado=bool(campo(data, "publicado", default=True)),
        activo=bool(campo(data, "activo", default=True)),
    )
    _aplicar_receta(producto, campo(data, "receta"))
    db.session.add(producto)
    db.session.commit()
    return jsonify(producto.to_dict()), 201


@admin_bp.put("/productos/<int:producto_id>")
@role_required("admin", "ventas")
def actualizar_producto(producto_id: int):
    producto = Producto.query.get(producto_id)
    if not producto:
        return no_encontrado("Producto")
    data = payload()
    mapa = {
        "nombre": ("nombre",),
        "descripcion": ("descripcion",),
        "categoria": ("categoria",),
        "linea_produccion": ("lineaProduccion", "linea_produccion"),
        "unidad_venta": ("unidadVenta", "unidad_venta"),
        "icono": ("icono",),
    }
    for atributo, claves in mapa.items():
        valor = campo(data, *claves)
        if valor is not None:
            setattr(producto, atributo, str(valor))
    precio = campo(data, "precioBase", "precio_base")
    if precio is not None:
        producto.precio_base = parse_decimal(precio, 0)
    if "publicado" in data:
        producto.publicado = bool(data["publicado"])
    if "activo" in data:
        producto.activo = bool(data["activo"])
    if "receta" in data:
        _aplicar_receta(producto, data["receta"])
    db.session.commit()
    return jsonify(producto.to_dict())


@admin_bp.delete("/productos/<int:producto_id>")
@role_required("admin")
def desactivar_producto(producto_id: int):
    producto = Producto.query.get(producto_id)
    if not producto:
        return no_encontrado("Producto")
    producto.activo = False
    producto.publicado = False
    db.session.commit()
    return jsonify({"mensaje": "Producto desactivado", "id": producto.id})


def _aplicar_receta(producto: Producto, receta_data) -> None:
    if not isinstance(receta_data, dict):
        return
    receta = producto.receta or Receta(producto=producto, nombre=f"Receta {producto.nombre}")
    receta.rendimiento = parse_decimal(receta_data.get("rendimiento"), 1) or 1
    receta.unidad_rendimiento = str(receta_data.get("unidadRendimiento", "pieza"))[:20]
    receta.costo_estimado = parse_decimal(receta_data.get("costoEstimado"), 0)
    receta.tiempo_produccion_min = parse_int(receta_data.get("tiempoProduccionMin"), 0) or 0
    receta.componentes.clear()

    for bruto in receta_data.get("componentes", []) or []:
        materia_id = parse_int(bruto.get("materiaPrimaId"))
        materia = MateriaPrima.query.get(materia_id) if materia_id else None
        if not materia:
            continue
        receta.componentes.append(
            RecetaComponente(
                materia_prima_id=materia.id,
                cantidad=parse_decimal(bruto.get("cantidad"), 0),
                unidad_medida=str(bruto.get("unidadMedida", materia.unidad_medida))[:20],
                desperdicio_porcentaje=parse_decimal(bruto.get("desperdicioPorcentaje"), 0),
            )
        )
    producto.receta = receta


# ---------------------------------------------------------------------------
# Materias primas, proveedores, compras e inventario
# ---------------------------------------------------------------------------


@admin_bp.get("/materias-primas")
@token_required
def listar_materias():
    query = MateriaPrima.query.filter_by(activo=True)
    if request.args.get("categoria"):
        query = query.filter(MateriaPrima.categoria == request.args["categoria"])
    if request.args.get("bajoStock") in {"1", "true"}:
        query = query.filter(MateriaPrima.stock_actual <= MateriaPrima.stock_minimo)
    materias = query.order_by(MateriaPrima.nombre.asc()).all()
    return jsonify({"items": [m.to_dict() for m in materias], "total": len(materias)})


@admin_bp.post("/materias-primas")
@role_required("admin", "inventario")
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


@admin_bp.put("/materias-primas/<int:materia_id>")
@role_required("admin", "inventario")
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


@admin_bp.delete("/materias-primas/<int:materia_id>")
@role_required("admin", "inventario")
def desactivar_materia(materia_id: int):
    materia = MateriaPrima.query.get(materia_id)
    if not materia:
        return no_encontrado("Materia prima")
    materia.activo = False
    db.session.commit()
    return jsonify({"mensaje": "Insumo desactivado", "id": materia.id})


@admin_bp.post("/materias-primas/<int:materia_id>/ajuste")
@role_required("admin", "inventario")
def ajustar_inventario(materia_id: int):
    materia = MateriaPrima.query.get(materia_id)
    if not materia:
        return no_encontrado("Materia prima")

    data = payload()
    tipo = str(campo(data, "tipo", default="ajuste"))
    cantidad = parse_decimal(campo(data, "cantidad"), 0)
    if tipo not in {"entrada", "salida", "ajuste", "merma", "devolucion"}:
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


@admin_bp.get("/movimientos")
@token_required
def listar_movimientos():
    query = MovimientoInventario.query
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


@admin_bp.get("/proveedores")
@token_required
def listar_proveedores():
    proveedores = Proveedor.query.order_by(Proveedor.nombre.asc()).all()
    return jsonify({"items": [p.to_dict() for p in proveedores], "total": len(proveedores)})


@admin_bp.post("/proveedores")
@role_required("admin", "inventario")
def crear_proveedor():
    data = payload()
    nombre = str(campo(data, "nombre", default="")).strip()
    if not nombre:
        return error("El nombre es obligatorio")
    proveedor = Proveedor(
        nombre=nombre[:160],
        contacto=str(campo(data, "contacto", default="") or "")[:120] or None,
        telefono=str(campo(data, "telefono", default="") or "")[:30] or None,
        correo=str(campo(data, "correo", default="") or "")[:160] or None,
        condiciones_pago=str(campo(data, "condicionesPago", default="") or "")[:120] or None,
    )
    db.session.add(proveedor)
    db.session.commit()
    return jsonify(proveedor.to_dict()), 201


@admin_bp.get("/ordenes-compra")
@token_required
def listar_ordenes_compra():
    query = OrdenCompra.query.order_by(OrdenCompra.creado_en.desc())
    return jsonify(
        paginar(
            query,
            parse_int(request.args.get("page"), 1) or 1,
            parse_int(request.args.get("perPage"), 20) or 20,
            lambda o: o.to_dict(),
        )
    )


@admin_bp.post("/ordenes-compra")
@role_required("admin", "inventario")
def crear_orden_compra():
    data = payload()
    proveedor_id = parse_int(campo(data, "proveedorId", "proveedor_id"))
    proveedor = Proveedor.query.get(proveedor_id) if proveedor_id else None
    if not proveedor:
        return error("Indica un proveedorId válido")

    orden = OrdenCompra(
        folio=generar_folio("OC", OrdenCompra),
        proveedor_id=proveedor.id,
        estado=str(campo(data, "estado", default="pendiente")),
        fecha_entrega=parse_fecha(campo(data, "fechaEntrega")),
        notas=str(campo(data, "notas", default="") or "") or None,
        creado_por=g.usuario.id,
    )

    subtotal = 0.0
    for bruto in lista_items(data):
        materia = MateriaPrima.query.get(parse_int(bruto.get("materiaPrimaId")))
        if not materia:
            continue
        cantidad = parse_decimal(bruto.get("cantidad"), 0)
        precio = parse_decimal(bruto.get("precioUnitario"), float(materia.costo_unitario or 0))
        importe = round(cantidad * precio, 2)
        subtotal += importe
        orden.items.append(
            OrdenCompraItem(
                materia_prima_id=materia.id,
                cantidad=cantidad,
                unidad_medida=materia.unidad_medida,
                precio_unitario=precio,
                importe=importe,
            )
        )

    totales = _totales(subtotal)
    orden.subtotal = totales["subtotal"]
    orden.impuestos = totales["impuestos"]
    orden.total = totales["total"]
    db.session.add(orden)
    db.session.commit()
    return jsonify(orden.to_dict()), 201


@admin_bp.patch("/ordenes-compra/<int:orden_id>/estado")
@role_required("admin", "inventario")
def cambiar_estado_orden_compra(orden_id: int):
    orden = OrdenCompra.query.get(orden_id)
    if not orden:
        return no_encontrado("Orden de compra")
    estado = str(campo(payload(), "estado", default="")).strip()
    if estado not in ESTADOS_COMPRA:
        return error(f"Estado inválido. Usa: {', '.join(sorted(ESTADOS_COMPRA))}")

    if estado == "recibida" and orden.estado != "recibida":
        for item in orden.items:
            if item.materia_prima:
                item.materia_prima.stock_actual = float(item.materia_prima.stock_actual or 0) + float(item.cantidad)
                db.session.add(
                    MovimientoInventario(
                        materia_prima_id=item.materia_prima_id,
                        tipo="entrada",
                        cantidad=item.cantidad,
                        unidad_medida=item.unidad_medida,
                        costo_unitario=item.precio_unitario,
                        referencia=orden.folio,
                        motivo="Recepción de orden de compra",
                        usuario_id=g.usuario.id,
                    )
                )
    orden.estado = estado
    db.session.commit()
    return jsonify(orden.to_dict())


# ---------------------------------------------------------------------------
# Producción
# ---------------------------------------------------------------------------


@admin_bp.get("/produccion/tablero")
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


@admin_bp.patch("/produccion/ordenes/<int:orden_id>")
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


@admin_bp.post("/produccion/ordenes/<int:orden_id>/calidad")
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


# ---------------------------------------------------------------------------
# Marketing
# ---------------------------------------------------------------------------


@admin_bp.get("/marketing/actividades")
@token_required
def listar_actividades():
    actividades = ActividadMarketing.query.order_by(ActividadMarketing.fecha_inicio.desc()).all()
    return jsonify(
        {"items": [a.to_dict() for a in actividades], "total": len(actividades)}
    )


@admin_bp.post("/marketing/actividades")
@role_required("admin", "marketing")
def crear_actividad():
    data = payload()
    nombre = str(campo(data, "nombre", default="")).strip()
    if not nombre:
        return error("El nombre de la campaña es obligatorio")
    canal = str(campo(data, "canal", default="redes-sociales"))
    if canal not in CANALES:
        return error("Canal inválido")

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


@admin_bp.put("/marketing/actividades/<int:actividad_id>")
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


# ---------------------------------------------------------------------------
# Dashboard, usuarios y archivos
# ---------------------------------------------------------------------------


@admin_bp.get("/dashboard/resumen")
@token_required
def resumen_dashboard():
    hoy = date.today()
    inicio_mes = hoy.replace(day=1)
    inicio_mes_anterior = (inicio_mes - timedelta(days=1)).replace(day=1)

    pedidos_mes = Pedido.query.filter(Pedido.fecha_pedido >= inicio_mes).all()
    ventas = sum(float(p.total or 0) for p in pedidos_mes if p.estado != "cancelado")
    ticket = ventas / len(pedidos_mes) if pedidos_mes else 0

    pedidos_anterior = Pedido.query.filter(
        Pedido.fecha_pedido >= inicio_mes_anterior,
        Pedido.fecha_pedido < inicio_mes,
        Pedido.estado != "cancelado",
    ).all()
    ventas_anterior = sum(float(p.total or 0) for p in pedidos_anterior)
    variacion = (
        round((ventas - ventas_anterior) / ventas_anterior * 100, 1) if ventas_anterior else 0
    )

    bajo_stock = (
        MateriaPrima.query.filter(
            MateriaPrima.activo.is_(True),
            MateriaPrima.stock_actual <= MateriaPrima.stock_minimo,
        )
        .order_by(MateriaPrima.stock_actual.asc())
        .limit(6)
        .all()
    )

    recientes = Pedido.query.order_by(Pedido.creado_en.desc()).limit(6).all()

    produccion = dict(
        db.session.query(OrdenProduccion.etapa, func.count(OrdenProduccion.id))
        .filter(OrdenProduccion.estado.in_(["pendiente", "en-proceso", "pausada"]))
        .group_by(OrdenProduccion.etapa)
        .all()
    )

    desde = hoy - timedelta(days=182)
    ventas_linea = db.session.query(
        Producto.linea_produccion,
        func.coalesce(func.sum(PedidoItem.importe), 0),
    ).join(
        PedidoItem, PedidoItem.producto_id == Producto.id
    ).join(
        Pedido, Pedido.id == PedidoItem.pedido_id
    ).filter(
        Pedido.fecha_pedido >= desde,
        Pedido.estado != "cancelado",
    ).group_by(Producto.linea_produccion).all()

    return jsonify(
        {
            "ventasPeriodo": round(ventas, 2),
            "pedidosPeriodo": len(pedidos_mes),
            "ticketPromedio": round(ticket, 2),
            "ordenesEnProduccion": OrdenProduccion.query.filter(
                OrdenProduccion.estado.in_(["pendiente", "en-proceso", "pausada"])
            ).count(),
            "materiasPrimasBajoStock": len(bajo_stock),
            "clientesActivos": Cliente.query.filter_by(activo=True).count(),
            "solicitudesNuevas": SolicitudCotizacion.query.filter_by(estado="nueva").count(),
            "solicitudesEnRevision": SolicitudCotizacion.query.filter_by(
                estado="en-revision"
            ).count(),
            "ventasMesAnterior": round(ventas_anterior, 2),
            "variacionVentas": variacion,
            "pedidosRecientes": [p.to_dict(incluir_detalle=False) for p in recientes],
            "bajoStock": [m.to_dict() for m in bajo_stock],
            "produccionPorEtapa": [
                {"etapa": etapa, "total": total} for etapa, total in produccion.items()
            ],
            "ventasPorLinea": [
                {"linea": linea, "total": float(total or 0)} for linea, total in ventas_linea
            ],
        }
    )


@admin_bp.get("/usuarios")
@role_required("admin")
def listar_usuarios():
    usuarios = Usuario.query.order_by(Usuario.nombre.asc()).all()
    return jsonify({"items": [u.to_dict() for u in usuarios], "total": len(usuarios)})


@admin_bp.post("/usuarios")
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
        return error("Ya existe un usuario con ese correo", 409, "correo_duplicado")

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


@admin_bp.get("/roles")
@role_required("admin")
def listar_roles():
    roles = Rol.query.order_by(Rol.id.asc()).all()
    return jsonify({"items": [r.to_dict() for r in roles], "total": len(roles)})


@admin_bp.get("/permisos")
@role_required("admin")
def listar_permisos():
    permisos = Permiso.query.order_by(Permiso.modulo.asc(), Permiso.clave.asc()).all()
    return jsonify({"items": [p.to_dict() for p in permisos], "total": len(permisos)})


@admin_bp.get("/archivos/<int:archivo_id>")
@token_required
def descargar_archivo(archivo_id: int):
    from models import SolicitudArchivo

    archivo = SolicitudArchivo.query.get(archivo_id)
    if not archivo:
        return no_encontrado("Archivo")

    carpeta = current_app.config["UPLOAD_FOLDER"]
    ruta = os.path.join(carpeta, archivo.nombre_guardado)
    if not os.path.exists(ruta):
        return no_encontrado("Archivo en disco")

    return send_from_directory(
        carpeta,
        archivo.nombre_guardado,
        as_attachment=True,
        download_name=archivo.nombre_original,
    )

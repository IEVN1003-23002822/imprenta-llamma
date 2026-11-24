"""Resumen del tablero principal del ERP."""

from __future__ import annotations

from datetime import date, timedelta

from flask import Blueprint, jsonify
from sqlalchemy import case, func
from sqlalchemy.orm import joinedload

from auth import token_required
from extensions import db
from models import (
    Cliente,
    MateriaPrima,
    OrdenProduccion,
    Pedido,
    PedidoItem,
    Producto,
    SolicitudCotizacion,
)

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/dashboard/resumen")
@token_required
def resumen_dashboard():
    hoy = date.today()
    inicio_mes = hoy.replace(day=1)
    inicio_mes_anterior = (inicio_mes - timedelta(days=1)).replace(day=1)

    total_mes, ventas_mes = db.session.query(
        func.count(Pedido.id),
        func.coalesce(
            func.sum(case((Pedido.estado != "cancelado", Pedido.total), else_=0)), 0
        ),
    ).filter(Pedido.fecha_pedido >= inicio_mes).one()
    pedidos_count = int(total_mes or 0)
    ventas = float(ventas_mes or 0)
    ticket = ventas / pedidos_count if pedidos_count else 0

    ventas_anterior = float(
        db.session.query(func.coalesce(func.sum(Pedido.total), 0))
        .filter(
            Pedido.fecha_pedido >= inicio_mes_anterior,
            Pedido.fecha_pedido < inicio_mes,
            Pedido.estado != "cancelado",
        )
        .scalar()
        or 0
    )
    variacion = (
        round((ventas - ventas_anterior) / ventas_anterior * 100, 1) if ventas_anterior else 0
    )

    bajo_stock = (
        MateriaPrima.query.options(joinedload(MateriaPrima.proveedor))
        .filter(
            MateriaPrima.activo.is_(True),
            MateriaPrima.stock_actual <= MateriaPrima.stock_minimo,
        )
        .order_by(MateriaPrima.stock_actual.asc())
        .limit(6)
        .all()
    )

    recientes = (
        Pedido.query.options(joinedload(Pedido.cliente))
        .order_by(Pedido.creado_en.desc())
        .limit(6)
        .all()
    )

    produccion = dict(
        db.session.query(OrdenProduccion.etapa, func.count(OrdenProduccion.id))
        .filter(OrdenProduccion.estado.in_(["pendiente", "en-proceso", "pausada"]))
        .group_by(OrdenProduccion.etapa)
        .order_by(
            func.count(OrdenProduccion.id).desc(),
            func.min(OrdenProduccion.id).asc(),
        )
        .all()
    )

    desde = hoy - timedelta(days=182)
    ventas_linea = (
        db.session.query(
            Producto.linea_produccion,
            func.coalesce(func.sum(PedidoItem.importe), 0),
        )
        .join(PedidoItem, PedidoItem.producto_id == Producto.id)
        .join(Pedido, Pedido.id == PedidoItem.pedido_id)
        .filter(
            Pedido.fecha_pedido >= desde,
            Pedido.estado != "cancelado",
        )
        .group_by(Producto.linea_produccion)
        .order_by(
            func.coalesce(func.sum(PedidoItem.importe), 0).desc(),
            Producto.linea_produccion.asc(),
        )
        .all()
    )

    return jsonify(
        {
            "ventasPeriodo": round(ventas, 2),
            "pedidosPeriodo": pedidos_count,
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

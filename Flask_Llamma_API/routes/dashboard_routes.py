"""Resumen del tablero principal del ERP."""

from __future__ import annotations

from datetime import date, timedelta

from flask import Blueprint, jsonify
from sqlalchemy import func

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
        .all()
    )

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

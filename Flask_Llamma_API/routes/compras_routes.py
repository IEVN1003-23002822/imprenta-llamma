"""Proveedores y órdenes de compra, incluida la recepción en bodega."""

from __future__ import annotations

from flask import Blueprint, g, jsonify, request
from sqlalchemy.orm import joinedload, selectinload

from auth import role_required
from estados import ESTADOS_COMPRA
from extensions import db
from models import MateriaPrima, MovimientoInventario, OrdenCompra, OrdenCompraItem, Proveedor
from routes.comun import totales
from routes.helpers import campo, error, lista_items, no_encontrado, payload
from utils import generar_folio, paginar, parse_decimal, parse_fecha, parse_int

compras_bp = Blueprint("compras", __name__)


@compras_bp.get("/proveedores")
@role_required("admin", "ventas", "inventario", "produccion")
def listar_proveedores():
    proveedores = Proveedor.query.order_by(Proveedor.nombre.asc()).all()
    return jsonify({"items": [p.to_dict() for p in proveedores], "total": len(proveedores)})


@compras_bp.post("/proveedores")
@role_required("admin", "inventario", "produccion")
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


@compras_bp.get("/ordenes-compra")
@role_required("admin", "ventas", "inventario", "produccion")
def listar_ordenes_compra():
    query = (
        OrdenCompra.query.options(
            joinedload(OrdenCompra.proveedor),
            selectinload(OrdenCompra.items).joinedload(OrdenCompraItem.materia_prima),
        )
        .order_by(OrdenCompra.creado_en.desc())
    )
    return jsonify(
        paginar(
            query,
            parse_int(request.args.get("page"), 1) or 1,
            parse_int(request.args.get("perPage"), 20) or 20,
            lambda o: o.to_dict(),
        )
    )


@compras_bp.post("/ordenes-compra")
@role_required("admin", "inventario", "produccion")
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

    calculados = totales(subtotal)
    orden.subtotal = calculados["subtotal"]
    orden.impuestos = calculados["impuestos"]
    orden.total = calculados["total"]
    db.session.add(orden)
    db.session.commit()
    return jsonify(orden.to_dict()), 201


@compras_bp.patch("/ordenes-compra/<int:orden_id>/estado")
@role_required("admin", "inventario", "produccion")
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
                item.materia_prima.stock_actual = float(
                    item.materia_prima.stock_actual or 0
                ) + float(item.cantidad)
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

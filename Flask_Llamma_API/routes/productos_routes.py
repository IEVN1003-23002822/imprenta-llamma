"""Catálogo interno de productos y sus recetas de producción."""

from __future__ import annotations

from flask import Blueprint, jsonify, request
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from auth import role_required, token_required
from extensions import db
from models import MateriaPrima, Producto, Receta, RecetaComponente
from routes.helpers import campo, error, no_encontrado, payload
from utils import parse_decimal, parse_int

productos_bp = Blueprint("productos", __name__)


@productos_bp.get("/productos")
@token_required
def listar_productos():
    query = Producto.query.options(joinedload(Producto.receta))
    if request.args.get("linea"):
        query = query.filter(Producto.linea_produccion == request.args["linea"])
    busqueda = (request.args.get("q") or "").strip()
    if busqueda:
        query = query.filter(Producto.nombre.ilike(f"%{busqueda}%"))
    productos = query.order_by(Producto.nombre.asc()).all()
    return jsonify({"items": [p.to_dict() for p in productos], "total": len(productos)})


@productos_bp.get("/productos/<int:producto_id>")
@token_required
def detalle_producto(producto_id: int):
    producto = (
        Producto.query.options(
            joinedload(Producto.receta)
            .selectinload(Receta.componentes)
            .joinedload(RecetaComponente.materia_prima)
        )
        .filter_by(id=producto_id)
        .first()
    )
    if not producto:
        return no_encontrado("Producto")
    data = producto.to_dict()
    data["receta"] = producto.receta.to_dict() if producto.receta else None
    return jsonify(data)


@productos_bp.post("/productos")
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
        linea_produccion=str(
            campo(data, "lineaProduccion", "linea_produccion", default="gran-formato")
        )[:40],
        precio_base=parse_decimal(campo(data, "precioBase", "precio_base"), 0),
        unidad_venta=str(campo(data, "unidadVenta", "unidad_venta", default="pieza"))[:20],
        icono=str(campo(data, "icono", default="bi-box-seam"))[:60],
        imagen_url=str(campo(data, "imagenUrl", "imagen_url", default="") or "")[:300] or None,
        publicado=bool(campo(data, "publicado", default=True)),
        activo=bool(campo(data, "activo", default=True)),
    )
    _aplicar_receta(producto, campo(data, "receta"))
    db.session.add(producto)
    db.session.commit()
    return jsonify(producto.to_dict()), 201


@productos_bp.put("/productos/<int:producto_id>")
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
    if "imagenUrl" in data or "imagen_url" in data:
        # La foto se puede limpiar desde el formulario: null o "" la eliminan.
        valor = campo(data, "imagenUrl", "imagen_url")
        producto.imagen_url = (str(valor).strip()[:300] or None) if valor else None
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


@productos_bp.delete("/productos/<int:producto_id>")
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
    """Reemplaza la receta del producto con la enviada en el formulario."""
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

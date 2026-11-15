"""Endpoints públicos: catálogo y solicitudes de cotización."""

from __future__ import annotations

from datetime import datetime

from flask import Blueprint, jsonify, request

from extensions import db
from models import (
    Cliente,
    Producto,
    SolicitudArchivo,
    SolicitudCotizacion,
    SolicitudItem,
    utcnow,
)
from routes.helpers import campo, correo_valido, error, lista_items, no_encontrado, payload
from utils import generar_folio, guardar_archivo, parse_decimal, parse_fecha

public_bp = Blueprint("public", __name__)


@public_bp.get("/health")
def health():
    return jsonify(
        {
            "ok": True,
            "servicio": "Llamma API",
            "version": "1.0.0",
            "fecha": utcnow().isoformat(timespec="seconds"),
        }
    )


@public_bp.get("/public/productos")
def catalogo_publico():
    query = Producto.query.filter_by(activo=True, publicado=True)

    linea = request.args.get("linea")
    categoria = request.args.get("categoria")
    busqueda = (request.args.get("q") or "").strip()

    if linea:
        query = query.filter(Producto.linea_produccion == linea)
    if categoria:
        query = query.filter(Producto.categoria == categoria)
    if busqueda:
        patron = f"%{busqueda}%"
        query = query.filter(
            db.or_(Producto.nombre.ilike(patron), Producto.descripcion.ilike(patron))
        )

    productos = query.order_by(Producto.nombre.asc()).all()
    return jsonify({"items": [p.to_dict(publico=True) for p in productos], "total": len(productos)})


@public_bp.get("/public/productos/<int:producto_id>")
def producto_publico(producto_id: int):
    producto = Producto.query.filter_by(id=producto_id, activo=True, publicado=True).first()
    if not producto:
        return no_encontrado("Producto")
    return jsonify(producto.to_dict(publico=True))


@public_bp.get("/public/opciones")
def opciones_publicas():
    return jsonify(
        {
            "segmentos": [
                "particular",
                "pyme",
                "corporativo",
                "eventos",
                "escolar",
                "gobierno",
            ],
            "metodosEntrega": [
                {"clave": "taller", "nombre": "Recoger en taller"},
                {"clave": "domicilio", "nombre": "Envío a domicilio"},
                {"clave": "paqueteria", "nombre": "Paquetería nacional"},
                {"clave": "instalacion", "nombre": "Instalación en sitio"},
            ],
            "lineas": ["gran-formato", "textil", "promocionales", "papeleria"],
            "estadosSolicitud": ["nueva", "en-revision", "cotizada", "convertida", "descartada"],
        }
    )


@public_bp.post("/public/solicitudes")
def crear_solicitud():
    data = payload()

    nombre = str(campo(data, "nombreCliente", "nombre_cliente", "nombre", default="")).strip()
    correo = str(campo(data, "correo", "email", default="")).strip().lower()
    telefono = str(campo(data, "telefono", "whatsapp", default="")).strip()
    empresa = str(campo(data, "empresa", "marca", default="")).strip()
    segmento = str(campo(data, "segmento", "tipoCliente", default="particular")).strip()
    mensaje = str(campo(data, "mensaje", "descripcion", default="")).strip()
    metodo = str(campo(data, "metodoEntrega", "metodo_entrega", default="taller")).strip()
    fecha_deseada = parse_fecha(campo(data, "fechaDeseada", "fecha_deseada"))

    if not nombre:
        return error("El nombre del contacto es obligatorio")
    if not correo_valido(correo):
        return error("El correo electrónico no es válido")
    if not mensaje and not lista_items(data):
        return error("Cuéntanos qué necesitas: agrega productos o escribe tu proyecto")

    items_brutos = lista_items(data)

    solicitud = SolicitudCotizacion(
        folio=generar_folio("SOL", SolicitudCotizacion),
        nombre_cliente=nombre[:140],
        empresa=empresa[:140] or None,
        correo=correo[:160],
        telefono=telefono[:30] or None,
        segmento=segmento[:30],
        mensaje=mensaje or None,
        fecha_deseada=fecha_deseada,
        metodo_entrega=metodo[:40],
        estado="nueva",
        origen=str(campo(data, "origen", default="web"))[:40],
    )

    for bruto in items_brutos:
        if not isinstance(bruto, dict):
            continue
        producto = None
        producto_id = campo(bruto, "productoId", "producto_id")
        if producto_id:
            producto = Producto.query.filter_by(id=int(producto_id), activo=True).first()

        cantidad = max(parse_decimal(campo(bruto, "cantidad", default=1), 1), 0.01)
        nombre_producto = str(
            campo(bruto, "nombreProducto", "nombre_producto", "nombre", default="")
            or (producto.nombre if producto else "Producto")
        ).strip()

        if producto and producto.precio_base:
            estimado = round(float(producto.precio_base) * cantidad, 2)
        else:
            estimado = campo(bruto, "precioEstimado", "precio_estimado")
            estimado = parse_decimal(estimado, 0) if estimado is not None else None

        solicitud.items.append(
            SolicitudItem(
                producto_id=producto.id if producto else None,
                nombre_producto=nombre_producto[:160],
                especificaciones=str(
                    campo(bruto, "especificaciones", "detalle", default="") or ""
                )[:240]
                or None,
                cantidad=cantidad,
                precio_estimado=estimado,
            )
        )

    # Guarda adjuntos (multipart). En JSON solo se aceptan nombres referenciales.
    archivos = list(request.files.getlist("archivos")) + list(request.files.getlist("archivo"))
    for storage in archivos:
        guardado = guardar_archivo(storage)
        if not guardado:
            return error(
                "Formato de archivo no permitido. Usa PDF, AI, PSD, PNG, JPG, SVG o ZIP",
                415,
                "archivo_invalido",
            )
        original, nombre_guardado, tamano = guardado
        solicitud.archivos.append(
            SolicitudArchivo(
                nombre_original=original[:200],
                nombre_guardado=nombre_guardado,
                ruta_relativa=nombre_guardado,
                mime_type=storage.mimetype,
                tamano_bytes=tamano,
            )
        )

    # Vincula o crea el cliente para que ventas lo encuentre después.
    cliente = Cliente.query.filter(db.func.lower(Cliente.correo) == correo).first()
    if cliente:
        cliente.nombre = cliente.nombre or nombre
        cliente.telefono = cliente.telefono or telefono[:30] or None
        cliente.empresa = cliente.empresa or empresa[:140] or None
    else:
        cliente = Cliente(
            nombre=nombre[:140],
            empresa=empresa[:140] or None,
            correo=correo[:160],
            telefono=telefono[:30] or None,
            segmento=segmento[:30],
            activo=True,
        )
        db.session.add(cliente)

    db.session.add(solicitud)
    db.session.commit()

    return (
        jsonify(
            {
                "mensaje": "Solicitud recibida. Te contactaremos con tu cotización.",
                "folio": solicitud.folio,
                "solicitud": solicitud.to_dict(),
            }
        ),
        201,
    )


@public_bp.get("/public/solicitudes/<folio>")
def consultar_solicitud(folio: str):
    correo = (request.args.get("correo") or "").strip().lower()
    if not correo:
        return error("Indica el correo con el que registraste la solicitud", 400, "correo_requerido")

    solicitud = SolicitudCotizacion.query.filter_by(folio=folio.strip().upper()).first()
    if not solicitud or solicitud.correo.lower() != correo:
        return no_encontrado("Solicitud")

    cotizacion = solicitud.cotizaciones[0] if solicitud.cotizaciones else None
    return jsonify(
        {
            "folio": solicitud.folio,
            "estado": solicitud.estado,
            "fechaCreacion": solicitud.creado_en.isoformat(timespec="seconds"),
            "fechaDeseada": solicitud.fecha_deseada.isoformat() if solicitud.fecha_deseada else None,
            "nombreCliente": solicitud.nombre_cliente,
            "empresa": solicitud.empresa,
            "mensaje": solicitud.mensaje,
            "items": [item.to_dict() for item in solicitud.items],
            "archivos": [
                {"nombre": a.nombre_original, "tamanoBytes": a.tamano_bytes}
                for a in solicitud.archivos
            ],
            "cotizacion": (
                {
                    "folio": cotizacion.folio,
                    "estado": cotizacion.estado,
                    "total": float(cotizacion.total),
                }
                if cotizacion
                else None
            ),
            "actualizadoEn": solicitud.actualizado_en.isoformat(timespec="seconds"),
        }
    )

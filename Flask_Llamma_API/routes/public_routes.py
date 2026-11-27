"""Endpoints públicos: catálogo y solicitudes de cotización."""

from __future__ import annotations

import os
import base64
import json
import math
from datetime import date, datetime
from io import BytesIO
from PIL import Image, ImageOps, UnidentifiedImageError

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from sqlalchemy.orm import joinedload, selectinload

from extensions import db
from models import (
    Cliente,
    Cotizacion,
    MensajeChat,
    OrdenProduccion,
    Pedido,
    Producto,
    SolicitudArchivo,
    SolicitudCotizacion,
    SolicitudItem,
    utcnow,
)
from ratelimit import cliente_ip, demasiadas_peticiones, excedido
from precios import (
    es_lona_vinil,
    precio_base_lona_vinil,
    precio_linea_mayoreo,
)
from routes.helpers import (
    MAX_MENSAJE_CHAT,
    campo,
    correo_valido,
    error,
    lista_items,
    no_encontrado,
    payload,
)
from utils import (
    MENSAJE_FECHA_MINIMA,
    calcular_fecha_minima_entrega,
    generar_folio,
    guardar_archivo,
    parse_decimal,
    parse_fecha,
    parse_int,
)

public_bp = Blueprint("public", __name__)


def _solicitud_por_credenciales(folio: str, correo: str) -> SolicitudCotizacion | None:
    """Busca una solicitud solo si folio y correo coinciden."""
    solicitud = (
        SolicitudCotizacion.query.options(
            selectinload(SolicitudCotizacion.items),
            selectinload(SolicitudCotizacion.archivos),
            selectinload(SolicitudCotizacion.cotizaciones).options(
                selectinload(Cotizacion.pedidos).options(
                    joinedload(Pedido.confirmador_entrega),
                    selectinload(Pedido.orden_produccion).selectinload(
                        OrdenProduccion.etapas
                    ),
                )
            ),
            selectinload(SolicitudCotizacion.mensajes).joinedload(MensajeChat.usuario),
        )
        .filter_by(folio=folio.strip().upper())
        .first()
    )
    if not solicitud or solicitud.correo.lower() != correo.strip().lower():
        return None
    return solicitud


def _mockups_por_archivo(data: dict) -> dict[str, dict]:
    """Mapea el nombre original del archivo con los metadatos del mockup enviados.

    El formulario público envía `mockups` como JSON con la forma
    `[{"nombre": "diseno-x.jpg", "datos": {...}}]`. Si el campo no existe o es
    inválido se ignora y los adjuntos se guardan como archivos normales.
    """
    bruto = campo(data, "mockups", "mockupData", "mockup_data")
    if bruto is None:
        return {}
    if isinstance(bruto, str):
        try:
            bruto = json.loads(bruto)
        except json.JSONDecodeError:
            return {}
    if isinstance(bruto, dict):
        bruto = [{"nombre": nombre, "datos": datos} for nombre, datos in bruto.items()]
    if not isinstance(bruto, list):
        return {}

    mapa: dict[str, dict] = {}
    for entrada in bruto:
        if not isinstance(entrada, dict):
            continue
        nombre = str(entrada.get("nombre") or "").strip()
        datos = entrada.get("datos")
        if nombre and isinstance(datos, dict):
            mapa[nombre] = datos
    return mapa


def _limitar_consultas(folio: str):
    """Evita enumerar folios a fuerza de probar folio + correo."""
    espera = excedido(
        (
            "consulta-publica",
            f"{cliente_ip()}|{folio.strip().upper()[:20]}",
            current_app.config["PUBLICO_MAX_CONSULTAS"],
            current_app.config["PUBLICO_VENTANA_CONSULTAS_SEGUNDOS"],
        )
    )
    if espera is None:
        return None
    return demasiadas_peticiones(espera, "Demasiadas consultas. Espera un momento.")


def _iso(valor) -> str | None:
    return valor.isoformat(timespec="seconds") if valor else None


def _pedido_publico(pedido: Pedido, fecha_deseada) -> dict:
    """Resumen del pedido apto para el seguimiento del cliente."""
    orden = pedido.orden_produccion
    historial = []
    if orden:
        historial = [
            {
                "id": etapa.id,
                "etapa": etapa.etapa,
                "estado": etapa.estado,
                "inicio": _iso(etapa.inicio),
                "fin": _iso(etapa.fin),
                "creadoEn": _iso(etapa.creado_en),
            }
            for etapa in orden.etapas
        ]

    return {
        "folio": pedido.folio,
        "estado": pedido.estado,
        "fechaDeseada": fecha_deseada.isoformat() if fecha_deseada else None,
        "fechaEntrega": pedido.fecha_entrega.isoformat() if pedido.fecha_entrega else None,
        "notaEntrega": pedido.nota_entrega,
        "confirmadoEn": _iso(pedido.creado_en),
        "entregaConfirmadaEn": _iso(pedido.entrega_confirmada_en)
        or (_iso(pedido.creado_en) if pedido.fecha_entrega else None),
        "entregaConfirmadaPor": (
            pedido.confirmador_entrega.nombre if pedido.confirmador_entrega else None
        ),
        "actualizadoEn": _iso(pedido.actualizado_en),
        "etapaActual": orden.etapa if orden else None,
        "estadoProduccion": orden.estado if orden else None,
        "historialEtapas": historial,
    }


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
    espera = excedido(
        (
            "solicitud-publica",
            cliente_ip(),
            current_app.config["PUBLICO_MAX_SOLICITUDES"],
            current_app.config["PUBLICO_VENTANA_SEGUNDOS"],
        )
    )
    if espera is not None:
        return demasiadas_peticiones(
            espera, "Recibimos varias solicitudes desde tu conexión. Intenta más tarde."
        )

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
    if fecha_deseada and fecha_deseada < calcular_fecha_minima_entrega(date.today()):
        return error(MENSAJE_FECHA_MINIMA, 400, "fecha_invalida")

    items_brutos = lista_items(data)
    if not items_brutos:
        return error(
            "Agrega al menos un producto con cantidad y precio mayor a cero "
            "para solicitar tu cotización.",
            400,
            "sin_partidas",
        )

    items_preparados: list[SolicitudItem] = []
    for bruto in items_brutos:
        if not isinstance(bruto, dict):
            return error(
                "Cada partida debe ser un producto válido.",
                400,
                "partida_invalida",
            )

        producto = None
        producto_id = parse_int(campo(bruto, "productoId", "producto_id"))
        if producto_id is not None:
            producto = Producto.query.filter_by(id=producto_id, activo=True).first()
            if not producto:
                return error(
                    "Una de las partidas ya no está disponible.",
                    400,
                    "producto_invalido",
                )

        cantidad = parse_decimal(campo(bruto, "cantidad", default=0), 0)
        if not math.isfinite(cantidad) or cantidad <= 0:
            return error(
                "Cada partida debe tener una cantidad mayor a cero.",
                400,
                "cantidad_invalida",
            )

        nombre_producto = str(
            campo(bruto, "nombreProducto", "nombre_producto", "nombre", default="")
            or (producto.nombre if producto else "")
        ).strip()
        if not nombre_producto:
            return error(
                "Cada partida debe indicar un producto.",
                400,
                "partida_invalida",
            )

        precio_base = float(producto.precio_base or 0) if producto else 0
        especificaciones = (
            str(campo(bruto, "especificaciones", "detalle", default="") or "")[:240] or None
        )
        if producto and es_lona_vinil(producto):
            base_linea = precio_base_lona_vinil(
                cantidad, nombre_producto, especificaciones
            )
            estimado, descuento = precio_linea_mayoreo(cantidad, base_linea)
        elif producto and precio_base > 0:
            base_linea = round(precio_base * cantidad, 2)
            estimado, descuento = precio_linea_mayoreo(cantidad, base_linea)
        else:
            bruto_estimado = campo(bruto, "precioEstimado", "precio_estimado")
            estimado = (
                parse_decimal(bruto_estimado, 0) if bruto_estimado is not None else 0
            )
            descuento = 0.0

        if not math.isfinite(estimado) or estimado <= 0:
            return error(
                "Cada partida debe tener un precio estimado mayor a cero.",
                400,
                "precio_invalido",
            )

        items_preparados.append(
            SolicitudItem(
                producto_id=producto.id if producto else None,
                nombre_producto=nombre_producto[:160],
                especificaciones=especificaciones,
                cantidad=cantidad,
                precio_estimado=round(estimado, 2),
                descuento_mayoreo=round(descuento, 2),
            )
        )

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
    solicitud.items = items_preparados

    # Guarda adjuntos (multipart). En JSON solo se aceptan nombres referenciales.
    mockups = _mockups_por_archivo(data)
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
                mockup_data=mockups.get(original),
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
    limitado = _limitar_consultas(folio)
    if limitado:
        return limitado

    correo = (request.args.get("correo") or "").strip().lower()
    if not correo:
        return error("Indica el correo con el que registraste la solicitud", 400, "correo_requerido")

    solicitud = _solicitud_por_credenciales(folio, correo)
    if not solicitud:
        return no_encontrado("Solicitud")

    cotizacion = solicitud.cotizaciones[0] if solicitud.cotizaciones else None
    pedido = None
    for registro in solicitud.cotizaciones:
        for candidato in registro.pedidos:
            if pedido is None or (candidato.id or 0) > (pedido.id or 0):
                pedido = candidato

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
                {
                    "nombre": a.nombre_original,
                    "tamanoBytes": a.tamano_bytes,
                    "esMockup": bool(a.mockup_data),
                }
                for a in solicitud.archivos
            ],
            "mensajes": [mensaje.to_dict(publico=True) for mensaje in solicitud.mensajes],
            "cotizacion": (
                {
                    "folio": cotizacion.folio,
                    "estado": cotizacion.estado,
                    "total": float(cotizacion.total),
                }
                if cotizacion
                else None
            ),
            "pedido": _pedido_publico(pedido, solicitud.fecha_deseada) if pedido else None,
            "actualizadoEn": solicitud.actualizado_en.isoformat(timespec="seconds"),
        }
    )


@public_bp.get("/public/solicitudes/<folio>/mensajes")
def listar_mensajes_solicitud(folio: str):
    limitado = _limitar_consultas(folio)
    if limitado:
        return limitado

    correo = (request.args.get("correo") or "").strip().lower()
    if not correo:
        return error("Indica el correo con el que registraste la solicitud", 400, "correo_requerido")

    solicitud = _solicitud_por_credenciales(folio, correo)
    if not solicitud:
        return no_encontrado("Solicitud")

    mensajes = solicitud.mensajes
    return jsonify(
        {
            "items": [mensaje.to_dict(publico=True) for mensaje in mensajes],
            "total": len(mensajes),
        }
    )


@public_bp.post("/public/solicitudes/<folio>/mensajes")
def enviar_mensaje_solicitud(folio: str):
    espera = excedido(
        (
            "chat-publico",
            f"{cliente_ip()}|{folio.strip().upper()[:20]}",
            current_app.config["CHAT_MAX_MENSAJES"],
            current_app.config["CHAT_VENTANA_SEGUNDOS"],
        )
    )
    if espera is not None:
        return demasiadas_peticiones(
            espera, "Enviaste varios mensajes seguidos. Espera un momento para continuar."
        )

    data = payload()
    correo = str(campo(data, "correo", "email", default="")).strip().lower()
    if not correo:
        return error("Indica el correo con el que registraste la solicitud", 400, "correo_requerido")

    solicitud = _solicitud_por_credenciales(folio, correo)
    if not solicitud:
        return no_encontrado("Solicitud")

    mensaje = str(campo(data, "mensaje", "contenido", default="")).strip()
    if len(mensaje) > MAX_MENSAJE_CHAT:
        return error(f"El mensaje no puede exceder {MAX_MENSAJE_CHAT} caracteres")

    storage = request.files.get("archivo")
    if not mensaje and not (storage and storage.filename):
        return error("Escribe un mensaje o adjunta un archivo de referencia")

    nuevo = MensajeChat(
        solicitud_id=solicitud.id,
        remitente_tipo="cliente",
        mensaje=mensaje or None,
    )

    if storage and storage.filename:
        guardado = guardar_archivo(storage)
        if not guardado:
            return error(
                "Formato de archivo no permitido. Usa PDF, AI, PSD, PNG, JPG, SVG o ZIP",
                415,
                "archivo_invalido",
            )
        original, nombre_guardado, tamano = guardado
        nuevo.adjunto_nombre = original[:200]
        nuevo.adjunto_guardado = nombre_guardado
        nuevo.adjunto_mime = storage.mimetype
        nuevo.adjunto_tamano = tamano

    db.session.add(nuevo)
    db.session.commit()

    return (
        jsonify(
            {
                "mensaje": "Mensaje enviado. El equipo de Llamma te responderá por este medio.",
                "mensajeChat": nuevo.to_dict(publico=True),
            }
        ),
        201,
    )


@public_bp.get("/public/solicitudes/<folio>/mensajes/<int:mensaje_id>/archivo")
def descargar_adjunto_mensaje(folio: str, mensaje_id: int):
    limitado = _limitar_consultas(folio)
    if limitado:
        return limitado

    correo = (request.args.get("correo") or "").strip().lower()
    if not correo:
        return error("Indica el correo con el que registraste la solicitud", 400, "correo_requerido")

    solicitud = _solicitud_por_credenciales(folio, correo)
    if not solicitud:
        return no_encontrado("Solicitud")

    mensaje = next((item for item in solicitud.mensajes if item.id == mensaje_id), None)
    if not mensaje or not mensaje.adjunto_guardado:
        return no_encontrado("Archivo")

    carpeta = current_app.config["UPLOAD_FOLDER"]
    if not os.path.exists(os.path.join(carpeta, mensaje.adjunto_guardado)):
        return no_encontrado("Archivo en disco")

    return send_from_directory(
        carpeta,
        mensaje.adjunto_guardado,
        as_attachment=True,
        download_name=mensaje.adjunto_nombre or mensaje.adjunto_guardado,
    )

@public_bp.post("/public/mockups/preparar-imagen")
def preparar_imagen_mockup():
    """Optimiza una imagen del cliente para usarla como capa en el visor 3D."""
    espera = excedido(("mockup-imagen", cliente_ip(), 40, 60))
    if espera is not None:
        return demasiadas_peticiones(espera, "Procesaste muchas imágenes seguidas. Espera un momento.")

    storage = request.files.get("imagen") or request.files.get("archivo")
    if not storage or not storage.filename:
        return error("Sube una imagen PNG, JPG o WEBP para previsualizarla")

    quitar_fondo = (request.form.get("quitarFondo") or "").lower() in {"1", "true", "si", "sí"}
    recortar = (request.form.get("recortar") or "true").lower() in {"1", "true", "si", "sí"}
    try:
        umbral = max(180, min(252, int(request.form.get("umbral", "240"))))
    except ValueError:
        umbral = 240

    try:
        imagen = Image.open(storage.stream)
        imagen = ImageOps.exif_transpose(imagen).convert("RGBA")
    except (UnidentifiedImageError, OSError):
        return error("El archivo no es una imagen válida (usa PNG, JPG o WEBP)", 415, "imagen_invalida")

    ancho_original, alto_original = imagen.size
    lado_mayor = max(ancho_original, alto_original)
    if lado_mayor >= 1200:
        calidad = "alta"
    elif lado_mayor >= 600:
        calidad = "media"
    else:
        calidad = "baja"

    # Tamaño ideal para textura WebGL en Three.js
    imagen.thumbnail((1024, 1024), Image.Resampling.LANCZOS)

    if quitar_fondo:
        pixeles = imagen.getdata()
        suavizado = max(0, umbral - 24)
        nuevos = []
        for r, g, b, a in pixeles:
            if a == 0:
                nuevos.append((r, g, b, 0))
            elif r >= umbral and g >= umbral and b >= umbral:
                nuevos.append((r, g, b, 0))
            elif r >= suavizado and g >= suavizado and b >= suavizado:
                # Borde semitransparente para evitar contornos dentados
                brillo = min(r, g, b)
                factor = 1.0 - (brillo - suavizado) / max(1, umbral - suavizado)
                nuevos.append((r, g, b, int(a * factor)))
            else:
                nuevos.append((r, g, b, a))
        imagen.putdata(nuevos)

    if recortar:
        caja = imagen.getbbox()
        if caja:
            imagen = imagen.crop(caja)

    buffer = BytesIO()
    imagen.save(buffer, format="PNG", optimize=True)
    codificada = base64.b64encode(buffer.getvalue()).decode("ascii")

    return jsonify(
        {
            "dataUrl": f"data:image/png;base64,{codificada}",
            "ancho": imagen.width,
            "alto": imagen.height,
            "anchoOriginal": ancho_original,
            "altoOriginal": alto_original,
            "calidadImpresion": calidad,
        }
    )

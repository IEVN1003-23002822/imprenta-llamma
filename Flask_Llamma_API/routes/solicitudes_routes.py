"""Bandeja interna de solicitudes de cotización y su chat."""

from __future__ import annotations

import os

from flask import Blueprint, current_app, g, jsonify, request, send_from_directory
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload, selectinload

from auth import role_required, token_required
from estados import ESTADOS_SOLICITUD
from extensions import db
from models import MensajeChat, SolicitudCotizacion
from routes.comun import crear_cotizacion
from routes.helpers import (
    MAX_MENSAJE_CHAT,
    campo,
    error,
    no_encontrado,
    payload,
)
from utils import guardar_archivo, paginar, parse_int

solicitudes_bp = Blueprint("solicitudes", __name__)


@solicitudes_bp.get("/solicitudes")
@token_required
def listar_solicitudes():
    query = SolicitudCotizacion.query.options(
        selectinload(SolicitudCotizacion.items),
        selectinload(SolicitudCotizacion.archivos),
    )

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


@solicitudes_bp.get("/solicitudes/resumen")
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


@solicitudes_bp.get("/solicitudes/<int:solicitud_id>")
@token_required
def detalle_solicitud(solicitud_id: int):
    solicitud = (
        SolicitudCotizacion.query.options(
            selectinload(SolicitudCotizacion.items),
            selectinload(SolicitudCotizacion.archivos),
            selectinload(SolicitudCotizacion.cotizaciones),
            selectinload(SolicitudCotizacion.mensajes).joinedload(MensajeChat.usuario),
        )
        .filter_by(id=solicitud_id)
        .first()
    )
    if not solicitud:
        return no_encontrado("Solicitud")
    return jsonify(solicitud.to_dict(incluir_mensajes=True))


@solicitudes_bp.get("/solicitudes/<int:solicitud_id>/mensajes")
@token_required
def listar_mensajes_solicitud(solicitud_id: int):
    solicitud = (
        SolicitudCotizacion.query.options(
            selectinload(SolicitudCotizacion.mensajes).joinedload(MensajeChat.usuario)
        )
        .filter_by(id=solicitud_id)
        .first()
    )
    if not solicitud:
        return no_encontrado("Solicitud")
    mensajes = solicitud.mensajes
    return jsonify(
        {
            "items": [mensaje.to_dict() for mensaje in mensajes],
            "total": len(mensajes),
        }
    )


@solicitudes_bp.post("/solicitudes/<int:solicitud_id>/mensajes")
@role_required("admin", "ventas")
def enviar_mensaje_solicitud(solicitud_id: int):
    solicitud = SolicitudCotizacion.query.get(solicitud_id)
    if not solicitud:
        return no_encontrado("Solicitud")

    data = payload()
    mensaje = str(campo(data, "mensaje", "contenido", default="")).strip()
    if len(mensaje) > MAX_MENSAJE_CHAT:
        return error(f"El mensaje no puede exceder {MAX_MENSAJE_CHAT} caracteres")

    storage = request.files.get("archivo")
    if not mensaje and not (storage and storage.filename):
        return error("Escribe un mensaje o adjunta un archivo de referencia")

    nuevo = MensajeChat(
        solicitud_id=solicitud.id,
        remitente_tipo="interno",
        usuario_id=g.usuario.id,
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
                "mensaje": "Respuesta enviada al cliente.",
                "mensajeChat": nuevo.to_dict(),
            }
        ),
        201,
    )


@solicitudes_bp.get("/mensajes/<int:mensaje_id>/archivo")
@token_required
def descargar_adjunto_mensaje(mensaje_id: int):
    mensaje = MensajeChat.query.get(mensaje_id)
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


@solicitudes_bp.patch("/solicitudes/<int:solicitud_id>/estado")
@role_required("admin", "ventas")
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


@solicitudes_bp.delete("/solicitudes/<int:solicitud_id>")
@role_required("admin")
def eliminar_solicitud(solicitud_id: int):
    solicitud = SolicitudCotizacion.query.get(solicitud_id)
    if not solicitud:
        return no_encontrado("Solicitud")
    db.session.delete(solicitud)
    db.session.commit()
    return jsonify({"mensaje": "Solicitud eliminada"})


@solicitudes_bp.post("/solicitudes/<int:solicitud_id>/convertir-cotizacion")
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
        cotizacion = crear_cotizacion(solicitud, payload(), g.usuario)
        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        return error(str(exc))

    return jsonify(cotizacion.to_dict()), 201

"""Descarga de los archivos adjuntos de una solicitud."""

from __future__ import annotations

import os

from flask import Blueprint, current_app, send_from_directory

from auth import role_required
from models import SolicitudArchivo
from routes.helpers import no_encontrado

archivos_bp = Blueprint("archivos", __name__)


@archivos_bp.get("/archivos/<int:archivo_id>")
@role_required("admin", "ventas", "produccion")
def descargar_archivo(archivo_id: int):
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

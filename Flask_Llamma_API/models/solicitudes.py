"""Solicitudes públicas, adjuntos y chat con el cliente."""

from __future__ import annotations

from extensions import db
from models.base import TimestampMixin, iso, utcnow


class SolicitudCotizacion(TimestampMixin, db.Model):
    __tablename__ = "solicitudes_cotizacion"

    id = db.Column(db.Integer, primary_key=True)
    folio = db.Column(db.String(30), unique=True, nullable=False, index=True)
    nombre_cliente = db.Column(db.String(140), nullable=False)
    empresa = db.Column(db.String(140))
    correo = db.Column(db.String(160), nullable=False, index=True)
    telefono = db.Column(db.String(30))
    segmento = db.Column(db.String(30), default="particular", nullable=False)
    mensaje = db.Column(db.Text)
    fecha_deseada = db.Column(db.Date)
    metodo_entrega = db.Column(db.String(40), default="taller", nullable=False)
    estado = db.Column(db.String(30), default="nueva", nullable=False, index=True)
    origen = db.Column(db.String(40), default="web", nullable=False)
    atendido_por = db.Column(db.Integer, db.ForeignKey("usuarios.id"))

    __table_args__ = (db.Index("ix_solicitudes_cotizacion_creado_en", "creado_en"),)

    items = db.relationship(
        "SolicitudItem", back_populates="solicitud", cascade="all, delete-orphan"
    )
    archivos = db.relationship(
        "SolicitudArchivo", back_populates="solicitud", cascade="all, delete-orphan"
    )
    mensajes = db.relationship(
        "MensajeChat",
        back_populates="solicitud",
        cascade="all, delete-orphan",
        order_by=lambda: (MensajeChat.creado_en, MensajeChat.id),
    )
    cotizaciones = db.relationship("Cotizacion", back_populates="solicitud")

    def to_dict(self, incluir_detalle: bool = True, incluir_mensajes: bool = False) -> dict:
        data = {
            "id": self.id,
            "folio": self.folio,
            "nombreCliente": self.nombre_cliente,
            "empresa": self.empresa,
            "correo": self.correo,
            "telefono": self.telefono,
            "segmento": self.segmento,
            "mensaje": self.mensaje,
            "fechaDeseada": self.fecha_deseada.isoformat() if self.fecha_deseada else None,
            "metodoEntrega": self.metodo_entrega,
            "estado": self.estado,
            "origen": self.origen,
            "fechaCreacion": iso(self.creado_en),
            "totalItems": len(self.items),
            "totalArchivos": len(self.archivos),
        }
        if incluir_detalle:
            data["itemsSolicitados"] = [item.to_dict() for item in self.items]
            data["archivosAdjuntos"] = [archivo.to_dict() for archivo in self.archivos]
            data["cotizacionId"] = self.cotizaciones[0].id if self.cotizaciones else None
        if incluir_mensajes:
            data["mensajes"] = [mensaje.to_dict() for mensaje in self.mensajes]
        return data


class SolicitudItem(db.Model):
    __tablename__ = "solicitud_items"

    id = db.Column(db.Integer, primary_key=True)
    solicitud_id = db.Column(
        db.Integer,
        db.ForeignKey("solicitudes_cotizacion.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    producto_id = db.Column(db.Integer, db.ForeignKey("productos.id"))
    nombre_producto = db.Column(db.String(160), nullable=False)
    especificaciones = db.Column(db.String(240))
    cantidad = db.Column(db.Numeric(12, 2), default=1, nullable=False)
    precio_estimado = db.Column(db.Numeric(12, 2))

    solicitud = db.relationship("SolicitudCotizacion", back_populates="items")
    producto = db.relationship("Producto", back_populates="solicitud_items")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "productoId": self.producto_id,
            "nombreProducto": self.nombre_producto,
            "especificaciones": self.especificaciones,
            "cantidad": float(self.cantidad or 0),
            "precioEstimado": float(self.precio_estimado) if self.precio_estimado is not None else None,
        }


class SolicitudArchivo(db.Model):
    __tablename__ = "solicitud_archivos"

    id = db.Column(db.Integer, primary_key=True)
    solicitud_id = db.Column(
        db.Integer,
        db.ForeignKey("solicitudes_cotizacion.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nombre_original = db.Column(db.String(200), nullable=False)
    nombre_guardado = db.Column(db.String(200), nullable=False)
    ruta_relativa = db.Column(db.String(300), nullable=False)
    mime_type = db.Column(db.String(120))
    tamano_bytes = db.Column(db.Integer, default=0, nullable=False)
    creado_en = db.Column(db.DateTime, default=utcnow, nullable=False)

    solicitud = db.relationship("SolicitudCotizacion", back_populates="archivos")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "nombreOriginal": self.nombre_original,
            "nombreGuardado": self.nombre_guardado,
            "mimeType": self.mime_type,
            "tamanoBytes": self.tamano_bytes,
            "url": f"/api/archivos/{self.id}",
        }


class MensajeChat(db.Model):
    """Mensaje del hilo público entre un cliente y el equipo de Llamma."""

    __tablename__ = "mensajes_chat"

    id = db.Column(db.Integer, primary_key=True)
    solicitud_id = db.Column(
        db.Integer,
        db.ForeignKey("solicitudes_cotizacion.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    remitente_tipo = db.Column(db.String(20), nullable=False, default="cliente")
    usuario_id = db.Column(
        db.Integer, db.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True
    )
    mensaje = db.Column(db.Text)
    adjunto_nombre = db.Column(db.String(200))
    adjunto_guardado = db.Column(db.String(200))
    adjunto_mime = db.Column(db.String(120))
    adjunto_tamano = db.Column(db.Integer, default=0, nullable=False)
    creado_en = db.Column(db.DateTime, default=utcnow, nullable=False, index=True)

    solicitud = db.relationship("SolicitudCotizacion", back_populates="mensajes")
    usuario = db.relationship("Usuario")

    def to_dict(self, publico: bool = False) -> dict:
        autor = "Cliente"
        if self.remitente_tipo == "interno":
            autor = self.usuario.nombre if self.usuario else "Equipo Llamma"

        adjunto = None
        if self.adjunto_guardado:
            adjunto = {
                "nombre": self.adjunto_nombre,
                "mimeType": self.adjunto_mime,
                "tamanoBytes": self.adjunto_tamano or 0,
            }

        return {
            "id": self.id,
            "solicitudId": self.solicitud_id,
            "remitenteTipo": self.remitente_tipo,
            "usuarioId": None if publico else self.usuario_id,
            "autor": autor,
            "mensaje": self.mensaje or "",
            "adjunto": adjunto,
            "creadoEn": iso(self.creado_en),
        }

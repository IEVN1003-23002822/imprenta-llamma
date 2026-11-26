"""Órdenes de producción, etapas y controles de calidad."""

from __future__ import annotations

from extensions import db
from models.base import TimestampMixin, iso, utcnow


class OrdenProduccion(TimestampMixin, db.Model):
    __tablename__ = "ordenes_produccion"

    id = db.Column(db.Integer, primary_key=True)
    pedido_id = db.Column(
        db.Integer, db.ForeignKey("pedidos.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    etapa = db.Column(db.String(30), default="diseno", nullable=False, index=True)
    estado = db.Column(db.String(30), default="pendiente", nullable=False, index=True)
    responsable_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"))
    fecha_inicio = db.Column(db.DateTime)
    fecha_fin = db.Column(db.DateTime)
    observaciones = db.Column(db.Text)

    __table_args__ = (db.Index("ix_ordenes_produccion_creado_en", "creado_en"),)

    pedido = db.relationship("Pedido", back_populates="orden_produccion")
    responsable = db.relationship("Usuario", back_populates="ordenes_produccion")
    etapas = db.relationship(
        "ProduccionEtapa",
        back_populates="orden",
        cascade="all, delete-orphan",
        order_by="ProduccionEtapa.id",
    )
    controles = db.relationship(
        "ControlCalidad", back_populates="orden", cascade="all, delete-orphan"
    )

    def to_dict(self, incluir_detalle: bool = True) -> dict:
        data = {
            "id": self.id,
            "pedidoId": self.pedido_id,
            "pedidoFolio": self.pedido.folio if self.pedido else None,
            "etapa": self.etapa,
            "estado": self.estado,
            "responsableId": self.responsable_id,
            "responsable": self.responsable.nombre if self.responsable else None,
            "fechaInicio": iso(self.fecha_inicio),
            "fechaFin": iso(self.fecha_fin),
            "observaciones": self.observaciones,
        }
        if incluir_detalle:
            data["historialEtapas"] = [etapa.to_dict() for etapa in self.etapas]
            data["controlesCalidad"] = [control.to_dict() for control in self.controles]
        return data


class ProduccionEtapa(db.Model):
    __tablename__ = "produccion_etapas"

    id = db.Column(db.Integer, primary_key=True)
    orden_produccion_id = db.Column(
        db.Integer, db.ForeignKey("ordenes_produccion.id", ondelete="CASCADE"), nullable=False
    )
    etapa = db.Column(db.String(30), nullable=False)
    estado = db.Column(db.String(30), default="pendiente", nullable=False)
    responsable_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"))
    inicio = db.Column(db.DateTime)
    fin = db.Column(db.DateTime)
    notas = db.Column(db.String(240))
    creado_en = db.Column(db.DateTime, default=utcnow, nullable=False)

    orden = db.relationship("OrdenProduccion", back_populates="etapas")
    responsable = db.relationship("Usuario")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "etapa": self.etapa,
            "estado": self.estado,
            "responsable": self.responsable.nombre if self.responsable else None,
            "inicio": iso(self.inicio),
            "fin": iso(self.fin),
            "notas": self.notas,
            "creadoEn": iso(self.creado_en),
        }


class ControlCalidad(db.Model):
    __tablename__ = "controles_calidad"

    id = db.Column(db.Integer, primary_key=True)
    orden_produccion_id = db.Column(
        db.Integer, db.ForeignKey("ordenes_produccion.id", ondelete="CASCADE"), nullable=False
    )
    criterio = db.Column(db.String(160), nullable=False)
    aprobado = db.Column(db.Boolean, default=False, nullable=False)
    observaciones = db.Column(db.String(240))
    revisado_por = db.Column(db.Integer, db.ForeignKey("usuarios.id"))
    fecha = db.Column(db.DateTime, default=utcnow, nullable=False)

    orden = db.relationship("OrdenProduccion", back_populates="controles")
    revisor = db.relationship("Usuario", back_populates="controles_calidad")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "criterio": self.criterio,
            "aprobado": self.aprobado,
            "observaciones": self.observaciones,
            "revisadoPor": self.revisor.nombre if self.revisor else None,
            "fecha": iso(self.fecha),
        }

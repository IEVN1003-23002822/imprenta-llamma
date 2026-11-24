"""Actividades y campañas de marketing."""

from __future__ import annotations

from extensions import db
from models.base import TimestampMixin, iso, utcnow


class ActividadMarketing(TimestampMixin, db.Model):
    __tablename__ = "actividades_marketing"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(180), nullable=False)
    canal = db.Column(db.String(40), default="redes-sociales", nullable=False)
    fecha_inicio = db.Column(db.Date, nullable=False, index=True)
    fecha_fin = db.Column(db.Date)
    presupuesto = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    inversion_real = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    ingresos_atribuidos = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    estado = db.Column(db.String(30), default="planeada", nullable=False, index=True)
    descripcion = db.Column(db.Text)
    creado_por = db.Column(db.Integer, db.ForeignKey("usuarios.id"))

    creador = db.relationship("Usuario", back_populates="actividades_marketing")

    @property
    def roi(self) -> float:
        inversion = float(self.inversion_real or 0)
        if inversion <= 0:
            return 0.0
        return round(float(self.ingresos_atribuidos or 0) / inversion, 2)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "canal": self.canal,
            "fechaInicio": self.fecha_inicio.isoformat() if self.fecha_inicio else None,
            "fechaFin": self.fecha_fin.isoformat() if self.fecha_fin else None,
            "presupuesto": float(self.presupuesto or 0),
            "inversionReal": float(self.inversion_real or 0),
            "ingresosAtribuidos": float(self.ingresos_atribuidos or 0),
            "roi": self.roi,
            "estado": self.estado,
            "descripcion": self.descripcion,
        }

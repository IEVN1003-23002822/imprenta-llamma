"""Órdenes de compra a proveedores."""

from __future__ import annotations

from extensions import db
from models.base import TimestampMixin, iso, utcnow


class OrdenCompra(TimestampMixin, db.Model):
    __tablename__ = "ordenes_compra"

    id = db.Column(db.Integer, primary_key=True)
    folio = db.Column(db.String(30), unique=True, nullable=False, index=True)
    proveedor_id = db.Column(db.Integer, db.ForeignKey("proveedores.id"), nullable=False)
    estado = db.Column(db.String(30), default="pendiente", nullable=False, index=True)
    fecha_emision = db.Column(
        db.Date, default=lambda: utcnow().date(), nullable=False, index=True
    )
    fecha_entrega = db.Column(db.Date)
    subtotal = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    impuestos = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    total = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    notas = db.Column(db.Text)
    creado_por = db.Column(db.Integer, db.ForeignKey("usuarios.id"))

    __table_args__ = (db.Index("ix_ordenes_compra_creado_en", "creado_en"),)

    proveedor = db.relationship("Proveedor", back_populates="ordenes_compra")
    creador = db.relationship("Usuario", back_populates="ordenes_compra")
    items = db.relationship(
        "OrdenCompraItem", back_populates="orden_compra", cascade="all, delete-orphan"
    )

    def to_dict(self, incluir_items: bool = True) -> dict:
        data = {
            "id": self.id,
            "folio": self.folio,
            "proveedorId": self.proveedor_id,
            "proveedor": self.proveedor.nombre if self.proveedor else None,
            "estado": self.estado,
            "fechaEmision": self.fecha_emision.isoformat() if self.fecha_emision else None,
            "fechaEntrega": self.fecha_entrega.isoformat() if self.fecha_entrega else None,
            "subtotal": float(self.subtotal or 0),
            "impuestos": float(self.impuestos or 0),
            "total": float(self.total or 0),
            "notas": self.notas,
        }
        if incluir_items:
            data["items"] = [item.to_dict() for item in self.items]
        return data


class OrdenCompraItem(db.Model):
    __tablename__ = "orden_compra_items"

    id = db.Column(db.Integer, primary_key=True)
    orden_compra_id = db.Column(
        db.Integer, db.ForeignKey("ordenes_compra.id", ondelete="CASCADE"), nullable=False
    )
    materia_prima_id = db.Column(db.Integer, db.ForeignKey("materias_primas.id"), nullable=False)
    cantidad = db.Column(db.Numeric(12, 4), nullable=False)
    unidad_medida = db.Column(db.String(20), nullable=False)
    precio_unitario = db.Column(db.Numeric(12, 4), default=0, nullable=False)
    importe = db.Column(db.Numeric(12, 2), default=0, nullable=False)

    orden_compra = db.relationship("OrdenCompra", back_populates="items")
    materia_prima = db.relationship("MateriaPrima", back_populates="orden_compra_items")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "materiaPrimaId": self.materia_prima_id,
            "materiaPrima": self.materia_prima.nombre if self.materia_prima else None,
            "cantidad": float(self.cantidad or 0),
            "unidadMedida": self.unidad_medida,
            "precioUnitario": float(self.precio_unitario or 0),
            "importe": float(self.importe or 0),
        }

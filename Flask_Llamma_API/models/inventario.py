"""Proveedores, materias primas y movimientos de inventario."""

from __future__ import annotations

from extensions import db
from models.base import TimestampMixin, iso, utcnow


class Proveedor(TimestampMixin, db.Model):
    __tablename__ = "proveedores"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(160), unique=True, nullable=False)
    contacto = db.Column(db.String(120))
    telefono = db.Column(db.String(30))
    correo = db.Column(db.String(160))
    condiciones_pago = db.Column(db.String(120))
    activo = db.Column(db.Boolean, default=True, nullable=False)

    materias_primas = db.relationship("MateriaPrima", back_populates="proveedor")
    ordenes_compra = db.relationship("OrdenCompra", back_populates="proveedor")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "contacto": self.contacto,
            "telefono": self.telefono,
            "correo": self.correo,
            "condicionesPago": self.condiciones_pago,
            "activo": self.activo,
        }


class MateriaPrima(TimestampMixin, db.Model):
    __tablename__ = "materias_primas"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(160), nullable=False, index=True)
    categoria = db.Column(db.String(40), default="otro", nullable=False, index=True)
    unidad_medida = db.Column(db.String(20), default="pieza", nullable=False)
    stock_actual = db.Column(db.Numeric(12, 4), default=0, nullable=False)
    stock_minimo = db.Column(db.Numeric(12, 4), default=0, nullable=False)
    stock_maximo = db.Column(db.Numeric(12, 4), default=0, nullable=False)
    costo_unitario = db.Column(db.Numeric(12, 4), default=0, nullable=False)
    proveedor_id = db.Column(db.Integer, db.ForeignKey("proveedores.id"))
    activo = db.Column(db.Boolean, default=True, nullable=False)

    __table_args__ = (
        db.Index("ix_materias_primas_activo_categoria", "activo", "categoria"),
    )

    proveedor = db.relationship("Proveedor", back_populates="materias_primas")
    movimientos = db.relationship("MovimientoInventario", back_populates="materia_prima")
    componentes_receta = db.relationship("RecetaComponente", back_populates="materia_prima")
    orden_compra_items = db.relationship("OrdenCompraItem", back_populates="materia_prima")

    @property
    def bajo_stock(self) -> bool:
        return float(self.stock_actual or 0) <= float(self.stock_minimo or 0)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "categoria": self.categoria,
            "unidadMedida": self.unidad_medida,
            "stockActual": float(self.stock_actual or 0),
            "stockMinimo": float(self.stock_minimo or 0),
            "stockMaximo": float(self.stock_maximo or 0),
            "costoUnitario": float(self.costo_unitario or 0),
            "proveedorId": self.proveedor_id,
            "proveedor": self.proveedor.nombre if self.proveedor else None,
            "bajoStock": self.bajo_stock,
            "activo": self.activo,
        }


class MovimientoInventario(db.Model):
    __tablename__ = "movimientos_inventario"

    id = db.Column(db.Integer, primary_key=True)
    materia_prima_id = db.Column(
        db.Integer, db.ForeignKey("materias_primas.id"), nullable=False, index=True
    )
    tipo = db.Column(db.String(20), nullable=False, index=True)
    cantidad = db.Column(db.Numeric(12, 4), nullable=False)
    unidad_medida = db.Column(db.String(20), nullable=False)
    costo_unitario = db.Column(db.Numeric(12, 4), default=0, nullable=False)
    referencia = db.Column(db.String(80))
    motivo = db.Column(db.String(240))
    usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"))
    creado_en = db.Column(db.DateTime, default=utcnow, nullable=False, index=True)

    materia_prima = db.relationship("MateriaPrima", back_populates="movimientos")
    usuario = db.relationship("Usuario", back_populates="movimientos")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "materiaPrimaId": self.materia_prima_id,
            "materiaPrima": self.materia_prima.nombre if self.materia_prima else None,
            "tipo": self.tipo,
            "cantidad": float(self.cantidad or 0),
            "unidadMedida": self.unidad_medida,
            "costoUnitario": float(self.costo_unitario or 0),
            "referencia": self.referencia,
            "motivo": self.motivo,
            "usuario": self.usuario.nombre if self.usuario else None,
            "fecha": iso(self.creado_en),
        }

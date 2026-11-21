"""Clientes, catálogo de productos y recetas de producción."""

from __future__ import annotations

from extensions import db
from models.base import TimestampMixin, iso, utcnow


class Cliente(TimestampMixin, db.Model):
    __tablename__ = "clientes"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(140), nullable=False, index=True)
    empresa = db.Column(db.String(140))
    correo = db.Column(db.String(160), unique=True, nullable=False, index=True)
    telefono = db.Column(db.String(30))
    direccion = db.Column(db.String(240))
    rfc = db.Column(db.String(20))
    segmento = db.Column(db.String(30), default="particular", nullable=False, index=True)
    notas = db.Column(db.Text)
    activo = db.Column(db.Boolean, default=True, nullable=False)

    cotizaciones = db.relationship("Cotizacion", back_populates="cliente")
    pedidos = db.relationship("Pedido", back_populates="cliente")

    def to_dict(self, incluir_metricas: bool = False) -> dict:
        data = {
            "id": self.id,
            "nombre": self.nombre,
            "empresa": self.empresa,
            "correo": self.correo,
            "telefono": self.telefono,
            "direccion": self.direccion,
            "rfc": self.rfc,
            "segmento": self.segmento,
            "notas": self.notas,
            "activo": self.activo,
            "fechaRegistro": iso(self.creado_en),
        }
        if incluir_metricas:
            pedidos = [p for p in self.pedidos if p.estado != "cancelado"]
            data["totalPedidos"] = len(pedidos)
            data["totalFacturado"] = round(float(sum((p.total for p in pedidos), 0)), 2)
        return data


class Producto(TimestampMixin, db.Model):
    __tablename__ = "productos"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(160), unique=True, nullable=False)
    descripcion = db.Column(db.Text)
    categoria = db.Column(db.String(40), default="otro", nullable=False, index=True)
    linea_produccion = db.Column(
        db.String(40), default="gran-formato", nullable=False, index=True
    )
    precio_base = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    unidad_venta = db.Column(db.String(20), default="pieza", nullable=False)
    icono = db.Column(db.String(60), default="bi-box-seam")
    imagen_url = db.Column(db.String(300))
    publicado = db.Column(db.Boolean, default=True, nullable=False)
    activo = db.Column(db.Boolean, default=True, nullable=False)

    __table_args__ = (db.Index("ix_productos_catalogo", "activo", "publicado"),)

    receta = db.relationship(
        "Receta", back_populates="producto", uselist=False, cascade="all, delete-orphan"
    )
    solicitud_items = db.relationship("SolicitudItem", back_populates="producto")
    cotizacion_items = db.relationship("CotizacionItem", back_populates="producto")
    pedido_items = db.relationship("PedidoItem", back_populates="producto")

    def to_dict(self, publico: bool = False) -> dict:
        data = {
            "id": self.id,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "categoria": self.categoria,
            "lineaProduccion": self.linea_produccion,
            "precioBase": float(self.precio_base or 0),
            "unidadVenta": self.unidad_venta,
            "icono": self.icono,
            "imagenUrl": self.imagen_url,
            "activo": self.activo,
        }
        if not publico:
            data["publicado"] = self.publicado
            data["tieneReceta"] = self.receta is not None
        return data


class Receta(TimestampMixin, db.Model):
    __tablename__ = "recetas"

    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(
        db.Integer, db.ForeignKey("productos.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    nombre = db.Column(db.String(160), nullable=False)
    rendimiento = db.Column(db.Numeric(12, 4), default=1, nullable=False)
    unidad_rendimiento = db.Column(db.String(20), default="pieza", nullable=False)
    costo_estimado = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    tiempo_produccion_min = db.Column(db.Integer, default=0, nullable=False)

    producto = db.relationship("Producto", back_populates="receta")
    componentes = db.relationship(
        "RecetaComponente", back_populates="receta", cascade="all, delete-orphan"
    )

    def to_dict(self, incluir_componentes: bool = True) -> dict:
        data = {
            "id": self.id,
            "productoId": self.producto_id,
            "nombre": self.nombre,
            "rendimiento": float(self.rendimiento or 0),
            "unidadRendimiento": self.unidad_rendimiento,
            "costoEstimado": float(self.costo_estimado or 0),
            "tiempoProduccionMin": self.tiempo_produccion_min,
        }
        if incluir_componentes:
            data["componentes"] = [c.to_dict() for c in self.componentes]
        return data


class RecetaComponente(db.Model):
    __tablename__ = "receta_componentes"

    id = db.Column(db.Integer, primary_key=True)
    receta_id = db.Column(
        db.Integer, db.ForeignKey("recetas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    materia_prima_id = db.Column(db.Integer, db.ForeignKey("materias_primas.id"), nullable=False)
    cantidad = db.Column(db.Numeric(12, 4), nullable=False)
    unidad_medida = db.Column(db.String(20), nullable=False)
    desperdicio_porcentaje = db.Column(db.Numeric(5, 2), default=0, nullable=False)

    receta = db.relationship("Receta", back_populates="componentes")
    materia_prima = db.relationship("MateriaPrima", back_populates="componentes_receta")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "materiaPrimaId": self.materia_prima_id,
            "materiaPrima": self.materia_prima.nombre if self.materia_prima else None,
            "cantidad": float(self.cantidad or 0),
            "unidadMedida": self.unidad_medida,
            "desperdicioPorcentaje": float(self.desperdicio_porcentaje or 0),
        }

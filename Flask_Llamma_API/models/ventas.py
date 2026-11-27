"""Cotizaciones, pedidos, partidas y pagos."""

from __future__ import annotations

from datetime import date

from extensions import db
from models.base import TimestampMixin, iso, utcnow


class Cotizacion(TimestampMixin, db.Model):
    __tablename__ = "cotizaciones"

    id = db.Column(db.Integer, primary_key=True)
    folio = db.Column(db.String(30), unique=True, nullable=False, index=True)
    solicitud_id = db.Column(db.Integer, db.ForeignKey("solicitudes_cotizacion.id"))
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"))
    estado = db.Column(db.String(30), default="borrador", nullable=False, index=True)
    fecha_emision = db.Column(
        db.Date, default=date.today, nullable=False, index=True
    )
    vigencia_dias = db.Column(db.Integer, default=15, nullable=False)
    subtotal = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    impuestos = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    total = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    anticipo = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    saldo = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    notas = db.Column(db.Text)
    inventario_descontado = db.Column(db.Boolean, default=False, nullable=False)

    __table_args__ = (db.Index("ix_cotizaciones_creado_en", "creado_en"),)

    solicitud = db.relationship("SolicitudCotizacion", back_populates="cotizaciones")
    cliente = db.relationship("Cliente", back_populates="cotizaciones")
    usuario = db.relationship("Usuario", back_populates="cotizaciones")
    items = db.relationship(
        "CotizacionItem", back_populates="cotizacion", cascade="all, delete-orphan"
    )
    pedidos = db.relationship("Pedido", back_populates="cotizacion")

    def to_dict(self, incluir_items: bool = True) -> dict:
        data = {
            "id": self.id,
            "folio": self.folio,
            "solicitudId": self.solicitud_id,
            "clienteId": self.cliente_id,
            "cliente": self.cliente.nombre if self.cliente else None,
            "usuario": self.usuario.nombre if self.usuario else None,
            "estado": self.estado,
            "fechaEmision": self.fecha_emision.isoformat() if self.fecha_emision else None,
            "fechaDeseada": (
                self.solicitud.fecha_deseada.isoformat()
                if self.solicitud and self.solicitud.fecha_deseada
                else None
            ),
            "vigenciaDias": self.vigencia_dias,
            "subtotal": float(self.subtotal or 0),
            "impuestos": float(self.impuestos or 0),
            "total": float(self.total or 0),
            "anticipo": float(self.anticipo or 0),
            "saldo": float(self.saldo or 0),
            "notas": self.notas,
            "inventarioDescontado": bool(self.inventario_descontado),
            "creadoEn": iso(self.creado_en),
        }
        if incluir_items:
            data["items"] = [item.to_dict() for item in self.items]
        return data


class CotizacionItem(db.Model):
    __tablename__ = "cotizacion_items"

    id = db.Column(db.Integer, primary_key=True)
    cotizacion_id = db.Column(
        db.Integer, db.ForeignKey("cotizaciones.id", ondelete="CASCADE"), nullable=False
    )
    producto_id = db.Column(db.Integer, db.ForeignKey("productos.id"))
    descripcion = db.Column(db.String(200), nullable=False)
    especificaciones = db.Column(db.String(240))
    cantidad = db.Column(db.Numeric(12, 2), default=1, nullable=False)
    precio_unitario = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    importe = db.Column(db.Numeric(12, 2), default=0, nullable=False)

    cotizacion = db.relationship("Cotizacion", back_populates="items")
    producto = db.relationship("Producto", back_populates="cotizacion_items")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "productoId": self.producto_id,
            "descripcion": self.descripcion,
            "especificaciones": self.especificaciones,
            "cantidad": float(self.cantidad or 0),
            "precioUnitario": float(self.precio_unitario or 0),
            "importe": float(self.importe or 0),
        }


class Pedido(TimestampMixin, db.Model):
    __tablename__ = "pedidos"

    id = db.Column(db.Integer, primary_key=True)
    folio = db.Column(db.String(30), unique=True, nullable=False, index=True)
    cotizacion_id = db.Column(db.Integer, db.ForeignKey("cotizaciones.id"))
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=False)
    estado = db.Column(db.String(30), default="confirmado", nullable=False, index=True)
    prioridad = db.Column(db.String(20), default="media", nullable=False)
    fecha_pedido = db.Column(
        db.Date, default=date.today, nullable=False, index=True
    )
    fecha_entrega = db.Column(db.Date)
    nota_entrega = db.Column(db.String(240))
    entrega_confirmada_en = db.Column(db.DateTime)
    entrega_confirmada_por = db.Column(db.Integer, db.ForeignKey("usuarios.id"))
    subtotal = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    impuestos = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    total = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    anticipo = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    saldo = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    notas = db.Column(db.Text)
    creado_por = db.Column(db.Integer, db.ForeignKey("usuarios.id"))
    inventario_descontado = db.Column(db.Boolean, default=False, nullable=False)

    __table_args__ = (
        db.Index("ix_pedidos_creado_en", "creado_en"),
        db.Index("ix_pedidos_estado_fecha", "estado", "fecha_pedido"),
    )

    cotizacion = db.relationship("Cotizacion", back_populates="pedidos")
    cliente = db.relationship("Cliente", back_populates="pedidos")
    creador = db.relationship("Usuario", foreign_keys=[creado_por])
    confirmador_entrega = db.relationship(
        "Usuario", foreign_keys=[entrega_confirmada_por]
    )
    items = db.relationship("PedidoItem", back_populates="pedido", cascade="all, delete-orphan")
    pagos = db.relationship("Pago", back_populates="pedido", cascade="all, delete-orphan")
    orden_produccion = db.relationship(
        "OrdenProduccion", back_populates="pedido", uselist=False, cascade="all, delete-orphan"
    )

    def to_dict(self, incluir_detalle: bool = True) -> dict:
        data = {
            "id": self.id,
            "folio": self.folio,
            "cotizacionId": self.cotizacion_id,
            "clienteId": self.cliente_id,
            "cliente": self.cliente.nombre if self.cliente else None,
            "estado": self.estado,
            "prioridad": self.prioridad,
            "fechaPedido": self.fecha_pedido.isoformat() if self.fecha_pedido else None,
            "fechaEntrega": self.fecha_entrega.isoformat() if self.fecha_entrega else None,
            "notaEntrega": self.nota_entrega,
            "entregaConfirmadaEn": iso(self.entrega_confirmada_en),
            "entregaConfirmadaPorId": self.entrega_confirmada_por,
            "subtotal": float(self.subtotal or 0),
            "impuestos": float(self.impuestos or 0),
            "total": float(self.total or 0),
            "anticipo": float(self.anticipo or 0),
            "saldo": float(self.saldo or 0),
            "notas": self.notas,
            "inventarioDescontado": bool(self.inventario_descontado),
        }
        if incluir_detalle:
            data["items"] = [item.to_dict() for item in self.items]
            data["pagos"] = [pago.to_dict() for pago in self.pagos]
            data["entregaConfirmadaPor"] = (
                self.confirmador_entrega.nombre if self.confirmador_entrega else None
            )
            data["pagado"] = round(
                sum(float(pago.monto or 0) for pago in self.pagos if pago.confirmado), 2
            )
            data["ordenProduccion"] = (
                self.orden_produccion.to_dict() if self.orden_produccion else None
            )
        return data


class PedidoItem(db.Model):
    __tablename__ = "pedido_items"

    id = db.Column(db.Integer, primary_key=True)
    pedido_id = db.Column(
        db.Integer, db.ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False
    )
    producto_id = db.Column(db.Integer, db.ForeignKey("productos.id"))
    descripcion = db.Column(db.String(200), nullable=False)
    especificaciones = db.Column(db.String(240))
    cantidad = db.Column(db.Numeric(12, 2), default=1, nullable=False)
    precio_unitario = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    importe = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    archivo_diseno = db.Column(db.String(240))

    pedido = db.relationship("Pedido", back_populates="items")
    producto = db.relationship("Producto", back_populates="pedido_items")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "productoId": self.producto_id,
            "descripcion": self.descripcion,
            "especificaciones": self.especificaciones,
            "cantidad": float(self.cantidad or 0),
            "precioUnitario": float(self.precio_unitario or 0),
            "importe": float(self.importe or 0),
            "archivoDiseno": self.archivo_diseno,
        }


class Pago(db.Model):
    __tablename__ = "pagos"

    id = db.Column(db.Integer, primary_key=True)
    pedido_id = db.Column(
        db.Integer, db.ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tipo = db.Column(db.String(20), default="anticipo", nullable=False)
    metodo = db.Column(db.String(30), default="transferencia", nullable=False)
    monto = db.Column(db.Numeric(12, 2), nullable=False)
    referencia = db.Column(db.String(120))
    fecha_pago = db.Column(db.DateTime, default=utcnow, nullable=False, index=True)
    confirmado = db.Column(db.Boolean, default=False, nullable=False)
    registrado_por = db.Column(db.Integer, db.ForeignKey("usuarios.id"))

    pedido = db.relationship("Pedido", back_populates="pagos")
    usuario = db.relationship("Usuario")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "pedidoId": self.pedido_id,
            "tipo": self.tipo,
            "metodo": self.metodo,
            "monto": float(self.monto or 0),
            "referencia": self.referencia,
            "fechaPago": iso(self.fecha_pago),
            "confirmado": self.confirmado,
        }

"""Modelos SQLAlchemy de Llamma (26 tablas).

El esquema cubre seguridad/RBAC, clientes, catálogo y recetas, abastecimiento,
solicitudes públicas, cotizaciones, pedidos, producción y marketing.
Los estados se almacenan como cadenas para mantener compatibilidad entre
MySQL y SQLite; la validación se realiza en la capa de rutas.
"""

from __future__ import annotations

from datetime import datetime, timezone

from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db


def utcnow() -> datetime:
    """Fecha UTC naive, compatible con columnas DATETIME de MySQL."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(value: datetime | None) -> str | None:
    return value.isoformat(timespec="seconds") if value else None


class TimestampMixin:
    creado_en = db.Column(db.DateTime, default=utcnow, nullable=False)
    actualizado_en = db.Column(db.DateTime, default=utcnow, onupdate=utcnow, nullable=False)


# ---------------------------------------------------------------------------
# 1-5. Seguridad y RBAC
# ---------------------------------------------------------------------------


class Rol(db.Model):
    __tablename__ = "roles"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(40), unique=True, nullable=False)
    descripcion = db.Column(db.String(180))
    creado_en = db.Column(db.DateTime, default=utcnow, nullable=False)

    permisos = db.relationship(
        "Permiso", secondary="rol_permisos", back_populates="roles", lazy="selectin"
    )
    usuarios = db.relationship("Usuario", back_populates="rol")

    def to_dict(self, incluir_permisos: bool = True) -> dict:
        data = {"id": self.id, "nombre": self.nombre, "descripcion": self.descripcion}
        if incluir_permisos:
            data["permisos"] = [p.clave for p in self.permisos]
        return data


class Permiso(db.Model):
    __tablename__ = "permisos"

    id = db.Column(db.Integer, primary_key=True)
    clave = db.Column(db.String(80), unique=True, nullable=False)
    modulo = db.Column(db.String(40), nullable=False)
    descripcion = db.Column(db.String(180))

    roles = db.relationship("Rol", secondary="rol_permisos", back_populates="permisos")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "clave": self.clave,
            "modulo": self.modulo,
            "descripcion": self.descripcion,
        }


class RolPermiso(db.Model):
    __tablename__ = "rol_permisos"

    rol_id = db.Column(db.Integer, db.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    permiso_id = db.Column(
        db.Integer, db.ForeignKey("permisos.id", ondelete="CASCADE"), primary_key=True
    )


class Usuario(TimestampMixin, db.Model):
    __tablename__ = "usuarios"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(120), nullable=False)
    correo = db.Column(db.String(160), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    telefono = db.Column(db.String(30))
    rol_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)
    activo = db.Column(db.Boolean, default=True, nullable=False)
    ultimo_acceso = db.Column(db.DateTime)

    rol = db.relationship("Rol", back_populates="usuarios", lazy="joined")
    sesiones = db.relationship(
        "SesionUsuario", back_populates="usuario", cascade="all, delete-orphan"
    )
    movimientos = db.relationship("MovimientoInventario", back_populates="usuario")
    cotizaciones = db.relationship("Cotizacion", back_populates="usuario")
    ordenes_compra = db.relationship("OrdenCompra", back_populates="creador")
    ordenes_produccion = db.relationship("OrdenProduccion", back_populates="responsable")
    controles_calidad = db.relationship("ControlCalidad", back_populates="revisor")
    actividades_marketing = db.relationship("ActividadMarketing", back_populates="creador")

    def set_password(self, raw: str) -> None:
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw: str) -> bool:
        return check_password_hash(self.password_hash, raw)

    @property
    def permisos(self) -> list[str]:
        return [permiso.clave for permiso in self.rol.permisos] if self.rol else []

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "correo": self.correo,
            "telefono": self.telefono,
            "rol": self.rol.nombre if self.rol else None,
            "rolId": self.rol_id,
            "permisos": self.permisos,
            "activo": self.activo,
            "ultimoAcceso": iso(self.ultimo_acceso),
        }


class SesionUsuario(db.Model):
    __tablename__ = "sesiones_usuario"

    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(
        db.Integer, db.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash = db.Column(db.String(128), unique=True, nullable=False, index=True)
    ip = db.Column(db.String(64))
    user_agent = db.Column(db.String(255))
    creado_en = db.Column(db.DateTime, default=utcnow, nullable=False)
    ultimo_uso = db.Column(db.DateTime, default=utcnow, nullable=False)
    expira_en = db.Column(db.DateTime, nullable=False)
    revocado = db.Column(db.Boolean, default=False, nullable=False)

    usuario = db.relationship("Usuario", back_populates="sesiones")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "usuarioId": self.usuario_id,
            "ip": self.ip,
            "userAgent": self.user_agent,
            "creadoEn": iso(self.creado_en),
            "ultimoUso": iso(self.ultimo_uso),
            "expiraEn": iso(self.expira_en),
            "revocado": self.revocado,
        }


# ---------------------------------------------------------------------------
# 6-9. Clientes, productos y recetas
# ---------------------------------------------------------------------------


class Cliente(TimestampMixin, db.Model):
    __tablename__ = "clientes"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(140), nullable=False)
    empresa = db.Column(db.String(140))
    correo = db.Column(db.String(160), unique=True, nullable=False, index=True)
    telefono = db.Column(db.String(30))
    direccion = db.Column(db.String(240))
    rfc = db.Column(db.String(20))
    segmento = db.Column(db.String(30), default="particular", nullable=False)
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
            data["totalFacturado"] = round(sum(p.total for p in pedidos), 2)
        return data


class Producto(TimestampMixin, db.Model):
    __tablename__ = "productos"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(160), unique=True, nullable=False)
    descripcion = db.Column(db.Text)
    categoria = db.Column(db.String(40), default="otro", nullable=False)
    linea_produccion = db.Column(db.String(40), default="gran-formato", nullable=False)
    precio_base = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    unidad_venta = db.Column(db.String(20), default="pieza", nullable=False)
    icono = db.Column(db.String(60), default="bi-box-seam")
    publicado = db.Column(db.Boolean, default=True, nullable=False)
    activo = db.Column(db.Boolean, default=True, nullable=False)

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


# ---------------------------------------------------------------------------
# 10-14. Abastecimiento
# ---------------------------------------------------------------------------


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
    nombre = db.Column(db.String(160), nullable=False)
    categoria = db.Column(db.String(40), default="otro", nullable=False)
    unidad_medida = db.Column(db.String(20), default="pieza", nullable=False)
    stock_actual = db.Column(db.Numeric(12, 4), default=0, nullable=False)
    stock_minimo = db.Column(db.Numeric(12, 4), default=0, nullable=False)
    stock_maximo = db.Column(db.Numeric(12, 4), default=0, nullable=False)
    costo_unitario = db.Column(db.Numeric(12, 4), default=0, nullable=False)
    proveedor_id = db.Column(db.Integer, db.ForeignKey("proveedores.id"))
    activo = db.Column(db.Boolean, default=True, nullable=False)

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
    tipo = db.Column(db.String(20), nullable=False)
    cantidad = db.Column(db.Numeric(12, 4), nullable=False)
    unidad_medida = db.Column(db.String(20), nullable=False)
    costo_unitario = db.Column(db.Numeric(12, 4), default=0, nullable=False)
    referencia = db.Column(db.String(80))
    motivo = db.Column(db.String(240))
    usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"))
    creado_en = db.Column(db.DateTime, default=utcnow, nullable=False)

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


class OrdenCompra(TimestampMixin, db.Model):
    __tablename__ = "ordenes_compra"

    id = db.Column(db.Integer, primary_key=True)
    folio = db.Column(db.String(30), unique=True, nullable=False, index=True)
    proveedor_id = db.Column(db.Integer, db.ForeignKey("proveedores.id"), nullable=False)
    estado = db.Column(db.String(30), default="pendiente", nullable=False)
    fecha_emision = db.Column(db.Date, default=lambda: utcnow().date(), nullable=False)
    fecha_entrega = db.Column(db.Date)
    subtotal = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    impuestos = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    total = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    notas = db.Column(db.Text)
    creado_por = db.Column(db.Integer, db.ForeignKey("usuarios.id"))

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


# ---------------------------------------------------------------------------
# 15-17. Solicitudes públicas
# ---------------------------------------------------------------------------


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

    items = db.relationship(
        "SolicitudItem", back_populates="solicitud", cascade="all, delete-orphan"
    )
    archivos = db.relationship(
        "SolicitudArchivo", back_populates="solicitud", cascade="all, delete-orphan"
    )
    cotizaciones = db.relationship("Cotizacion", back_populates="solicitud")

    def to_dict(self, incluir_detalle: bool = True) -> dict:
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
            "nombreGuardado": self.nombre_guardado,
            "url": f"/api/archivos/{self.id}",
        }


# ---------------------------------------------------------------------------
# 18-22. Cotizaciones, pedidos y pagos
# ---------------------------------------------------------------------------


class Cotizacion(TimestampMixin, db.Model):
    __tablename__ = "cotizaciones"

    id = db.Column(db.Integer, primary_key=True)
    folio = db.Column(db.String(30), unique=True, nullable=False, index=True)
    solicitud_id = db.Column(db.Integer, db.ForeignKey("solicitudes_cotizacion.id"))
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"))
    estado = db.Column(db.String(30), default="borrador", nullable=False)
    fecha_emision = db.Column(db.Date, default=lambda: utcnow().date(), nullable=False)
    vigencia_dias = db.Column(db.Integer, default=15, nullable=False)
    subtotal = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    impuestos = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    total = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    anticipo = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    saldo = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    notas = db.Column(db.Text)

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
            "vigenciaDias": self.vigencia_dias,
            "subtotal": float(self.subtotal or 0),
            "impuestos": float(self.impuestos or 0),
            "total": float(self.total or 0),
            "anticipo": float(self.anticipo or 0),
            "saldo": float(self.saldo or 0),
            "notas": self.notas,
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
    fecha_pedido = db.Column(db.Date, default=lambda: utcnow().date(), nullable=False)
    fecha_entrega = db.Column(db.Date)
    subtotal = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    impuestos = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    total = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    anticipo = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    saldo = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    notas = db.Column(db.Text)
    creado_por = db.Column(db.Integer, db.ForeignKey("usuarios.id"))

    cotizacion = db.relationship("Cotizacion", back_populates="pedidos")
    cliente = db.relationship("Cliente", back_populates="pedidos")
    creador = db.relationship("Usuario", foreign_keys=[creado_por])
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
            "subtotal": float(self.subtotal or 0),
            "impuestos": float(self.impuestos or 0),
            "total": float(self.total or 0),
            "anticipo": float(self.anticipo or 0),
            "saldo": float(self.saldo or 0),
            "notas": self.notas,
        }
        if incluir_detalle:
            data["items"] = [item.to_dict() for item in self.items]
            data["pagos"] = [pago.to_dict() for pago in self.pagos]
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
    fecha_pago = db.Column(db.DateTime, default=utcnow, nullable=False)
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


# ---------------------------------------------------------------------------
# 23-25. Producción y calidad
# ---------------------------------------------------------------------------


class OrdenProduccion(TimestampMixin, db.Model):
    __tablename__ = "ordenes_produccion"

    id = db.Column(db.Integer, primary_key=True)
    pedido_id = db.Column(
        db.Integer, db.ForeignKey("pedidos.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    etapa = db.Column(db.String(30), default="diseno", nullable=False)
    estado = db.Column(db.String(30), default="pendiente", nullable=False, index=True)
    responsable_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"))
    fecha_inicio = db.Column(db.DateTime)
    fecha_fin = db.Column(db.DateTime)
    observaciones = db.Column(db.Text)

    pedido = db.relationship("Pedido", back_populates="orden_produccion")
    responsable = db.relationship("Usuario", back_populates="ordenes_produccion")
    etapas = db.relationship(
        "ProduccionEtapa", back_populates="orden", cascade="all, delete-orphan"
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


# ---------------------------------------------------------------------------
# 26. Marketing
# ---------------------------------------------------------------------------


class ActividadMarketing(TimestampMixin, db.Model):
    __tablename__ = "actividades_marketing"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(180), nullable=False)
    canal = db.Column(db.String(40), default="redes-sociales", nullable=False)
    fecha_inicio = db.Column(db.Date, nullable=False)
    fecha_fin = db.Column(db.Date)
    presupuesto = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    inversion_real = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    ingresos_atribuidos = db.Column(db.Numeric(12, 2), default=0, nullable=False)
    estado = db.Column(db.String(30), default="planeada", nullable=False)
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


# ---------------------------------------------------------------------------
# Totales del esquema
# ---------------------------------------------------------------------------

TABLAS = [
    Rol,
    Permiso,
    RolPermiso,
    Usuario,
    SesionUsuario,
    Cliente,
    Producto,
    Receta,
    RecetaComponente,
    Proveedor,
    MateriaPrima,
    MovimientoInventario,
    OrdenCompra,
    OrdenCompraItem,
    SolicitudCotizacion,
    SolicitudItem,
    SolicitudArchivo,
    Cotizacion,
    CotizacionItem,
    Pedido,
    PedidoItem,
    Pago,
    OrdenProduccion,
    ProduccionEtapa,
    ControlCalidad,
    ActividadMarketing,
]

assert len(TABLAS) == 26, "El esquema de Llamma debe contener 26 tablas"

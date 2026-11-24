"""Seguridad, roles, permisos, usuarios y sesiones."""

from __future__ import annotations

from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db
from models.base import TimestampMixin, iso, utcnow


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

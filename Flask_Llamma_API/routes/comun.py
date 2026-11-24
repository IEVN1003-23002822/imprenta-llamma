"""Helpers compartidos por los endpoints internos del ERP.

Aquí viven las reglas que cruzan dominios: cálculo de totales, alta o
actualización de clientes, construcción de partidas y descuento de insumos.
Cada módulo de rutas importa solo lo que necesita.
"""

from __future__ import annotations

from flask import current_app
from sqlalchemy import func

from extensions import db
from models import (
    Cliente,
    Cotizacion,
    CotizacionItem,
    MovimientoInventario,
    Pedido,
    Producto,
    SolicitudCotizacion,
    Usuario,
)
from routes.helpers import campo, correo_valido, lista_items
from utils import generar_folio, parse_decimal, parse_int


def totales(subtotal: float) -> dict:
    """Aplica IVA y anticipo configurados sobre un subtotal."""
    iva = current_app.config["IVA_RATE"]
    anticipo_rate = current_app.config["ANTICIPO_RATE"]
    subtotal = round(subtotal, 2)
    impuestos = round(subtotal * iva, 2)
    total = round(subtotal + impuestos, 2)
    anticipo = round(total * anticipo_rate, 2)
    return {
        "subtotal": subtotal,
        "impuestos": impuestos,
        "total": total,
        "anticipo": anticipo,
        "saldo": round(total - anticipo, 2),
    }


def cliente_por_correo(correo: str) -> Cliente | None:
    return Cliente.query.filter(func.lower(Cliente.correo) == correo.lower()).first()


def upsert_cliente(
    *,
    nombre: str,
    correo: str,
    telefono: str | None = None,
    empresa: str | None = None,
    segmento: str = "particular",
    rfc: str | None = None,
    direccion: str | None = None,
) -> Cliente:
    """Devuelve el cliente del correo o lo crea con los datos disponibles."""
    cliente = cliente_por_correo(correo)
    if cliente:
        cliente.nombre = nombre or cliente.nombre
        cliente.telefono = telefono or cliente.telefono
        cliente.empresa = empresa or cliente.empresa
        cliente.direccion = direccion or cliente.direccion
        cliente.rfc = rfc or cliente.rfc
        return cliente

    cliente = Cliente(
        nombre=nombre[:140],
        correo=correo[:160],
        telefono=(telefono or "")[:30] or None,
        empresa=(empresa or "")[:140] or None,
        segmento=(segmento or "particular")[:30],
        rfc=(rfc or "")[:20] or None,
        direccion=(direccion or "")[:240] or None,
    )
    db.session.add(cliente)
    return cliente


def partidas_a_cotizacion(items: list, data: dict) -> tuple[list[CotizacionItem], float]:
    """Convierte partidas del frontend en renglones de cotización."""
    resultantes: list[CotizacionItem] = []
    subtotal = 0.0

    for bruto in items:
        if not isinstance(bruto, dict):
            continue
        producto = None
        producto_id = campo(bruto, "productoId", "producto_id")
        if producto_id:
            producto = Producto.query.get(parse_int(producto_id))

        cantidad = max(parse_decimal(campo(bruto, "cantidad", default=1), 1), 0.01)
        precio = campo(bruto, "precioUnitario", "precio_unitario")
        if precio is None:
            if producto:
                precio = float(producto.precio_base or 0)
            else:
                precio = campo(bruto, "precioEstimado", "precio_estimado", default=0)
        precio = max(parse_decimal(precio, 0), 0)
        importe = round(precio * cantidad, 2)

        descripcion = str(
            campo(bruto, "descripcion", "nombreProducto", "nombre_producto", default="")
            or (producto.nombre if producto else "Concepto")
        ).strip()

        resultantes.append(
            CotizacionItem(
                producto_id=producto.id if producto else None,
                descripcion=descripcion[:200],
                especificaciones=(
                    str(campo(bruto, "especificaciones", "detalle", default="") or "")[:240] or None
                ),
                cantidad=cantidad,
                precio_unitario=precio,
                importe=importe,
            )
        )
        subtotal += importe

    return resultantes, round(subtotal, 2)


def crear_cotizacion(
    solicitud: SolicitudCotizacion | None, data: dict, usuario: Usuario
) -> Cotizacion:
    """Crea una cotización desde una solicitud o desde datos sueltos."""
    if solicitud:
        nombre = str(
            campo(data, "nombreCliente", "nombre", default=solicitud.nombre_cliente)
        ).strip()
        correo = str(campo(data, "correo", "email", default=solicitud.correo)).strip().lower()
        telefono = campo(data, "telefono", default=solicitud.telefono)
        empresa = campo(data, "empresa", default=solicitud.empresa)
        segmento = str(campo(data, "segmento", default=solicitud.segmento))
        cliente = upsert_cliente(
            nombre=nombre,
            correo=correo,
            telefono=telefono,
            empresa=empresa,
            segmento=segmento,
            rfc=campo(data, "rfc"),
            direccion=campo(data, "direccion"),
        )
        items_brutos = lista_items(data) or [
            {
                "productoId": item.producto_id,
                "descripcion": item.nombre_producto,
                "especificaciones": item.especificaciones,
                "cantidad": float(item.cantidad),
                "precioEstimado": float(item.precio_estimado or 0),
            }
            for item in solicitud.items
        ]
    else:
        cliente_id = parse_int(campo(data, "clienteId", "cliente_id"))
        cliente = Cliente.query.get(cliente_id) if cliente_id else None
        if not cliente:
            correo = str(campo(data, "correo", "email", default="")).strip().lower()
            nombre = str(campo(data, "nombreCliente", "nombre", default="")).strip()
            if not correo_valido(correo) or not nombre:
                raise ValueError("Se requiere clienteId o los datos de un cliente nuevo")
            cliente = upsert_cliente(
                nombre=nombre,
                correo=correo,
                telefono=campo(data, "telefono"),
                empresa=campo(data, "empresa"),
                segmento=str(campo(data, "segmento", default="particular")),
                rfc=campo(data, "rfc"),
                direccion=campo(data, "direccion"),
            )
        items_brutos = lista_items(data)

    if not items_brutos:
        raise ValueError("La cotización necesita al menos una partida")

    items, subtotal = partidas_a_cotizacion(items_brutos, data)
    if not items:
        raise ValueError("Las partidas enviadas no son válidas")

    cotizacion = Cotizacion(
        folio=generar_folio("COT", Cotizacion),
        solicitud_id=solicitud.id if solicitud else None,
        cliente_id=cliente.id,
        usuario_id=usuario.id,
        estado=str(campo(data, "estado", default="borrador")),
        vigencia_dias=parse_int(campo(data, "vigenciaDias", "vigencia_dias"), 15) or 15,
        notas=str(campo(data, "notas", "mensaje", default="") or "") or None,
        **totales(subtotal),
    )
    cotizacion.items = items
    db.session.add(cotizacion)

    if solicitud:
        solicitud.estado = "cotizada"

    db.session.flush()
    return cotizacion


class DescuentoInventarioError(ValueError):
    """Error de negocio al vincular productos o validar stock."""

    def __init__(self, mensaje: str, detalles: list[dict] | None = None):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.detalles = detalles or []


class InventarioInsuficiente(DescuentoInventarioError):
    """El documento requiere más stock del disponible en uno o más insumos."""

    def __init__(self, mensaje: str, detalles: list[dict]):
        super().__init__(mensaje, detalles)


def _descontar_inventario(
    cotizacion_o_pedido: Cotizacion | Pedido,
    usuario: Usuario,
) -> dict:
    """Valida y descuenta insumos de una cotización o pedido.

    Acumula el requerimiento de todas las partidas, valida el stock completo y
    solo entonces modifica existencias y registra movimientos. Devuelve el
    resumen para que la API y la UI muestren el resultado. La bandera
    `inventario_descontado` evita descuentos duplicados.
    """
    documento = cotizacion_o_pedido
    if getattr(documento, "inventario_descontado", False):
        return {"descontados": [], "alertas": []}

    requerimientos: dict[int, dict] = {}

    for item in documento.items:
        producto = item.producto
        if not producto and item.producto_id:
            producto = Producto.query.get(item.producto_id)
        if not producto:
            nombre = (item.descripcion or "").strip()
            producto = (
                Producto.query.filter(func.lower(Producto.nombre) == nombre.lower()).first()
                if nombre
                else None
            )
            if not producto:
                raise DescuentoInventarioError(
                    f"No se encontró el producto '{nombre or item.descripcion}' para "
                    "descontar inventario."
                )
            item.producto_id = producto.id
            item.producto = producto

        receta = producto.receta
        if not receta:
            continue

        rendimiento = float(receta.rendimiento or 1) or 1
        for componente in receta.componentes:
            materia = componente.materia_prima
            if not materia:
                continue
            requerido = (
                float(componente.cantidad)
                * float(item.cantidad)
                * (1 + float(componente.desperdicio_porcentaje or 0) / 100)
                / rendimiento
            )
            if requerido <= 0:
                continue
            registro = requerimientos.setdefault(
                materia.id,
                {"materia": materia, "cantidad": 0.0, "productos": set()},
            )
            registro["cantidad"] += requerido
            registro["productos"].add(producto.nombre)

    faltantes = []
    for registro in requerimientos.values():
        materia = registro["materia"]
        requerido = registro["cantidad"]
        disponible = max(float(materia.stock_actual or 0), 0)
        if requerido > disponible + 1e-9:
            producto_nombre = sorted(registro["productos"])[0]
            faltantes.append(
                {
                    "materiaPrimaId": materia.id,
                    "materia": materia.nombre,
                    "producto": producto_nombre,
                    "unidadMedida": materia.unidad_medida,
                    "requerido": round(requerido, 4),
                    "disponible": round(disponible, 4),
                    "faltante": round(requerido - disponible, 4),
                }
            )

    if faltantes:
        primero = faltantes[0]
        raise InventarioInsuficiente(
            f"Stock insuficiente de {primero['materia']} para cotizar "
            f"{primero['producto']}",
            faltantes,
        )

    resultado = {"descontados": [], "alertas": []}
    for registro in requerimientos.values():
        materia = registro["materia"]
        cantidad = round(registro["cantidad"], 4)
        disponible = max(float(materia.stock_actual or 0), 0)
        restante = round(disponible - cantidad, 4)
        materia.stock_actual = restante
        db.session.add(
            MovimientoInventario(
                materia_prima_id=materia.id,
                tipo="salida",
                cantidad=cantidad,
                unidad_medida=materia.unidad_medida,
                costo_unitario=materia.costo_unitario,
                referencia=documento.folio,
                motivo=f"Consumo por producción de {documento.folio}",
                usuario_id=usuario.id,
            )
        )
        bajo_stock = materia.bajo_stock
        resultado["descontados"].append(
            {
                "materia": materia.nombre,
                "cantidad": cantidad,
                "stock_restante": restante,
                "bajo_stock": bool(bajo_stock),
            }
        )
        if bajo_stock:
            resultado["alertas"].append(f"{materia.nombre} quedó en stock bajo")

    documento.inventario_descontado = True
    return resultado

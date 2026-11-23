"""Datos de demostración para Llamma.

Uso:
    flask --app app init-db
    flask --app app seed-db
"""

from __future__ import annotations

import os
from datetime import date, timedelta

from flask import current_app

from extensions import db
from models import (
    ActividadMarketing,
    Cliente,
    ControlCalidad,
    Cotizacion,
    CotizacionItem,
    MateriaPrima,
    MensajeChat,
    MovimientoInventario,
    OrdenCompra,
    OrdenCompraItem,
    OrdenProduccion,
    Pago,
    Pedido,
    PedidoItem,
    Permiso,
    ProduccionEtapa,
    Producto,
    Proveedor,
    Receta,
    RecetaComponente,
    Rol,
    RolPermiso,
    SolicitudArchivo,
    SolicitudCotizacion,
    SolicitudItem,
    Usuario,
    utcnow,
)

CLAVE_DEMO = "llamma2026"

PERMISOS = [
    ("ventas.ver", "ventas", "Ver cotizaciones y pedidos"),
    ("ventas.gestionar", "ventas", "Crear y editar cotizaciones y pedidos"),
    ("solicitudes.ver", "solicitudes", "Ver la bandeja de solicitudes"),
    ("solicitudes.gestionar", "solicitudes", "Atender y convertir solicitudes"),
    ("produccion.ver", "produccion", "Ver el tablero de producción"),
    ("produccion.gestionar", "produccion", "Actualizar etapas y calidad"),
    ("inventario.ver", "inventario", "Ver inventario y compras"),
    ("inventario.gestionar", "inventario", "Ajustar stock y órdenes de compra"),
    ("clientes.ver", "clientes", "Ver el directorio de clientes"),
    ("clientes.gestionar", "clientes", "Crear y editar clientes"),
    ("marketing.ver", "marketing", "Ver campañas"),
    ("marketing.gestionar", "marketing", "Crear y editar campañas"),
    ("config.ver", "configuracion", "Ver usuarios y roles"),
    ("config.gestionar", "configuracion", "Administrar usuarios y roles"),
]

ROLES = {
    "admin": [clave for clave, _, _ in PERMISOS],
    "ventas": [
        "ventas.ver",
        "ventas.gestionar",
        "solicitudes.ver",
        "solicitudes.gestionar",
        "clientes.ver",
        "clientes.gestionar",
        "produccion.ver",
        "inventario.ver",
    ],
    "produccion": ["produccion.ver", "produccion.gestionar", "inventario.ver", "ventas.ver"],
    "inventario": ["inventario.ver", "inventario.gestionar", "produccion.ver", "ventas.ver"],
    "marketing": ["marketing.ver", "marketing.gestionar", "clientes.ver", "ventas.ver"],
}

USUARIOS = [
    ("Ana Torres", "ana@llamma.mx", "admin", "55 1234 5678"),
    ("Diego Salas", "diego@llamma.mx", "ventas", "55 2345 6789"),
    ("Mariana Ruiz", "mariana@llamma.mx", "produccion", "55 3456 7890"),
    ("Iván Córdoba", "ivan@llamma.mx", "inventario", "55 4567 8901"),
    ("Paola Méndez", "paola@llamma.mx", "marketing", "55 5678 9012"),
]

CLIENTES = [
    ("Alma Creativa", "Ana Torres", "ana@almacreativa.mx", "55 1234 5678", "corporativo", "AC", "Av. Álvaro Obregón 120, Roma Norte, CDMX", "ACM220114H23"),
    ("Estudio Nómada", "Luis Barrera", "luis@estudionomada.mx", "55 2345 6789", "pyme", "EN", "Colima 240, Roma Norte, CDMX", "ENO240118P45"),
    ("Café Origen", "Renata Solís", "renata@cafeorigen.mx", "55 3456 7890", "eventos", "CO", "Orizaba 85, Roma Norte, CDMX", "COR210503M12"),
    ("Grupo Altura", "Sergio Nava", "sergio@grupodigital.mx", "55 4567 8901", "corporativo", "GA", "Paseo de la Reforma 505, Cuauhtémoc, CDMX", "GAL190822K78"),
    ("Papelería Lumen", "Carla Domínguez", "carla@papelerialumen.mx", "55 5678 9012", "escolar", "PL", "Amsterdam 130, Condesa, CDMX", "PLU200317Q34"),
    ("Bistró Aurora", "Mario Esquivel", "mario@bistroaurora.mx", "55 6789 0123", "eventos", "BA", "Mazatlán 45, Condesa, CDMX", "BAU220506L90"),
]

PROVEEDORES = [
    ("Gran Formato SA", "Laura Vega", "55 1111 2222", "ventas@granformato.mx", "Crédito 30 días"),
    ("ColorLab MX", "Hugo Pineda", "55 3333 4444", "hola@colorlab.mx", "Contado"),
    ("Papelera Central", "Nadia Ríos", "55 5555 6666", "pedidos@papeleracentral.mx", "Crédito 15 días"),
    ("Acabados Pro", "Omar Lira", "55 7777 8888", "contacto@acabadospro.mx", "Contado"),
]

MATERIAS = [
    ("Lona Frontlit 510g", "lona", "m2", 34, 60, 300, 118, "Gran Formato SA"),
    ("Tinta Eco-solvente CMYK", "tinta", "litro", 0.4, 1, 12, 1180, "ColorLab MX"),
    ("Papel Couché 300g", "papel", "hoja", 180, 300, 2000, 4.2, "Papelera Central"),
    ("Laminado en frío", "laminado", "ml", 8, 20, 80, 210, "Acabados Pro"),
    ("Perfil de aluminio", "perfil", "pieza", 120, 40, 300, 95, "Gran Formato SA"),
    ("Vinil adhesivo brillante", "vinil", "m2", 90, 30, 200, 95, "Gran Formato SA"),
    ("Tela algodón peinado", "textil", "kg", 45, 20, 120, 285, "Gran Formato SA"),
]

PRODUCTOS = [
    {
        "nombre": "Roll-up premium 85 × 200 cm",
        "descripcion": "Display enrollable con lona Frontlit, estructura de aluminio y estuche.",
        "categoria": "display",
        "linea": "gran-formato",
        "precio": 3850,
        "unidad": "pieza",
        "icono": "bi-easel2",
        "imagen": "assets/images/catalogo/gran-formato/roll-up-premium.webp",
        "receta": {"rendimiento": 1, "unidad": "pieza", "costo": 1750, "tiempo": 90, "componentes": [("Lona Frontlit 510g", 2.2, "m2", 5), ("Perfil de aluminio", 2, "pieza", 0)]},
    },
    {
        "nombre": "Lona Frontlit impresa",
        "descripcion": "Impresión gran formato CMYK. Precio base 1 m × 1 m = $220; cada m² adicional $120.",
        "categoria": "display",
        "linea": "gran-formato",
        "precio": 220,
        "unidad": "m2",
        "icono": "bi-bounding-box",
        "imagen": "assets/images/catalogo/gran-formato/lona-frontlit-impresa.webp",
        "receta": {"rendimiento": 1, "unidad": "m2", "costo": 140, "tiempo": 25, "componentes": [("Lona Frontlit 510g", 1.05, "m2", 5), ("Tinta Eco-solvente CMYK", 0.02, "litro", 3)]},
    },
    {
        "nombre": "Playera DTF 29 × 29 cm",
        "descripcion": "Camiseta de algodón con estampado DTF a todo color. Impresión de 29 × 29 cm.",
        "categoria": "textil",
        "linea": "textil",
        "precio": 220,
        "unidad": "pieza",
        "icono": "bi-person-standing-dress",
        "imagen": "assets/images/catalogo/textil/playera-dtf-29x29.webp",
        "receta": {"rendimiento": 1, "unidad": "pieza", "costo": 95, "tiempo": 12, "componentes": [("Tela algodón peinado", 0.25, "kg", 8), ("Tinta Eco-solvente CMYK", 0.015, "litro", 5)]},
    },
    {
        "nombre": "Playera DTF menor a 29 × 29 cm",
        "descripcion": "Camiseta de algodón con estampado DTF a todo color. Impresión menor a 29 × 29 cm.",
        "categoria": "textil",
        "linea": "textil",
        "precio": 200,
        "unidad": "pieza",
        "icono": "bi-person-standing-dress",
        "imagen": "assets/images/catalogo/textil/playera-dtf-menor-29x29.webp",
        "receta": {"rendimiento": 1, "unidad": "pieza", "costo": 90, "tiempo": 12, "componentes": [("Tela algodón peinado", 0.25, "kg", 8), ("Tinta Eco-solvente CMYK", 0.012, "litro", 5)]},
    },
    {
        "nombre": "Tote bag de manta",
        "descripcion": "Bolsa de manta 35 × 40 cm con asa reforzada y estampado DTF.",
        "categoria": "promocional",
        "linea": "promocionales",
        "precio": 110,
        "unidad": "pieza",
        "icono": "bi-bag-heart",
        "imagen": "assets/images/catalogo/textil/tote-bag-manta.webp",
        "receta": {"rendimiento": 1, "unidad": "pieza", "costo": 48, "tiempo": 10, "componentes": [("Tela algodón peinado", 0.3, "kg", 6), ("Tinta Eco-solvente CMYK", 0.01, "litro", 4)]},
    },
    {
        "nombre": "Taza cerámica sublimada",
        "descripcion": "Taza de 11 oz con sublimación full color y caja individual. Precio unitario.",
        "categoria": "promocional",
        "linea": "promocionales",
        "precio": 85,
        "unidad": "pieza",
        "icono": "bi-cup-hot",
        "imagen": "assets/images/catalogo/promocionales/taza-ceramica-sublimada.webp",
        "receta": {"rendimiento": 1, "unidad": "pieza", "costo": 42, "tiempo": 6, "componentes": [("Tinta Eco-solvente CMYK", 0.008, "litro", 4)]},
    },
    {
        "nombre": "Sticker troquelado",
        "descripcion": "Vinil adhesivo brillante con corte de precisión, 8 × 8 cm.",
        "categoria": "promocional",
        "linea": "promocionales",
        "precio": 35,
        "unidad": "pieza",
        "icono": "bi-stickies",
        "imagen": "assets/images/catalogo/promocionales/sticker-troquelado.webp",
        "receta": {"rendimiento": 1, "unidad": "pieza", "costo": 12, "tiempo": 3, "componentes": [("Vinil adhesivo brillante", 0.02, "m2", 10), ("Laminado en frío", 0.05, "ml", 5)]},
    },
    {
        "nombre": "Tarjetas Couché 300g",
        "descripcion": "Paquete de 100 tarjetas de presentación en Couché 300g con laminado mate.",
        "categoria": "papeleria",
        "linea": "papeleria",
        "precio": 850,
        "unidad": "pieza",
        "icono": "bi-postcard",
        "imagen": "assets/images/catalogo/papeleria/tarjetas-couche-300g.webp",
        "receta": {"rendimiento": 1, "unidad": "pieza", "costo": 320, "tiempo": 45, "componentes": [("Papel Couché 300g", 100, "hoja", 6), ("Laminado en frío", 0.5, "ml", 5), ("Tinta Eco-solvente CMYK", 0.02, "litro", 3)]},
    },
]


def _totales(subtotal: float) -> dict:
    impuestos = round(subtotal * 0.16, 2)
    total = round(subtotal + impuestos, 2)
    anticipo = round(total * 0.5, 2)
    return {
        "subtotal": round(subtotal, 2),
        "impuestos": impuestos,
        "total": total,
        "anticipo": anticipo,
        "saldo": round(total - anticipo, 2),
    }


def seed_database() -> None:
    if Usuario.query.count() > 0:
        print("La base ya contiene datos. Seed omitido.")
        return

    # --- Seguridad -------------------------------------------------------
    permisos: dict[str, Permiso] = {}
    for clave, modulo, descripcion in PERMISOS:
        permiso = Permiso(clave=clave, modulo=modulo, descripcion=descripcion)
        db.session.add(permiso)
        permisos[clave] = permiso

    roles: dict[str, Rol] = {}
    for nombre, claves in ROLES.items():
        rol = Rol(nombre=nombre, descripcion=nombre.capitalize())
        db.session.add(rol)
        roles[nombre] = rol
        for clave in claves:
            rol.permisos.append(permisos[clave])

    db.session.flush()

    usuarios: dict[str, Usuario] = {}
    for nombre, correo, rol, telefono in USUARIOS:
        usuario = Usuario(nombre=nombre, correo=correo, telefono=telefono, rol_id=roles[rol].id)
        usuario.set_password(CLAVE_DEMO)
        db.session.add(usuario)
        usuarios[correo] = usuario

    # --- Clientes --------------------------------------------------------
    clientes: dict[str, Cliente] = {}
    for nombre, contacto, correo, telefono, segmento, _siglas, direccion, rfc in CLIENTES:
        cliente = Cliente(
            nombre=nombre,
            empresa=nombre,
            correo=correo,
            telefono=telefono,
            direccion=direccion,
            rfc=rfc,
            segmento=segmento,
            notas=f"Contacto: {contacto}",
        )
        db.session.add(cliente)
        clientes[nombre] = cliente

    # --- Proveedores y materias primas ----------------------------------
    proveedores: dict[str, Proveedor] = {}
    for nombre, contacto, telefono, correo, condiciones in PROVEEDORES:
        proveedor = Proveedor(
            nombre=nombre,
            contacto=contacto,
            telefono=telefono,
            correo=correo,
            condiciones_pago=condiciones,
        )
        db.session.add(proveedor)
        proveedores[nombre] = proveedor

    db.session.flush()

    materias: dict[str, MateriaPrima] = {}
    for nombre, categoria, unidad, actual, minimo, maximo, costo, proveedor in MATERIAS:
        materia = MateriaPrima(
            nombre=nombre,
            categoria=categoria,
            unidad_medida=unidad,
            stock_actual=actual,
            stock_minimo=minimo,
            stock_maximo=maximo,
            costo_unitario=costo,
            proveedor_id=proveedores[proveedor].id,
        )
        db.session.add(materia)
        materias[nombre] = materia

    db.session.flush()

    # --- Productos y recetas --------------------------------------------
    productos: dict[str, Producto] = {}
    for definicion in PRODUCTOS:
        producto = Producto(
            nombre=definicion["nombre"],
            descripcion=definicion["descripcion"],
            categoria=definicion["categoria"],
            linea_produccion=definicion["linea"],
            precio_base=definicion["precio"],
            unidad_venta=definicion["unidad"],
            icono=definicion["icono"],
            imagen_url=definicion.get("imagen"),
        )
        receta_def = definicion["receta"]
        receta = Receta(
            nombre=f"Receta {definicion['nombre']}",
            rendimiento=receta_def["rendimiento"],
            unidad_rendimiento=receta_def["unidad"],
            costo_estimado=receta_def["costo"],
            tiempo_produccion_min=receta_def["tiempo"],
        )
        for materia_nombre, cantidad, unidad, desperdicio in receta_def["componentes"]:
            receta.componentes.append(
                RecetaComponente(
                    materia_prima_id=materias[materia_nombre].id,
                    cantidad=cantidad,
                    unidad_medida=unidad,
                    desperdicio_porcentaje=desperdicio,
                )
            )
        producto.receta = receta
        db.session.add(producto)
        productos[definicion["nombre"]] = producto

    db.session.flush()

    # --- Solicitudes públicas -------------------------------------------
    hoy = date.today()
    solicitudes_def = [
        {
            "folio": "SOL-2026-001",
            "cliente": "Estudio Nómada",
            "contacto": "Luis Barrera",
            "correo": "luis@estudionomada.mx",
            "telefono": "55 2345 6789",
            "segmento": "pyme",
            "estado": "nueva",
            "mensaje": "Hola, me llegaron a recomendar su imprenta. Quiero cotizar 40 playeras negras estampadas al frente y espalda para el 25 de este mes. ¿Incluyen la playera?",
            "fecha": hoy + timedelta(days=11),
            "items": [("Playera DTF 29 × 29 cm", "Talla M y G · estampado frente y espalda", 40, 220)],
        },
        {
            "folio": "SOL-2026-002",
            "cliente": "Café Origen",
            "contacto": "Renata Solís",
            "correo": "renata@cafeorigen.mx",
            "telefono": "55 3456 7890",
            "segmento": "eventos",
            "estado": "nueva",
            "mensaje": "Necesitamos 60 tazas sublimadas con nuestro logotipo para la apertura de sucursal. Adjunto el manual de marca.",
            "fecha": hoy + timedelta(days=9),
            "items": [("Taza cerámica sublimada", "Logo a dos tintas · caja individual", 60, 95)],
        },
        {
            "folio": "SOL-2026-003",
            "cliente": "Papelería Lumen",
            "contacto": "Carla Domínguez",
            "correo": "carla@papelerialumen.mx",
            "telefono": "55 5678 9012",
            "segmento": "escolar",
            "estado": "en-revision",
            "mensaje": "Cotizar 10 paquetes de tarjetas Couché 300g con laminado mate para el regreso a clases.",
            "fecha": hoy + timedelta(days=18),
            "items": [("Tarjetas Couché 300g", "100 piezas por paquete · laminado mate", 10, 850)],
        },
        {
            "folio": "SOL-2026-004",
            "cliente": "Alma Creativa",
            "contacto": "Ana Torres",
            "correo": "ana@almacreativa.mx",
            "telefono": "55 1234 5678",
            "segmento": "corporativo",
            "estado": "cotizada",
            "mensaje": "Queremos un roll-up premium para el lobby y 25 tote bags para el equipo de marca.",
            "fecha": hoy + timedelta(days=7),
            "items": [
                ("Roll-up premium 85 × 200 cm", "Acabado mate premium · estuche rígido", 1, 3850),
                ("Tote bag de manta", "DTF full color · asa reforzada", 25, 110),
            ],
        },
        {
            "folio": "SOL-2026-005",
            "cliente": "Grupo Altura",
            "contacto": "Sergio Nava",
            "correo": "sergio@grupodigital.mx",
            "telefono": "55 4567 8901",
            "segmento": "corporativo",
            "estado": "convertida",
            "mensaje": "Lona Frontlit para fachada de 20 m² y un roll-up para el stand. Entrega en instalación.",
            "fecha": hoy + timedelta(days=12),
            "items": [
                ("Lona Frontlit impresa", "20 m² · acabado brillante", 20, 320),
                ("Roll-up premium 85 × 200 cm", "Estructura y estuche", 1, 3850),
            ],
        },
        {
            "folio": "SOL-2026-006",
            "cliente": "Bistró Aurora",
            "contacto": "Mario Esquivel",
            "correo": "mario@bistroaurora.mx",
            "telefono": "55 6789 0123",
            "segmento": "eventos",
            "estado": "convertida",
            "mensaje": "25 tote bags y 100 stickers troquelados para nuestro aniversario.",
            "fecha": hoy + timedelta(days=14),
            "items": [
                ("Tote bag de manta", "Una cara · tinta magenta", 25, 110),
                ("Sticker troquelado", "8 × 8 cm · vinil brillante", 100, 35),
            ],
        },
    ]

    solicitudes: dict[str, SolicitudCotizacion] = {}
    for definicion in solicitudes_def:
        cliente = clientes[definicion["cliente"]]
        solicitud = SolicitudCotizacion(
            folio=definicion["folio"],
            nombre_cliente=definicion["contacto"],
            empresa=cliente.nombre,
            correo=definicion["correo"],
            telefono=definicion["telefono"],
            segmento=definicion["segmento"],
            mensaje=definicion["mensaje"],
            fecha_deseada=definicion["fecha"],
            metodo_entrega="domicilio" if definicion["segmento"] != "eventos" else "taller",
            estado=definicion["estado"],
            origen="web",
        )
        for nombre_producto, especificaciones, cantidad, precio in definicion["items"]:
            producto = productos[nombre_producto]
            solicitud.items.append(
                SolicitudItem(
                    producto_id=producto.id,
                    nombre_producto=nombre_producto,
                    especificaciones=especificaciones,
                    cantidad=cantidad,
                    precio_estimado=round(precio * cantidad, 2),
                )
            )
        db.session.add(solicitud)
        solicitudes[definicion["folio"]] = solicitud

    db.session.flush()

    # Adjunto de ejemplo descargable
    carpeta = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(carpeta, exist_ok=True)
    nombre_guardado = "demo-brief-playeras.pdf"
    ruta = os.path.join(carpeta, nombre_guardado)
    if not os.path.exists(ruta):
        with open(ruta, "wb") as archivo:
            archivo.write(
                b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
                b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
                b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\n"
                b"trailer<</Root 1 0 R>>\n%%EOF"
            )
    solicitudes["SOL-2026-001"].archivos.append(
        SolicitudArchivo(
            nombre_original="brief-playeras.pdf",
            nombre_guardado=nombre_guardado,
            ruta_relativa=nombre_guardado,
            mime_type="application/pdf",
            tamano_bytes=os.path.getsize(ruta),
        )
    )

    # Conversación de ejemplo para el chat público por folio y correo.
    solicitudes["SOL-2026-001"].mensajes.extend(
        [
            MensajeChat(
                remitente_tipo="cliente",
                mensaje=(
                    "Hola, ¿el precio incluye la playera y el estampado? "
                    "Quisiéramos confirmar antes de aprobar."
                ),
                creado_en=utcnow() - timedelta(hours=7),
            ),
            MensajeChat(
                remitente_tipo="interno",
                usuario_id=usuarios["diego@llamma.mx"].id,
                mensaje=(
                    "¡Claro! El precio incluye playera de algodón y estampado DTF "
                    "a todo color. También podemos ajustar tallas si lo necesitas."
                ),
                creado_en=utcnow() - timedelta(hours=5),
            ),
            MensajeChat(
                remitente_tipo="cliente",
                mensaje="Perfecto, gracias. ¿Podemos agregar 5 piezas talla XL?",
                creado_en=utcnow() - timedelta(hours=3),
            ),
        ]
    )

    # --- Cotizaciones ----------------------------------------------------
    cotizaciones_def = [
        {
            "folio": "COT-2026-001",
            "solicitud": "SOL-2026-004",
            "cliente": "Alma Creativa",
            "estado": "enviada",
            "items": [("Roll-up premium 85 × 200 cm", "Mate premium", 1, 3850), ("Tote bag de manta", "DTF full color", 25, 110)],
        },
        {
            "folio": "COT-2026-002",
            "solicitud": "SOL-2026-005",
            "cliente": "Grupo Altura",
            "estado": "convertida",
            "items": [("Lona Frontlit impresa", "20 m² brillante", 20, 320), ("Roll-up premium 85 × 200 cm", "Estructura", 1, 3850)],
        },
        {
            "folio": "COT-2026-003",
            "solicitud": "SOL-2026-006",
            "cliente": "Bistró Aurora",
            "estado": "convertida",
            "items": [("Tote bag de manta", "Una cara", 25, 110), ("Sticker troquelado", "8 × 8 cm", 100, 35)],
        },
    ]

    cotizaciones: dict[str, Cotizacion] = {}
    for definicion in cotizaciones_def:
        subtotal = sum(cantidad * precio for _, _, cantidad, precio in definicion["items"])
        totales = _totales(subtotal)
        cotizacion = Cotizacion(
            folio=definicion["folio"],
            solicitud_id=solicitudes[definicion["solicitud"]].id,
            cliente_id=clientes[definicion["cliente"]].id,
            usuario_id=usuarios["diego@llamma.mx"].id,
            estado=definicion["estado"],
            notas="Cotización generada desde la solicitud del portal.",
            **totales,
        )
        for descripcion, especificaciones, cantidad, precio in definicion["items"]:
            cotizacion.items.append(
                CotizacionItem(
                    descripcion=descripcion,
                    especificaciones=especificaciones,
                    cantidad=cantidad,
                    precio_unitario=precio,
                    importe=round(cantidad * precio, 2),
                )
            )
        db.session.add(cotizacion)
        cotizaciones[definicion["folio"]] = cotizacion

    db.session.flush()

    # --- Pedidos y producción -------------------------------------------
    pedidos_def = [
        {
            "folio": "LLM-1048",
            "cotizacion": "COT-2026-002",
            "cliente": "Grupo Altura",
            "estado": "en-produccion",
            "prioridad": "alta",
            "entrega": hoy + timedelta(days=7),
            "etapa": "impresion",
            "estado_produccion": "en-proceso",
            "items": [("Lona Frontlit impresa", "20 m² brillante", 20, 320), ("Roll-up premium 85 × 200 cm", "Estructura", 1, 3850)],
        },
        {
            "folio": "LLM-1047",
            "cotizacion": "COT-2026-003",
            "cliente": "Bistró Aurora",
            "estado": "en-produccion",
            "prioridad": "media",
            "entrega": hoy + timedelta(days=4),
            "etapa": "acabado",
            "estado_produccion": "en-proceso",
            "items": [("Tote bag de manta", "Una cara", 25, 110), ("Sticker troquelado", "8 × 8 cm", 100, 35)],
        },
        {
            "folio": "LLM-1046",
            "cotizacion": None,
            "cliente": "Café Origen",
            "estado": "listo",
            "prioridad": "media",
            "entrega": hoy + timedelta(days=1),
            "etapa": "entrega",
            "estado_produccion": "en-proceso",
            "items": [("Taza cerámica sublimada", "Logo a dos tintas", 60, 95)],
        },
    ]

    for definicion in pedidos_def:
        subtotal = sum(cantidad * precio for _, _, cantidad, precio in definicion["items"])
        totales = _totales(subtotal)
        pedido = Pedido(
            folio=definicion["folio"],
            cotizacion_id=cotizaciones[definicion["cotizacion"]].id if definicion["cotizacion"] else None,
            cliente_id=clientes[definicion["cliente"]].id,
            estado=definicion["estado"],
            prioridad=definicion["prioridad"],
            fecha_entrega=definicion["entrega"],
            notas="Pedido de demostración generado desde una cotización aprobada.",
            creado_por=usuarios["diego@llamma.mx"].id,
            **totales,
        )
        for descripcion, especificaciones, cantidad, precio in definicion["items"]:
            pedido.items.append(
                PedidoItem(
                    descripcion=descripcion,
                    especificaciones=especificaciones,
                    cantidad=cantidad,
                    precio_unitario=precio,
                    importe=round(cantidad * precio, 2),
                )
            )

        pedido.pagos.append(
            Pago(
                tipo="anticipo",
                metodo="transferencia",
                monto=totales["anticipo"],
                referencia=f"SPEI-{definicion['folio']}",
                confirmado=True,
                registrado_por=usuarios["diego@llamma.mx"].id,
            )
        )

        orden = OrdenProduccion(
            pedido=pedido,
            etapa=definicion["etapa"],
            estado=definicion["estado_produccion"],
            responsable_id=usuarios["mariana@llamma.mx"].id,
            fecha_inicio=utcnow(),
            observaciones="Producción en curso en el taller Roma.",
        )
        for etapa, estado_etapa in [
            ("diseno", "completada"),
            ("impresion", "completada" if definicion["etapa"] in {"acabado", "entrega"} else "en-proceso"),
            ("acabado", "en-proceso" if definicion["etapa"] == "acabado" else ("completada" if definicion["etapa"] == "entrega" else "pendiente")),
            ("entrega", "en-proceso" if definicion["etapa"] == "entrega" else "pendiente"),
        ]:
            orden.etapas.append(
                ProduccionEtapa(
                    etapa=etapa,
                    estado=estado_etapa,
                    responsable_id=usuarios["mariana@llamma.mx"].id,
                    inicio=utcnow() if estado_etapa != "pendiente" else None,
                    fin=utcnow() if estado_etapa == "completada" else None,
                )
            )
        orden.controles.append(
            ControlCalidad(
                criterio="Color y perfil CMYK",
                aprobado=True,
                revisado_por=usuarios["mariana@llamma.mx"].id,
            )
        )
        orden.controles.append(
            ControlCalidad(
                criterio="Medidas y sangrado",
                aprobado=True,
                revisado_por=usuarios["mariana@llamma.mx"].id,
            )
        )
        orden.controles.append(
            ControlCalidad(
                criterio="Empaque y etiquetado",
                aprobado=False,
                observaciones="Pendiente antes de la entrega",
                revisado_por=usuarios["mariana@llamma.mx"].id,
            )
        )

        db.session.add(pedido)

    # --- Compras ---------------------------------------------------------
    compras_def = [
        (
            "OC-2026-001",
            "Gran Formato SA",
            "en-transito",
            hoy + timedelta(days=4),
            [("Lona Frontlit 510g", 120, 110)],
        ),
        (
            "OC-2026-002",
            "ColorLab MX",
            "confirmada",
            hoy + timedelta(days=2),
            [("Tinta Eco-solvente CMYK", 4, 1180)],
        ),
        (
            "OC-2026-003",
            "Papelera Central",
            "pendiente",
            hoy + timedelta(days=1),
            [("Papel Couché 300g", 500, 4.2)],
        ),
    ]
    for folio, proveedor, estado, entrega, items in compras_def:
        subtotal = sum(cantidad * precio for _, cantidad, precio in items)
        totales = _totales(subtotal)
        orden = OrdenCompra(
            folio=folio,
            proveedor_id=proveedores[proveedor].id,
            estado=estado,
            fecha_entrega=entrega,
            creado_por=usuarios["ivan@llamma.mx"].id,
            subtotal=totales["subtotal"],
            impuestos=totales["impuestos"],
            total=totales["total"],
        )
        for materia_nombre, cantidad, precio in items:
            orden.items.append(
                OrdenCompraItem(
                    materia_prima_id=materias[materia_nombre].id,
                    cantidad=cantidad,
                    unidad_medida=materias[materia_nombre].unidad_medida,
                    precio_unitario=precio,
                    importe=round(cantidad * precio, 2),
                )
            )
        db.session.add(orden)

    # Movimientos de ejemplo
    for materia_nombre, cantidad in [("Lona Frontlit 510g", 6), ("Tinta Eco-solvente CMYK", 0.2)]:
        db.session.add(
            MovimientoInventario(
                materia_prima_id=materias[materia_nombre].id,
                tipo="salida",
                cantidad=cantidad,
                unidad_medida=materias[materia_nombre].unidad_medida,
                costo_unitario=materias[materia_nombre].costo_unitario,
                referencia="LLM-1048",
                motivo="Consumo de producción",
                usuario_id=usuarios["mariana@llamma.mx"].id,
            )
        )

    # --- Marketing -------------------------------------------------------
    actividades_def = [
        ("Color que transforma", "redes-sociales", 12400, 58900, "activa", "Branding y gran formato en Instagram"),
        ("Textil para equipos", "redes-sociales", 9800, 41200, "activa", "Campaña de playeras DTF para empresas"),
        ("Regalos corporativos", "google-ads", 11200, 49600, "activa", "Promocionales de fin de año"),
        ("Papelería que se guarda", "correo", 3400, 18700, "finalizada", "Catálogo Couché por email"),
        ("Expo Diseño CDMX", "punto-de-venta", 6000, 17900, "planeada", "Stand y muestras en Centro Citibanamex"),
    ]
    for nombre, canal, presupuesto, ingresos, estado, descripcion in actividades_def:
        db.session.add(
            ActividadMarketing(
                nombre=nombre,
                canal=canal,
                fecha_inicio=hoy.replace(day=1),
                fecha_fin=hoy + timedelta(days=45),
                presupuesto=presupuesto,
                inversion_real=round(presupuesto * 0.78, 2),
                ingresos_atribuidos=ingresos,
                estado=estado,
                descripcion=descripcion,
                creado_por=usuarios["paola@llamma.mx"].id,
            )
        )

    db.session.commit()

    print("Seed de Llamma cargado correctamente.")
    print(f"  Roles: {len(ROLES)} · Permisos: {len(PERMISOS)} · Usuarios: {len(USUARIOS)}")
    print(f"  Clientes: {len(CLIENTES)} · Productos: {len(PRODUCTOS)} · Solicitudes: {len(solicitudes_def)}")
    print(f"  Contraseña demo para todos los usuarios: {CLAVE_DEMO}")
    print("  Correos: ana@llamma.mx (admin), diego@llamma.mx (ventas), mariana@llamma.mx (producción)")

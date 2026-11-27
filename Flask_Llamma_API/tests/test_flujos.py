"""Pruebas de flujo de la API sobre una base SQLite aislada.

Se ejecutan con la biblioteca estándar, sin dependencias nuevas:

    .venv\\Scripts\\python.exe -m unittest discover -s tests -v

Cubren los flujos críticos de arranque, login, solicitud pública, cotización,
pedido con descuento de inventario, pagos, órdenes de compra y adjuntos.
"""

from __future__ import annotations

import io
import base64
import json
import os
import shutil
import sys
import tempfile
import unittest
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
TEMPORAL = Path(tempfile.mkdtemp(prefix="llamma-tests-"))

os.environ["DATABASE_URL"] = f"sqlite:///{(TEMPORAL / 'pruebas.db').as_posix()}"
os.environ["UPLOAD_FOLDER"] = str(TEMPORAL / "uploads")
os.environ.setdefault("LLAMMA_ENV", "development")
# Los flujos crean varias solicitudes desde la misma IP de prueba. El límite
# público se verifica por separado con su propia prueba de login/rate-limit.
os.environ["PUBLICO_MAX_SOLICITUDES"] = "50"

sys.path.insert(0, str(RAIZ))

from app import create_app  # noqa: E402
from extensions import db  # noqa: E402
from models import (  # noqa: E402
    Cliente,
    MateriaPrima,
    MovimientoInventario,
    Pedido,
    Producto,
    Proveedor,
    Receta,
    RecetaComponente,
    Rol,
    SolicitudArchivo,
    Usuario,
)
from utils import calcular_fecha_minima_entrega  # noqa: E402


class FlujosApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.app = create_app()
        cls.app.config.update(TESTING=True)
        cls.ctx = cls.app.app_context()
        cls.ctx.push()
        db.create_all()

        admin = Rol(nombre="admin", descripcion="Administrador")
        db.session.add(admin)
        db.session.flush()

        cls.admin = Usuario(nombre="QA Admin", correo="qa-admin@llamma.mx", rol_id=admin.id)
        cls.admin.set_password("llamma2026")
        db.session.add(cls.admin)

        cls.usuarios_por_rol: dict[str, Usuario] = {}
        for nombre_rol in ("ventas", "produccion", "inventario", "marketing"):
            rol = Rol(nombre=nombre_rol, descripcion=nombre_rol.capitalize())
            db.session.add(rol)
            db.session.flush()
            usuario = Usuario(
                nombre=f"QA {nombre_rol}",
                correo=f"qa-{nombre_rol}@llamma.mx",
                rol_id=rol.id,
            )
            usuario.set_password("llamma2026")
            db.session.add(usuario)
            cls.usuarios_por_rol[nombre_rol] = usuario

        cls.cliente = Cliente(nombre="Cliente QA", correo="cliente-qa@example.com")
        db.session.add(cls.cliente)

        cls.proveedor = Proveedor(nombre="Proveedor QA")
        db.session.add(cls.proveedor)
        db.session.flush()

        # Materia con existencias suficientes.
        cls.lona = MateriaPrima(
            nombre="Lona QA",
            categoria="lona",
            unidad_medida="m2",
            stock_actual=100,
            stock_minimo=5,
            costo_unitario=50,
            proveedor_id=cls.proveedor.id,
        )
        # Materia con existencias insuficientes para probar el descuento parcial.
        cls.tinta = MateriaPrima(
            nombre="Tinta QA",
            categoria="tinta",
            unidad_medida="litro",
            stock_actual=5,
            stock_minimo=1,
            costo_unitario=200,
            proveedor_id=cls.proveedor.id,
        )
        db.session.add_all([cls.lona, cls.tinta])
        db.session.flush()

        cls.producto = Producto(
            nombre="Lona QA impresa",
            categoria="gran-formato",
            linea_produccion="gran-formato",
            precio_base=100,
            unidad_venta="m2",
        )
        db.session.add(cls.producto)
        db.session.flush()

        receta = Receta(
            producto_id=cls.producto.id,
            nombre="Receta lona QA",
            rendimiento=1,
            unidad_rendimiento="m2",
        )
        receta.componentes.append(
            RecetaComponente(
                materia_prima_id=cls.lona.id,
                cantidad=2,
                unidad_medida="m2",
                desperdicio_porcentaje=10,
            )
        )
        db.session.add(receta)

        cls.producto_parcial = Producto(
            nombre="Playera QA con tinta escasa",
            categoria="textil",
            linea_produccion="textil",
            precio_base=200,
            unidad_venta="pieza",
        )
        db.session.add(cls.producto_parcial)
        db.session.flush()
        receta_parcial = Receta(
            producto_id=cls.producto_parcial.id,
            nombre="Receta playera QA",
            rendimiento=1,
            unidad_rendimiento="pieza",
        )
        receta_parcial.componentes.append(
            RecetaComponente(
                materia_prima_id=cls.tinta.id,
                cantidad=4,
                unidad_medida="litro",
                desperdicio_porcentaje=0,
            )
        )
        db.session.add(receta_parcial)

        cls.producto_sin_receta = Producto(
            nombre="Servicio de diseño QA",
            categoria="otro",
            linea_produccion="gran-formato",
            precio_base=100,
            unidad_venta="pieza",
        )
        db.session.add(cls.producto_sin_receta)
        db.session.commit()

        cls.client = cls.app.test_client()

    @classmethod
    def tearDownClass(cls) -> None:
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        cls.ctx.pop()
        shutil.rmtree(TEMPORAL, ignore_errors=True)

    # ------------------------------------------------------------------ utils
    @staticmethod
    def _json(respuesta):
        return respuesta.get_json() or {}

    def _token(self) -> str:
        respuesta = self.client.post(
            "/api/auth/login",
            json={"correo": "qa-admin@llamma.mx", "password": "llamma2026"},
        )
        self.assertEqual(respuesta.status_code, 200, respuesta.get_data(as_text=True))
        return self._json(respuesta)["token"]

    def _auth(self, token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}

    def _token_rol(self, rol: str) -> str:
        respuesta = self.client.post(
            "/api/auth/login",
            json={"correo": f"qa-{rol}@llamma.mx", "password": "llamma2026"},
        )
        self.assertEqual(respuesta.status_code, 200, respuesta.get_data(as_text=True))
        return self._json(respuesta)["token"]

    def _solicitud(self, correo: str, nombre: str = "Cliente QA") -> dict:
        respuesta = self.client.post(
            "/api/public/solicitudes",
            json={
                "nombre": nombre,
                "correo": correo,
                "mensaje": "Necesito una lona impresa",
                "items": [
                    {
                        "productoId": self.producto.id,
                        "nombreProducto": self.producto.nombre,
                        "cantidad": 2,
                    }
                ],
            },
        )
        self.assertEqual(respuesta.status_code, 201, respuesta.get_data(as_text=True))
        return self._json(respuesta)

    # ------------------------------------------------------------------ flujos
    def test_01_catalogo_publico(self) -> None:
        respuesta = self.client.get("/api/public/productos")
        self.assertEqual(respuesta.status_code, 200)
        datos = self._json(respuesta)
        nombres = [producto["nombre"] for producto in datos["items"]]
        self.assertIn(self.producto.nombre, nombres)

    def test_02_login_y_sesion(self) -> None:
        token = self._token()
        me = self.client.get("/api/auth/me", headers=self._auth(token))
        self.assertEqual(me.status_code, 200)
        self.assertEqual(self._json(me)["usuario"]["correo"], "qa-admin@llamma.mx")

        sin_token = self.client.get("/api/auth/me")
        self.assertEqual(sin_token.status_code, 401)

        malo = self.client.post(
            "/api/auth/login",
            json={"correo": "qa-admin@llamma.mx", "password": "incorrecta"},
        )
        self.assertEqual(malo.status_code, 401)
        self.assertEqual(self._json(malo)["codigo"], "credenciales_invalidas")

    def test_02b_rbac_por_rol(self) -> None:
        """La matriz de roles se respeta también al llamar la API directamente."""
        ventas = self._token_rol("ventas")
        self.assertEqual(
            self.client.get("/api/materias-primas", headers=self._auth(ventas)).status_code, 200
        )
        self.assertEqual(
            self.client.get("/api/produccion/tablero", headers=self._auth(ventas)).status_code,
            200,
        )
        self.assertEqual(
            self.client.get("/api/solicitudes", headers=self._auth(ventas)).status_code, 200
        )
        self.assertEqual(
            self.client.post(
                "/api/materias-primas",
                headers=self._auth(ventas),
                json={"nombre": "No permitido ventas", "categoria": "lona", "unidadMedida": "m2"},
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.get("/api/marketing/actividades", headers=self._auth(ventas)).status_code,
            403,
        )
        self.assertEqual(
            self.client.get("/api/usuarios", headers=self._auth(ventas)).status_code, 403
        )
        self.assertEqual(
            self.client.patch(
                "/api/pedidos/999/estado",
                headers=self._auth(ventas),
                json={"estado": "confirmado"},
            ).status_code,
            404,
        )

        produccion = self._token_rol("produccion")
        self.assertEqual(
            self.client.get("/api/solicitudes", headers=self._auth(produccion)).status_code, 200
        )
        self.assertEqual(
            self.client.get("/api/clientes", headers=self._auth(produccion)).status_code, 403
        )
        self.assertEqual(
            self.client.get(
                "/api/marketing/actividades", headers=self._auth(produccion)
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.patch(
                "/api/pedidos/999/estado",
                headers=self._auth(produccion),
                json={"estado": "confirmado"},
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.post(
                "/api/cotizaciones", headers=self._auth(produccion), json={"items": []}
            ).status_code,
            403,
        )

        inventario = self._token_rol("inventario")
        self.assertEqual(
            self.client.get("/api/produccion/tablero", headers=self._auth(inventario)).status_code,
            200,
        )
        self.assertEqual(
            self.client.get("/api/solicitudes", headers=self._auth(inventario)).status_code, 403
        )
        self.assertEqual(
            self.client.get("/api/pedidos", headers=self._auth(inventario)).status_code, 403
        )
        self.assertEqual(
            self.client.get(
                "/api/marketing/actividades", headers=self._auth(inventario)
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.get("/api/clientes", headers=self._auth(inventario)).status_code, 403
        )
        self.assertEqual(
            self.client.patch(
                "/api/pedidos/999/estado",
                headers=self._auth(inventario),
                json={"estado": "confirmado"},
            ).status_code,
            403,
        )

        marketing = self._token_rol("marketing")
        self.assertEqual(
            self.client.get(
                "/api/marketing/actividades", headers=self._auth(marketing)
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.get("/api/clientes", headers=self._auth(marketing)).status_code, 403
        )
        self.assertEqual(
            self.client.get("/api/materias-primas", headers=self._auth(marketing)).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                "/api/clientes",
                headers=self._auth(marketing),
                json={"nombre": "Cliente Marketing QA", "correo": "marketing-cliente@example.com"},
            ).status_code,
            403,
        )

    def test_02c_editar_usuario(self) -> None:
        """PUT /api/usuarios/<id>: edita sin exigir contraseña y valida duplicados/rol."""
        admin = self._token()
        creado = self.client.post(
            "/api/usuarios",
            headers=self._auth(admin),
            json={
                "nombre": "QA Editable",
                "correo": "qa-editable@llamma.mx",
                "password": "ClaveOriginal123!",
                "rol": "ventas",
            },
        )
        self.assertEqual(creado.status_code, 201, creado.get_data(as_text=True))
        usuario_id = self._json(creado)["id"]
        hash_original = Usuario.query.get(usuario_id).password_hash

        editado = self.client.put(
            f"/api/usuarios/{usuario_id}",
            headers=self._auth(admin),
            json={
                "nombre": "QA Editado",
                "correo": "qa-editado@llamma.mx",
                "rol": "produccion",
                "password": "",
            },
        )
        self.assertEqual(editado.status_code, 200, editado.get_data(as_text=True))
        datos = self._json(editado)
        self.assertEqual(datos["nombre"], "QA Editado")
        self.assertEqual(datos["correo"], "qa-editado@llamma.mx")
        self.assertEqual(datos["rol"], "produccion")
        self.assertEqual(Usuario.query.get(usuario_id).password_hash, hash_original)

        login_original = self.client.post(
            "/api/auth/login",
            json={"correo": "qa-editado@llamma.mx", "password": "ClaveOriginal123!"},
        )
        self.assertEqual(login_original.status_code, 200)

        duplicado = self.client.put(
            f"/api/usuarios/{usuario_id}",
            headers=self._auth(admin),
            json={
                "nombre": "QA Editado",
                "correo": "qa-admin@llamma.mx",
                "rol": "produccion",
            },
        )
        self.assertEqual(duplicado.status_code, 409)

        rol_invalido = self.client.put(
            f"/api/usuarios/{usuario_id}",
            headers=self._auth(admin),
            json={
                "nombre": "QA Editado",
                "correo": "qa-editado@llamma.mx",
                "rol": "superadmin",
            },
        )
        self.assertEqual(rol_invalido.status_code, 400)

        clave_corta = self.client.put(
            f"/api/usuarios/{usuario_id}",
            headers=self._auth(admin),
            json={
                "nombre": "QA Editado",
                "correo": "qa-editado@llamma.mx",
                "rol": "produccion",
                "password": "1234",
            },
        )
        self.assertEqual(clave_corta.status_code, 400)

        nueva = self.client.patch(
            f"/api/usuarios/{usuario_id}",
            headers=self._auth(admin),
            json={
                "nombre": "QA Editado",
                "correo": "qa-editado@llamma.mx",
                "rol": "produccion",
                "password": "ClaveNueva456!",
            },
        )
        self.assertEqual(nueva.status_code, 200, nueva.get_data(as_text=True))
        self.assertNotEqual(Usuario.query.get(usuario_id).password_hash, hash_original)
        self.assertEqual(
            self.client.post(
                "/api/auth/login",
                json={"correo": "qa-editado@llamma.mx", "password": "ClaveOriginal123!"},
            ).status_code,
            401,
        )
        self.assertEqual(
            self.client.post(
                "/api/auth/login",
                json={"correo": "qa-editado@llamma.mx", "password": "ClaveNueva456!"},
            ).status_code,
            200,
        )

        ventas = self._token_rol("ventas")
        self.assertEqual(
            self.client.put(
                f"/api/usuarios/{usuario_id}",
                headers=self._auth(ventas),
                json={
                    "nombre": "Intruso",
                    "correo": "intruso@llamma.mx",
                    "rol": "admin",
                },
            ).status_code,
            403,
        )
        lista = self._json(self.client.get("/api/usuarios", headers=self._auth(admin)))
        self.assertNotIn("password", lista["items"][0])
        self.assertNotIn("password_hash", lista["items"][0])

    def test_02d_pasos_produccion_dinamicos(self) -> None:
        """Los pedidos nuevos reciben pasos según la línea del producto."""
        admin = self._token()

        def crear_pedido(nombre: str, linea: str, categoria: str) -> list[str]:
            producto = self.client.post(
                "/api/productos",
                headers=self._auth(admin),
                json={
                    "nombre": nombre,
                    "lineaProduccion": linea,
                    "categoria": categoria,
                    "precioBase": 100,
                    "unidadVenta": "pieza",
                },
            )
            self.assertEqual(producto.status_code, 201, producto.get_data(as_text=True))
            pedido = self.client.post(
                "/api/pedidos",
                headers=self._auth(admin),
                json={
                    "clienteId": self.cliente.id,
                    "items": [{"productoId": self._json(producto)["id"], "cantidad": 1}],
                },
            )
            self.assertEqual(pedido.status_code, 201, pedido.get_data(as_text=True))
            orden = self._json(pedido)["ordenProduccion"]
            return [etapa["etapa"] for etapa in orden["historialEtapas"]]

        self.assertEqual(
            crear_pedido("Lona dinámica QA", "gran-formato", "display"),
            ["diseno", "impresion", "corte", "empaquetado"],
        )
        self.assertEqual(
            crear_pedido("Playera dinámica QA", "textil", "textil"),
            ["diseno", "impresion", "plasmado", "empaquetado"],
        )
        self.assertEqual(
            crear_pedido("Roll-up dinámico QA", "gran-formato", "display"),
            ["diseno", "impresion", "empaquetado"],
        )

    def test_02e_consultas_encuentra_entregados(self) -> None:
        """El filtro de consultas devuelve pedidos entregados y respeta fechas."""
        admin = self._token()
        producto = self.client.post(
            "/api/productos",
            headers=self._auth(admin),
            json={
                "nombre": "Producto consulta QA",
                "lineaProduccion": "gran-formato",
                "categoria": "display",
                "precioBase": 100,
                "unidadVenta": "pieza",
            },
        )
        self.assertEqual(producto.status_code, 201, producto.get_data(as_text=True))
        creado = self.client.post(
            "/api/pedidos",
            headers=self._auth(admin),
            json={
                "clienteId": self.cliente.id,
                "items": [{"productoId": self._json(producto)["id"], "cantidad": 1}],
            },
        )
        self.assertEqual(creado.status_code, 201, creado.get_data(as_text=True))
        folio = self._json(creado)["folio"]

        entregado = self.client.patch(
            f"/api/pedidos/{self._json(creado)['id']}/estado",
            headers=self._auth(admin),
            json={"estado": "entregado"},
        )
        self.assertEqual(entregado.status_code, 200, entregado.get_data(as_text=True))

        consulta = self.client.get(
            f"/api/consultas/pedidos?estado=entregado&q={folio}",
            headers=self._auth(admin),
        )
        self.assertEqual(consulta.status_code, 200, consulta.get_data(as_text=True))
        items = self._json(consulta)["items"]
        self.assertTrue(any(item["folio"] == folio for item in items))

        hoy = date.today().isoformat()
        por_fecha = self.client.get(
            f"/api/consultas/pedidos?estado=entregado&desde={hoy}&hasta={hoy}",
            headers=self._auth(admin),
        )
        self.assertEqual(por_fecha.status_code, 200)
        self.assertTrue(
            any(item["folio"] == folio for item in self._json(por_fecha)["items"])
        )

    def test_02f_validacion_alta_usuarios(self) -> None:
        """Rechaza tipos y longitudes inválidas sin truncar datos en silencio."""
        admin = self._token()

        def crear(datos: dict):
            return self.client.post("/api/usuarios", headers=self._auth(admin), json=datos)

        base = {
            "nombre": "Usuario validación QA",
            "correo": "validacion-qa@example.com",
            "password": "Password123!",
            "rol": "ventas",
        }

        nombre_largo = crear({**base, "nombre": "N" * 121})
        self.assertEqual(nombre_largo.status_code, 400, nombre_largo.get_data(as_text=True))
        self.assertEqual(self._json(nombre_largo)["codigo"], "nombre_invalido")

        correo_largo = "a" * 65 + "@" + "b" * 63 + "." + "c" * 27 + ".com"
        self.assertEqual(len(correo_largo), 161)
        respuesta = crear({**base, "correo": correo_largo})
        self.assertEqual(respuesta.status_code, 400, respuesta.get_data(as_text=True))
        self.assertEqual(self._json(respuesta)["codigo"], "correo_invalido")

        password_larga = crear({**base, "password": "P" * 129})
        self.assertEqual(password_larga.status_code, 400, password_larga.get_data(as_text=True))
        self.assertEqual(self._json(password_larga)["codigo"], "password_invalida")

        nombre_no_texto = crear({**base, "nombre": ["A", "B"]})
        self.assertEqual(nombre_no_texto.status_code, 400, nombre_no_texto.get_data(as_text=True))

        password_numerica = crear({**base, "password": 12345678})
        self.assertEqual(
            password_numerica.status_code, 400, password_numerica.get_data(as_text=True)
        )

        # Los límites exactos sí se aceptan y no se recortan.
        correo_limite = "a" * 64 + "@" + "b" * 63 + "." + "c" * 27 + ".com"
        self.assertEqual(len(correo_limite), 160)
        valido = crear(
            {
                **base,
                "nombre": "N" * 120,
                "correo": correo_limite,
            }
        )
        self.assertEqual(valido.status_code, 201, valido.get_data(as_text=True))
        self.assertEqual(self._json(valido)["nombre"], "N" * 120)
        self.assertEqual(self._json(valido)["correo"], correo_limite)

        actualizado = self.client.put(
            f"/api/usuarios/{self._json(valido)['id']}",
            headers=self._auth(admin),
            json={"nombre": "N" * 121, "correo": correo_limite, "rol": "ventas"},
        )
        self.assertEqual(actualizado.status_code, 400, actualizado.get_data(as_text=True))

    def test_02g_cambiar_password_revoca_sesiones(self) -> None:
        """Al cambiar la contraseña, los tokens abiertos del usuario dejan de servir."""
        admin = self._token()
        correo = "revoca-sesion-qa@example.com"
        creado = self.client.post(
            "/api/usuarios",
            headers=self._auth(admin),
            json={
                "nombre": "Usuario revocación QA",
                "correo": correo,
                "password": "ClaveOriginal123!",
                "rol": "ventas",
            },
        )
        self.assertEqual(creado.status_code, 201, creado.get_data(as_text=True))
        usuario_id = self._json(creado)["id"]

        login = self.client.post(
            "/api/auth/login", json={"correo": correo, "password": "ClaveOriginal123!"}
        )
        self.assertEqual(login.status_code, 200, login.get_data(as_text=True))
        token_usuario = self._json(login)["token"]

        antes = self.client.get("/api/auth/me", headers=self._auth(token_usuario))
        self.assertEqual(antes.status_code, 200)

        cambio = self.client.put(
            f"/api/usuarios/{usuario_id}",
            headers=self._auth(admin),
            json={
                "nombre": "Usuario revocación QA",
                "correo": correo,
                "rol": "ventas",
                "password": "ClaveNueva123!",
            },
        )
        self.assertEqual(cambio.status_code, 200, cambio.get_data(as_text=True))

        despues = self.client.get("/api/auth/me", headers=self._auth(token_usuario))
        self.assertEqual(despues.status_code, 401)
        self.assertEqual(
            self.client.post(
                "/api/auth/login", json={"correo": correo, "password": "ClaveOriginal123!"}
            ).status_code,
            401,
        )
        self.assertEqual(
            self.client.post(
                "/api/auth/login", json={"correo": correo, "password": "ClaveNueva123!"}
            ).status_code,
            200,
        )

    def test_03_rate_limit_login(self) -> None:
        for intento in range(5):
            respuesta = self.client.post(
                "/api/auth/login",
                json={"correo": "qa-bloqueo@example.com", "password": "incorrecta"},
            )
            self.assertEqual(respuesta.status_code, 401, f"intento {intento + 1}")

        bloqueado = self.client.post(
            "/api/auth/login",
            json={"correo": "qa-bloqueo@example.com", "password": "incorrecta"},
        )
        self.assertEqual(bloqueado.status_code, 429)
        self.assertTrue(bloqueado.headers.get("Retry-After"))

    def test_04_solicitud_publica_y_seguimiento(self) -> None:
        creada = self._solicitud("cliente-qa@example.com")
        folio = creada["folio"]
        self.assertTrue(folio.startswith(f"SOL-{date.today().year}-"))

        correcto = self.client.get(
            f"/api/public/solicitudes/{folio}?correo=cliente-qa@example.com"
        )
        self.assertEqual(correcto.status_code, 200)
        self.assertEqual(self._json(correcto)["folio"], folio)

        incorrecto = self.client.get(
            f"/api/public/solicitudes/{folio}?correo=otro@example.com"
        )
        self.assertEqual(incorrecto.status_code, 404)

        inexistente = self.client.get(
            "/api/public/solicitudes/SOL-1999-999?correo=cliente-qa@example.com"
        )
        self.assertEqual(inexistente.status_code, 404)

    def test_05_adjuntos_validan_extension_y_token(self) -> None:
        invalido = self.client.post(
            "/api/public/solicitudes",
            data={
                "nombre": "Cliente Adjunto",
                "correo": "adjunto@example.com",
                "mensaje": "Adjunto inválido",
                "items": json.dumps(
                    [{"productoId": self.producto.id, "cantidad": 1}]
                ),
                "archivo": (io.BytesIO(b"binario"), "malware.exe"),
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(invalido.status_code, 415)

        valido = self.client.post(
            "/api/public/solicitudes",
            data={
                "nombre": "Cliente Adjunto",
                "correo": "adjunto@example.com",
                "mensaje": "Adjunto válido",
                "items": json.dumps(
                    [{"productoId": self.producto.id, "cantidad": 1}]
                ),
                "archivo": (io.BytesIO(b"%PDF-1.4\n"), "brief.pdf"),
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(valido.status_code, 201, valido.get_data(as_text=True))

        archivo = SolicitudArchivo.query.order_by(SolicitudArchivo.id.desc()).first()
        self.assertIsNotNone(archivo)

        self.assertEqual(self.client.get(f"/api/archivos/{archivo.id}").status_code, 401)

        descarga = self.client.get(
            f"/api/archivos/{archivo.id}", headers=self._auth(self._token())
        )
        self.assertEqual(descarga.status_code, 200)
        self.assertEqual(descarga.data, b"%PDF-1.4\n")

    def test_05b_adjunto_guarda_metadatos_de_mockup(self) -> None:
        metadatos = {
            "productoId": 1,
            "productoNombre": "Playera DTF 29 × 29 cm",
            "vista": "2d",
            "color": "",
            "material": None,
            "medidas": None,
            "capas": [{"nombre": "logo.png", "x": 20, "y": 0, "escala": 1, "rotacion": 0}],
            "capturadoEn": "2026-11-25T00:00:00.000Z",
        }
        respuesta = self.client.post(
            "/api/public/solicitudes",
            data={
                "nombre": "Cliente Mockup",
                "correo": "mockup@example.com",
                "mensaje": "Adjunto la vista del diseño",
                "items": json.dumps(
                    [{"productoId": self.producto.id, "cantidad": 1}]
                ),
                "archivos": (io.BytesIO(b"imagen"), "diseno-playera-2d.jpg"),
                "mockups": json.dumps(
                    [{"nombre": "diseno-playera-2d.jpg", "datos": metadatos}]
                ),
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(respuesta.status_code, 201, respuesta.get_data(as_text=True))

        archivo = SolicitudArchivo.query.order_by(SolicitudArchivo.id.desc()).first()
        self.assertIsNotNone(archivo)
        self.assertEqual(archivo.mockup_data["vista"], "2d")
        self.assertEqual(archivo.mockup_data["capas"][0]["x"], 20)
        self.assertTrue(archivo.to_dict()["esMockup"])

        solicitud = respuesta.get_json()["solicitud"]
        self.assertTrue(solicitud["archivosAdjuntos"][0]["esMockup"])
        self.assertEqual(
            solicitud["archivosAdjuntos"][0]["mockupData"]["productoNombre"],
            "Playera DTF 29 × 29 cm",
        )

    def test_05c_producto_rechaza_precio_negativo(self) -> None:
        """H-13: el backend no debe aceptar precios negativos ni al crear ni al editar."""
        negativo = self.client.post(
            "/api/productos",
            headers=self._auth(self._token()),
            json={"nombre": "Producto Negativo QA", "precioBase": -50},
        )
        self.assertEqual(negativo.status_code, 400, negativo.get_data(as_text=True))
        self.assertIn("negativo", self._json(negativo)["error"].lower())

        valido = self.client.post(
            "/api/productos",
            headers=self._auth(self._token()),
            json={"nombre": "Producto Precio Cero QA", "precioBase": 0},
        )
        self.assertEqual(valido.status_code, 201, valido.get_data(as_text=True))
        producto_id = self._json(valido)["id"]

        actualizado = self.client.put(
            f"/api/productos/{producto_id}",
            headers=self._auth(self._token()),
            json={"precioBase": -1},
        )
        self.assertEqual(actualizado.status_code, 400, actualizado.get_data(as_text=True))
        detalle = self.client.get(
            f"/api/productos/{producto_id}", headers=self._auth(self._token())
        )
        self.assertEqual(self._json(detalle)["precioBase"], 0)

    def test_05d_rechaza_solicitud_sin_partidas_o_con_importe_cero(self) -> None:
        """No se crean solicitudes vacías ni con partidas en cero."""
        base = {
            "nombre": "Cliente Sin Partidas",
            "correo": "sin-partidas@example.com",
            "mensaje": "Necesito una cotización con este mensaje suficientemente largo.",
        }

        sin_items = self.client.post("/api/public/solicitudes", json=base)
        self.assertEqual(sin_items.status_code, 400, sin_items.get_data(as_text=True))
        self.assertEqual(self._json(sin_items)["codigo"], "sin_partidas")

        cero = self.client.post(
            "/api/public/solicitudes",
            json={
                **base,
                "correo": "cantidad-cero@example.com",
                "items": [{"productoId": self.producto.id, "cantidad": 0}],
            },
        )
        self.assertEqual(cero.status_code, 400, cero.get_data(as_text=True))
        self.assertEqual(self._json(cero)["codigo"], "cantidad_invalida")

        negativo = self.client.post(
            "/api/public/solicitudes",
            json={
                **base,
                "correo": "cantidad-negativa@example.com",
                "items": [{"productoId": self.producto.id, "cantidad": -2}],
            },
        )
        self.assertEqual(negativo.status_code, 400, negativo.get_data(as_text=True))
        self.assertEqual(self._json(negativo)["codigo"], "cantidad_invalida")

        precio_cero = self.client.post(
            "/api/public/solicitudes",
            json={
                **base,
                "correo": "precio-cero@example.com",
                "items": [
                    {
                        "productoId": None,
                        "nombreProducto": "Diseño especial",
                        "cantidad": 1,
                        "precioEstimado": 0,
                    }
                ],
            },
        )
        self.assertEqual(precio_cero.status_code, 400, precio_cero.get_data(as_text=True))
        self.assertEqual(self._json(precio_cero)["codigo"], "precio_invalido")

        valida = self.client.post(
            "/api/public/solicitudes",
            json={
                **base,
                "correo": "precio-valido@example.com",
                "items": [
                    {
                        "productoId": None,
                        "nombreProducto": "Diseño especial",
                        "cantidad": 1,
                        "precioEstimado": 250,
                    }
                ],
            },
        )
        self.assertEqual(valida.status_code, 201, valida.get_data(as_text=True))
        self.assertEqual(self._json(valida)["solicitud"]["itemsSolicitados"][0]["cantidad"], 1)
        self.assertEqual(
            self._json(valida)["solicitud"]["itemsSolicitados"][0]["precioEstimado"], 250
        )

    def test_06_cotizacion_calcula_iva_y_anticipo(self) -> None:
        solicitud = self._solicitud("cotizacion@example.com")
        respuesta = self.client.post(
            "/api/cotizaciones",
            headers=self._auth(self._token()),
            json={
                "solicitudId": solicitud["solicitud"]["id"],
                "items": [
                    {
                        "productoId": self.producto.id,
                        "cantidad": 2,
                        "precioUnitario": 220,
                    }
                ],
            },
        )
        self.assertEqual(respuesta.status_code, 201, respuesta.get_data(as_text=True))
        cotizacion = self._json(respuesta)
        self.assertTrue(cotizacion["folio"].startswith(f"COT-{date.today().year}-"))
        self.assertEqual(cotizacion["subtotal"], 440.0)
        self.assertEqual(cotizacion["impuestos"], 70.4)
        self.assertEqual(cotizacion["total"], 510.4)
        self.assertEqual(cotizacion["anticipo"], 255.2)
        self.assertEqual(cotizacion["saldo"], 255.2)

    def test_07_pedido_descuenta_inventario_por_receta(self) -> None:
        antes = float(MateriaPrima.query.get(self.lona.id).stock_actual)
        respuesta = self.client.post(
            "/api/pedidos",
            headers=self._auth(self._token()),
            json={
                "clienteId": self.cliente.id,
                "items": [{"productoId": self.producto.id, "cantidad": 3}],
            },
        )
        self.assertEqual(respuesta.status_code, 201, respuesta.get_data(as_text=True))
        pedido = self._json(respuesta)
        self.assertTrue(pedido["folio"].startswith("LLM-"))

        # 2 m2 por pieza * 3 piezas * 10 % de desperdicio = 6.6 m2
        despues = float(MateriaPrima.query.get(self.lona.id).stock_actual)
        self.assertAlmostEqual(antes - despues, 6.6, places=4)
        movimiento = (
            MovimientoInventario.query.filter_by(materia_prima_id=self.lona.id)
            .order_by(MovimientoInventario.id.desc())
            .first()
        )
        self.assertAlmostEqual(float(movimiento.cantidad), 6.6, places=4)

    def test_08_rechaza_pedido_si_falta_inventario(self) -> None:
        """H-01: si falta stock no se descuenta nada ni se crea el pedido."""
        antes = float(MateriaPrima.query.get(self.tinta.id).stock_actual)
        movimientos_antes = MovimientoInventario.query.filter_by(
            materia_prima_id=self.tinta.id
        ).count()
        pedidos_antes = Pedido.query.count()

        respuesta = self.client.post(
            "/api/pedidos",
            headers=self._auth(self._token()),
            json={
                "clienteId": self.cliente.id,
                "items": [{"productoId": self.producto_parcial.id, "cantidad": 2}],
            },
        )

        self.assertEqual(respuesta.status_code, 400, respuesta.get_data(as_text=True))
        datos = self._json(respuesta)
        self.assertEqual(datos["error"], "Inventario insuficiente")
        detalle = datos["detalles"][0]
        self.assertEqual(detalle["materiaPrimaId"], self.tinta.id)
        self.assertAlmostEqual(detalle["requerido"], 8.0, places=4)
        self.assertAlmostEqual(detalle["disponible"], 5.0, places=4)
        self.assertAlmostEqual(detalle["faltante"], 3.0, places=4)

        self.assertAlmostEqual(
            float(MateriaPrima.query.get(self.tinta.id).stock_actual), antes, places=4
        )
        self.assertEqual(
            MovimientoInventario.query.filter_by(materia_prima_id=self.tinta.id).count(),
            movimientos_antes,
        )
        self.assertEqual(Pedido.query.count(), pedidos_antes)

    def test_09_pagos_validan_saldo(self) -> None:
        creado = self.client.post(
            "/api/pedidos",
            headers=self._auth(self._token()),
            json={
                "clienteId": self.cliente.id,
                "items": [{"productoId": self.producto_sin_receta.id, "cantidad": 1}],
            },
        )
        self.assertEqual(creado.status_code, 201, creado.get_data(as_text=True))
        pedido = self._json(creado)
        self.assertEqual(pedido["total"], 116.0)
        # Sin pagos, se debe el total; el anticipo es solo una referencia del 50%.
        self.assertEqual(pedido["saldo"], 116.0)

        excedido = self.client.post(
            f"/api/pedidos/{pedido['id']}/pagos",
            headers=self._auth(self._token()),
            json={"tipo": "abono", "monto": 117},
        )
        self.assertEqual(excedido.status_code, 400)

        parcial = self.client.post(
            f"/api/pedidos/{pedido['id']}/pagos",
            headers=self._auth(self._token()),
            json={"tipo": "abono", "monto": 58},
        )
        self.assertEqual(parcial.status_code, 201, parcial.get_data(as_text=True))
        self.assertEqual(self._json(parcial)["pedido"]["saldo"], 58.0)
        self.assertEqual(self._json(parcial)["pedido"]["pagado"], 58.0)

        liquidado = self.client.post(
            f"/api/pedidos/{pedido['id']}/pagos",
            headers=self._auth(self._token()),
            json={"tipo": "saldo", "monto": 58},
        )
        self.assertEqual(liquidado.status_code, 201, liquidado.get_data(as_text=True))
        pedido_final = self._json(liquidado)["pedido"]
        self.assertEqual(pedido_final["saldo"], 0.0)
        self.assertEqual(pedido_final["pagado"], 116.0)
        self.assertEqual(pedido_final["estado"], "en-produccion")

    def test_09b_saldo_usa_solo_pagos_confirmados(self) -> None:
        """El anticipo pactado no reduce el saldo hasta que se registra como pago."""
        creado = self.client.post(
            "/api/pedidos",
            headers=self._auth(self._token()),
            json={
                "clienteId": self.cliente.id,
                "items": [{"productoId": self.producto_sin_receta.id, "cantidad": 3}],
            },
        )
        self.assertEqual(creado.status_code, 201, creado.get_data(as_text=True))
        pedido = self._json(creado)
        # 3 × 100 = 300 + IVA = 348; el anticipo sugerido es 174.
        self.assertEqual(pedido["total"], 348.0)
        self.assertEqual(pedido["anticipo"], 174.0)
        self.assertEqual(pedido["saldo"], 348.0)

        pago = self.client.post(
            f"/api/pedidos/{pedido['id']}/pagos",
            headers=self._auth(self._token()),
            json={"tipo": "abono", "monto": 100},
        )
        self.assertEqual(pago.status_code, 201, pago.get_data(as_text=True))
        actualizado = self._json(pago)["pedido"]
        self.assertEqual(actualizado["saldo"], 248.0)
        self.assertEqual(actualizado["pagado"], 100.0)

        excedido = self.client.post(
            f"/api/pedidos/{pedido['id']}/pagos",
            headers=self._auth(self._token()),
            json={"tipo": "saldo", "monto": 248.01},
        )
        self.assertEqual(excedido.status_code, 400)

    def test_10_orden_compra_recibida_suma_stock(self) -> None:
        antes = float(MateriaPrima.query.get(self.lona.id).stock_actual)
        creada = self.client.post(
            "/api/ordenes-compra",
            headers=self._auth(self._token()),
            json={
                "proveedorId": self.proveedor.id,
                "items": [{"materiaPrimaId": self.lona.id, "cantidad": 10, "precioUnitario": 50}],
            },
        )
        self.assertEqual(creada.status_code, 201, creada.get_data(as_text=True))
        orden = self._json(creada)
        self.assertEqual(orden["total"], 580.0)

        recibida = self.client.patch(
            f"/api/ordenes-compra/{orden['id']}/estado",
            headers=self._auth(self._token()),
            json={"estado": "recibida"},
        )
        self.assertEqual(recibida.status_code, 200, recibida.get_data(as_text=True))
        despues = float(MateriaPrima.query.get(self.lona.id).stock_actual)
        self.assertAlmostEqual(despues - antes, 10.0, places=4)

        # Recibir dos veces no debe duplicar el stock.
        repetida = self.client.patch(
            f"/api/ordenes-compra/{orden['id']}/estado",
            headers=self._auth(self._token()),
            json={"estado": "recibida"},
        )
        self.assertEqual(repetida.status_code, 200)
        self.assertAlmostEqual(float(MateriaPrima.query.get(self.lona.id).stock_actual), despues)

    def test_11_cliente_recurrente_no_se_duplica(self) -> None:
        correo = "recurrente@example.com"
        self._solicitud(correo, nombre="Cliente Recurrente")
        self._solicitud(correo, nombre="Cliente Recurrente")
        coincidencias = Cliente.query.filter_by(correo=correo).count()
        self.assertEqual(coincidencias, 1)

    def test_12_estados_backend_y_frontend_coinciden(self) -> None:
        import estados

        fuente = (RAIZ.parent / "src/app/core/models/estados.ts").read_text(encoding="utf-8")
        for nombre in ("ESTADOS_PEDIDO", "ETAPAS", "ESTADOS_PRODUCCION", "ESTADOS_COMPRA"):
            valores = list(getattr(estados, nombre))
            for valor in valores:
                self.assertIn(
                    f"'{valor}'",
                    fuente,
                    f"{nombre}: el frontend no declara '{valor}'",
                )

    def test_13_anticipo_pagado_registra_pago_y_saldo(self) -> None:
        """El anticipo marcado como pagado se registra y deja el saldo restante."""
        creada = self.client.post(
            "/api/cotizaciones",
            headers=self._auth(self._token()),
            json={
                "clienteId": self.cliente.id,
                "items": [{"productoId": self.producto_sin_receta.id, "cantidad": 1}],
            },
        )
        self.assertEqual(creada.status_code, 201, creada.get_data(as_text=True))
        cotizacion = self._json(creada)
        self.assertEqual(cotizacion["total"], 116.0)
        self.assertEqual(cotizacion["anticipo"], 58.0)
        self.assertEqual(cotizacion["saldo"], 58.0)

        convertida = self.client.post(
            f"/api/cotizaciones/{cotizacion['id']}/convertir-pedido",
            headers=self._auth(self._token()),
            json={"anticipoPagado": True},
        )
        self.assertEqual(convertida.status_code, 201, convertida.get_data(as_text=True))
        pedido = self._json(convertida)
        self.assertEqual(len(pedido["pagos"]), 1)
        self.assertAlmostEqual(float(pedido["pagos"][0]["monto"]), 58.0, places=2)
        # El anticipo pagado es un pago real: queda pendiente el otro 50%.
        self.assertEqual(pedido["saldo"], 58.0)
        self.assertEqual(pedido["pagado"], 58.0)
        self.assertEqual(pedido["estado"], "confirmado")

    def test_14_valida_fecha_minima_de_entrega(self) -> None:
        minima = calcular_fecha_minima_entrega(date.today())
        invalida = minima - timedelta(days=1)
        mensaje = (
            "La fecha de entrega solicitada no es válida. "
            "El margen mínimo es de 2 días hábiles."
        )

        rechazada = self.client.post(
            "/api/public/solicitudes",
            json={
                "nombre": "Cliente Fecha",
                "correo": "fecha-invalida@example.com",
                "mensaje": "Quiero entrega urgente",
                "items": [{"productoId": self.producto.id, "cantidad": 1}],
                "fechaDeseada": invalida.isoformat(),
            },
        )
        self.assertEqual(rechazada.status_code, 400, rechazada.get_data(as_text=True))
        self.assertEqual(self._json(rechazada)["error"], mensaje)

        aceptada = self.client.post(
            "/api/public/solicitudes",
            json={
                "nombre": "Cliente Fecha",
                "correo": "fecha-valida@example.com",
                "mensaje": "Quiero entrega en la fecha mínima",
                "items": [{"productoId": self.producto.id, "cantidad": 1}],
                "fechaDeseada": minima.isoformat(),
            },
        )
        self.assertEqual(aceptada.status_code, 201, aceptada.get_data(as_text=True))
        self.assertEqual(self._json(aceptada)["solicitud"]["fechaDeseada"], minima.isoformat())

        pedido = self.client.post(
            "/api/pedidos",
            headers=self._auth(self._token()),
            json={
                "clienteId": self.cliente.id,
                "items": [{"productoId": self.producto_sin_receta.id, "cantidad": 1}],
                "fechaEntrega": invalida.isoformat(),
            },
        )
        self.assertEqual(pedido.status_code, 400, pedido.get_data(as_text=True))
        self.assertEqual(self._json(pedido)["error"], mensaje)

    def test_15_conversion_rechaza_fecha_invalida(self) -> None:
        minima = calcular_fecha_minima_entrega(date.today())
        invalida = minima - timedelta(days=1)
        mensaje = (
            "La fecha de entrega solicitada no es válida. "
            "El margen mínimo es de 2 días hábiles."
        )
        creada = self.client.post(
            "/api/cotizaciones",
            headers=self._auth(self._token()),
            json={
                "clienteId": self.cliente.id,
                "items": [{"productoId": self.producto_sin_receta.id, "cantidad": 1}],
            },
        )
        self.assertEqual(creada.status_code, 201, creada.get_data(as_text=True))
        cotizacion = self._json(creada)
        pedidos_antes = Pedido.query.count()

        rechazada = self.client.post(
            f"/api/cotizaciones/{cotizacion['id']}/convertir-pedido",
            headers=self._auth(self._token()),
            json={"fechaEntrega": invalida.isoformat()},
        )
        self.assertEqual(rechazada.status_code, 400, rechazada.get_data(as_text=True))
        self.assertEqual(self._json(rechazada)["error"], mensaje)
        self.assertEqual(Pedido.query.count(), pedidos_antes)

    def test_16_insumos_por_producto(self) -> None:
        headers = self._auth(self._token())
        respuesta = self.client.get("/api/productos/insumos", headers=headers)
        self.assertEqual(respuesta.status_code, 200, respuesta.get_data(as_text=True))
        productos = self._json(respuesta)["items"]
        lona = next((p for p in productos if p["id"] == self.producto.id), None)
        self.assertIsNotNone(lona)
        self.assertIsNotNone(lona["receta"])
        nombres = {
            componente["nombreMateriaPrima"] for componente in lona["receta"]["componentes"]
        }
        self.assertIn("Lona QA", nombres)
        for componente in lona["receta"]["componentes"]:
            self.assertIn("bajoStock", componente)
            self.assertIn("stockActual", componente)

        nombre = f"Servicio sin receta {date.today().isoformat()}"
        creado = self.client.post(
            "/api/productos",
            headers=headers,
            json={
                "nombre": nombre,
                "precioBase": 100,
                "categoria": "otro",
                "lineaProduccion": "gran-formato",
                "unidadVenta": "pieza",
            },
        )
        self.assertEqual(creado.status_code, 201, creado.get_data(as_text=True))
        self.assertIsNone(self._json(creado).get("receta"))
        nuevo = self.client.get("/api/productos/insumos", headers=headers)
        producto = next(
            (p for p in self._json(nuevo)["items"] if p["nombre"] == nombre), None
        )
        self.assertIsNotNone(producto)
        self.assertIsNone(producto["receta"])

    def test_17_aprobacion_descuenta_una_sola_vez(self) -> None:
        antes = float(MateriaPrima.query.get(self.lona.id).stock_actual)
        creada = self.client.post(
            "/api/cotizaciones",
            headers=self._auth(self._token()),
            json={
                "clienteId": self.cliente.id,
                "items": [{"productoId": self.producto.id, "cantidad": 1}],
            },
        )
        self.assertEqual(creada.status_code, 201, creada.get_data(as_text=True))
        cotizacion = self._json(creada)

        aprobada = self.client.patch(
            f"/api/cotizaciones/{cotizacion['id']}/estado",
            headers=self._auth(self._token()),
            json={"estado": "aprobada"},
        )
        self.assertEqual(aprobada.status_code, 200, aprobada.get_data(as_text=True))
        datos = self._json(aprobada)
        self.assertTrue(datos["inventarioDescontado"])
        self.assertTrue(datos["descuento"]["descontados"])
        despues_aprobacion = float(MateriaPrima.query.get(self.lona.id).stock_actual)
        self.assertAlmostEqual(antes - despues_aprobacion, 2.2, places=4)

        convertida = self.client.post(
            f"/api/cotizaciones/{cotizacion['id']}/convertir-pedido",
            headers=self._auth(self._token()),
            json={},
        )
        self.assertEqual(convertida.status_code, 201, convertida.get_data(as_text=True))
        despues_conversion = float(MateriaPrima.query.get(self.lona.id).stock_actual)
        self.assertAlmostEqual(despues_conversion, despues_aprobacion, places=4)
        self.assertTrue(self._json(convertida)["inventarioDescontado"])

    def test_18_vincula_producto_por_nombre_si_falta_id(self) -> None:
        antes = float(MateriaPrima.query.get(self.lona.id).stock_actual)
        creada = self.client.post(
            "/api/cotizaciones",
            headers=self._auth(self._token()),
            json={
                "clienteId": self.cliente.id,
                "items": [
                    {
                        "descripcion": self.producto.nombre,
                        "cantidad": 1,
                        "precioEstimado": 100,
                    }
                ],
            },
        )
        self.assertEqual(creada.status_code, 201, creada.get_data(as_text=True))
        cotizacion = self._json(creada)
        self.assertIsNone(cotizacion["items"][0]["productoId"])

        aprobada = self.client.patch(
            f"/api/cotizaciones/{cotizacion['id']}/estado",
            headers=self._auth(self._token()),
            json={"estado": "aprobada"},
        )
        self.assertEqual(aprobada.status_code, 200, aprobada.get_data(as_text=True))
        self.assertAlmostEqual(
            antes - float(MateriaPrima.query.get(self.lona.id).stock_actual), 2.2, places=4
        )
        actualizada = self.client.get(
            f"/api/cotizaciones/{cotizacion['id']}", headers=self._auth(self._token())
        )
        self.assertEqual(self._json(actualizada)["items"][0]["productoId"], self.producto.id)

    def test_19_aprobacion_bloquea_si_falta_stock(self) -> None:
        antes = float(MateriaPrima.query.get(self.tinta.id).stock_actual)
        creada = self.client.post(
            "/api/cotizaciones",
            headers=self._auth(self._token()),
            json={
                "clienteId": self.cliente.id,
                "items": [{"productoId": self.producto_parcial.id, "cantidad": 2}],
            },
        )
        self.assertEqual(creada.status_code, 201, creada.get_data(as_text=True))
        cotizacion = self._json(creada)

        rechazada = self.client.patch(
            f"/api/cotizaciones/{cotizacion['id']}/estado",
            headers=self._auth(self._token()),
            json={"estado": "aprobada"},
        )
        self.assertEqual(rechazada.status_code, 400, rechazada.get_data(as_text=True))
        datos = self._json(rechazada)
        self.assertEqual(datos["error"], "Inventario insuficiente")
        self.assertIn("Stock insuficiente de Tinta QA", datos["mensaje"])
        self.assertIn("Playera QA con tinta escasa", datos["mensaje"])
        self.assertAlmostEqual(
            float(MateriaPrima.query.get(self.tinta.id).stock_actual), antes, places=4
        )

        detalle = self.client.get(
            f"/api/cotizaciones/{cotizacion['id']}", headers=self._auth(self._token())
        )
        self.assertEqual(self._json(detalle)["estado"], "borrador")
        self.assertFalse(self._json(detalle)["inventarioDescontado"])

    def test_20_password_de_usuario_se_hashea(self) -> None:
        correo = "hash-check@example.com"
        password = "PasswordSeguro123!"
        creado = self.client.post(
            "/api/usuarios",
            headers=self._auth(self._token()),
            json={
                "nombre": "Usuario Hash",
                "correo": correo,
                "password": password,
                "rol": "admin",
            },
        )
        self.assertEqual(creado.status_code, 201, creado.get_data(as_text=True))
        usuario = Usuario.query.filter_by(correo=correo).first()
        self.assertIsNotNone(usuario)
        self.assertNotEqual(usuario.password_hash, password)
        self.assertNotIn(password, usuario.password_hash)
        self.assertTrue(usuario.check_password(password))
        self.assertFalse(usuario.check_password("otra-clave"))

    def test_21_mockup_conserva_canal_alfa(self) -> None:
        imagen = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
        for x in range(4, 8):
            for y in range(8):
                imagen.putpixel((x, y), (220, 30, 30, 255))
        buffer = BytesIO()
        imagen.save(buffer, format="PNG")
        buffer.seek(0)

        respuesta = self.client.post(
            "/api/public/mockups/preparar-imagen",
            data={
                "imagen": (buffer, "logo.png"),
                "quitarFondo": "false",
                "recortar": "false",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(respuesta.status_code, 200, respuesta.get_data(as_text=True))
        data_url = self._json(respuesta)["dataUrl"]
        self.assertTrue(data_url.startswith("data:image/png;base64,"))
        salida = Image.open(BytesIO(base64.b64decode(data_url.split(",", 1)[1])))
        self.assertEqual(salida.mode, "RGBA")
        alfa = salida.getchannel("A")
        self.assertEqual(alfa.getextrema(), (0, 255))


    def test_22_confirmacion_de_entrega_en_seguimiento(self) -> None:
        """La fecha comprometida y el avance se reflejan en el seguimiento público."""
        headers = self._auth(self._token())
        minima = calcular_fecha_minima_entrega(date.today())
        deseada = minima + timedelta(days=1)
        nueva = deseada + timedelta(days=2)
        correo = "seguimiento-entrega@example.com"

        solicitud_resp = self.client.post(
            "/api/public/solicitudes",
            json={
                "nombre": "Cliente Seguimiento",
                "correo": correo,
                "mensaje": "Quiero confirmar la fecha de entrega de mi pedido",
                "fechaDeseada": deseada.isoformat(),
                "items": [
                    {
                        "productoId": self.producto_sin_receta.id,
                        "nombreProducto": self.producto_sin_receta.nombre,
                        "cantidad": 1,
                    }
                ],
            },
        )
        self.assertEqual(
            solicitud_resp.status_code, 201, solicitud_resp.get_data(as_text=True)
        )
        solicitud = self._json(solicitud_resp)

        cotizacion_resp = self.client.post(
            "/api/cotizaciones",
            headers=headers,
            json={
                "solicitudId": solicitud["solicitud"]["id"],
                "items": [
                    {
                        "productoId": self.producto_sin_receta.id,
                        "cantidad": 1,
                        "precioUnitario": 100,
                    }
                ],
            },
        )
        self.assertEqual(
            cotizacion_resp.status_code, 201, cotizacion_resp.get_data(as_text=True)
        )
        cotizacion = self._json(cotizacion_resp)
        self.assertEqual(cotizacion["fechaDeseada"], deseada.isoformat())

        conversion = self.client.post(
            f"/api/cotizaciones/{cotizacion['id']}/convertir-pedido",
            headers=headers,
            json={
                "fechaEntrega": deseada.isoformat(),
                "notaEntrega": "Confirmación inicial de entrega.",
            },
        )
        self.assertEqual(conversion.status_code, 201, conversion.get_data(as_text=True))
        pedido = self._json(conversion)
        self.assertEqual(pedido["fechaEntrega"], deseada.isoformat())
        self.assertEqual(pedido["notaEntrega"], "Confirmación inicial de entrega.")
        self.assertEqual(pedido["estado"], "confirmado")
        self.assertEqual(pedido["entregaConfirmadaPor"], "QA Admin")
        self.assertIsNotNone(pedido["entregaConfirmadaEn"])

        rechazada = self.client.patch(
            f"/api/pedidos/{pedido['id']}/entrega",
            headers=headers,
            json={"fechaEntrega": date.today().isoformat()},
        )
        self.assertEqual(rechazada.status_code, 400, rechazada.get_data(as_text=True))
        self.assertEqual(self._json(rechazada)["codigo"], "fecha_invalida")

        produccion = self._auth(self._token_rol("produccion"))
        sin_permiso = self.client.patch(
            f"/api/pedidos/{pedido['id']}/entrega",
            headers=produccion,
            json={"fechaEntrega": nueva.isoformat()},
        )
        self.assertEqual(sin_permiso.status_code, 403)

        actualizada = self.client.patch(
            f"/api/pedidos/{pedido['id']}/entrega",
            headers=headers,
            json={
                "fechaEntrega": nueva.isoformat(),
                "notaEntrega": "Reprogramado por capacidad de producción.",
            },
        )
        self.assertEqual(
            actualizada.status_code, 200, actualizada.get_data(as_text=True)
        )
        reprogramado = self._json(actualizada)
        self.assertEqual(reprogramado["fechaEntrega"], nueva.isoformat())
        self.assertEqual(
            reprogramado["notaEntrega"], "Reprogramado por capacidad de producción."
        )
        self.assertEqual(reprogramado["entregaConfirmadaPor"], "QA Admin")

        publico = self.client.get(
            f"/api/public/solicitudes/{solicitud['folio']}?correo={correo}"
        )
        self.assertEqual(publico.status_code, 200, publico.get_data(as_text=True))
        seguimiento = self._json(publico)
        self.assertEqual(seguimiento["fechaDeseada"], deseada.isoformat())
        self.assertEqual(seguimiento["pedido"]["fechaEntrega"], nueva.isoformat())
        self.assertEqual(seguimiento["pedido"]["fechaDeseada"], deseada.isoformat())
        self.assertEqual(
            seguimiento["pedido"]["notaEntrega"],
            "Reprogramado por capacidad de producción.",
        )
        self.assertEqual(seguimiento["pedido"]["estado"], "confirmado")
        self.assertEqual(seguimiento["pedido"]["etapaActual"], "diseno")
        self.assertTrue(seguimiento["pedido"]["historialEtapas"])

        avance = self.client.patch(
            f"/api/produccion/ordenes/{pedido['ordenProduccion']['id']}",
            headers=headers,
            json={"etapa": "impresion", "estado": "en-proceso"},
        )
        self.assertEqual(avance.status_code, 200, avance.get_data(as_text=True))

        publico_avanzado = self.client.get(
            f"/api/public/solicitudes/{solicitud['folio']}?correo={correo}"
        )
        self.assertEqual(
            publico_avanzado.status_code, 200, publico_avanzado.get_data(as_text=True)
        )
        pedido_publico = self._json(publico_avanzado)["pedido"]
        self.assertEqual(pedido_publico["estado"], "en-produccion")
        self.assertEqual(pedido_publico["etapaActual"], "impresion")
        self.assertEqual(pedido_publico["estadoProduccion"], "en-proceso")
        self.assertEqual(
            [etapa["etapa"] for etapa in pedido_publico["historialEtapas"]],
            ["diseno", "impresion", "corte", "empaquetado"],
        )


    def test_24_solicitud_refleja_produccion_completada(self) -> None:
        """Completar la última etapa deja el pedido listo y visible en solicitudes."""
        headers = self._auth(self._token())
        correo = "produccion-solicitud@example.com"
        solicitud_resp = self.client.post(
            "/api/public/solicitudes",
            json={
                "nombre": "Cliente Producción",
                "correo": correo,
                "mensaje": "Quiero seguir el avance de producción de mi pedido",
                "items": [
                    {
                        "productoId": self.producto_sin_receta.id,
                        "nombreProducto": self.producto_sin_receta.nombre,
                        "cantidad": 1,
                    }
                ],
            },
        )
        self.assertEqual(
            solicitud_resp.status_code, 201, solicitud_resp.get_data(as_text=True)
        )
        solicitud = self._json(solicitud_resp)

        cotizacion_resp = self.client.post(
            "/api/cotizaciones",
            headers=headers,
            json={
                "solicitudId": solicitud["solicitud"]["id"],
                "items": [
                    {
                        "productoId": self.producto_sin_receta.id,
                        "cantidad": 1,
                        "precioUnitario": 100,
                    }
                ],
            },
        )
        self.assertEqual(
            cotizacion_resp.status_code, 201, cotizacion_resp.get_data(as_text=True)
        )
        cotizacion = self._json(cotizacion_resp)
        conversion = self.client.post(
            f"/api/cotizaciones/{cotizacion['id']}/convertir-pedido",
            headers=headers,
            json={},
        )
        self.assertEqual(conversion.status_code, 201, conversion.get_data(as_text=True))
        pedido = self._json(conversion)
        orden_id = pedido["ordenProduccion"]["id"]

        # No se puede cerrar la orden desde una etapa anterior a la última.
        prematura = self.client.patch(
            f"/api/produccion/ordenes/{orden_id}",
            headers=headers,
            json={"estado": "completada"},
        )
        self.assertEqual(prematura.status_code, 400, prematura.get_data(as_text=True))
        self.assertEqual(self._json(prematura)["codigo"], "etapa_incompleta")

        for etapa in ("impresion", "corte", "empaquetado"):
            avance = self.client.patch(
                f"/api/produccion/ordenes/{orden_id}",
                headers=headers,
                json={"etapa": etapa, "estado": "en-proceso"},
            )
            self.assertEqual(avance.status_code, 200, avance.get_data(as_text=True))

        completada = self.client.patch(
            f"/api/produccion/ordenes/{orden_id}",
            headers=headers,
            json={"estado": "completada"},
        )
        self.assertEqual(
            completada.status_code, 200, completada.get_data(as_text=True)
        )
        orden = self._json(completada)
        self.assertEqual(orden["estado"], "completada")
        self.assertEqual(orden["etapa"], "empaquetado")
        self.assertTrue(all(etapa["estado"] == "completada" for etapa in orden["historialEtapas"]))

        detalle = self.client.get(
            f"/api/solicitudes/{solicitud['solicitud']['id']}", headers=headers
        )
        self.assertEqual(detalle.status_code, 200, detalle.get_data(as_text=True))
        solicitud_actualizada = self._json(detalle)
        self.assertEqual(solicitud_actualizada["estado"], "convertida")
        self.assertEqual(solicitud_actualizada["pedido"]["folio"], pedido["folio"])
        self.assertEqual(solicitud_actualizada["pedido"]["estado"], "listo")
        self.assertEqual(
            solicitud_actualizada["pedido"]["produccion"]["estado"], "completada"
        )
        self.assertEqual(
            solicitud_actualizada["pedido"]["produccion"]["etapa"], "empaquetado"
        )

        completadas = self.client.get(
            f"/api/solicitudes?produccion=completada&q={solicitud['folio']}",
            headers=headers,
        )
        self.assertEqual(completadas.status_code, 200, completadas.get_data(as_text=True))
        self.assertEqual(self._json(completadas)["total"], 1)
        activas = self.client.get(
            f"/api/solicitudes?produccion=activa&q={solicitud['folio']}",
            headers=headers,
        )
        self.assertEqual(activas.status_code, 200, activas.get_data(as_text=True))
        self.assertEqual(self._json(activas)["total"], 0)

        resumen = self.client.get("/api/solicitudes/resumen", headers=headers)
        self.assertEqual(resumen.status_code, 200, resumen.get_data(as_text=True))
        self.assertGreaterEqual(self._json(resumen)["produccionCompletada"], 1)

        entregado = self.client.patch(
            f"/api/pedidos/{pedido['id']}/estado",
            headers=headers,
            json={"estado": "entregado"},
        )
        self.assertEqual(entregado.status_code, 200, entregado.get_data(as_text=True))
        self.assertEqual(self._json(entregado)["estado"], "entregado")

        detalle_entregado = self.client.get(
            f"/api/solicitudes/{solicitud['solicitud']['id']}", headers=headers
        )
        self.assertEqual(
            detalle_entregado.status_code, 200, detalle_entregado.get_data(as_text=True)
        )
        pedido_entregado = self._json(detalle_entregado)["pedido"]
        self.assertEqual(pedido_entregado["estado"], "entregado")
        self.assertEqual(pedido_entregado["produccion"]["estado"], "completada")

        filtro_entrega = self.client.get(
            f"/api/solicitudes?entrega=entregado&q={solicitud['folio']}",
            headers=headers,
        )
        self.assertEqual(
            filtro_entrega.status_code, 200, filtro_entrega.get_data(as_text=True)
        )
        self.assertEqual(self._json(filtro_entrega)["total"], 1)

        resumen_entrega = self.client.get("/api/solicitudes/resumen", headers=headers)
        self.assertGreaterEqual(self._json(resumen_entrega)["entregados"], 1)

    def test_23_mayoreo_desde_seis_piezas(self) -> None:
        """A partir de 6 unidades se rebajan $20 por unidad, sin importes negativos."""
        headers = self._auth(self._token())
        casos = [
            (5, 500.0, 0.0),
            (6, 480.0, 120.0),
            (10, 800.0, 200.0),
            (5, 500.0, 0.0),
        ]
        solicitud_seis = None

        for indice, (cantidad, esperado, descuento) in enumerate(casos):
            respuesta = self.client.post(
                "/api/public/solicitudes",
                json={
                    "nombre": f"Cliente Mayoreo {indice}",
                    "correo": f"mayoreo-{indice}@example.com",
                    "mensaje": f"Quiero {cantidad} piezas con precio de mayoreo",
                    "items": [
                        {
                            "productoId": self.producto_sin_receta.id,
                            "cantidad": cantidad,
                        }
                    ],
                },
            )
            self.assertEqual(respuesta.status_code, 201, respuesta.get_data(as_text=True))
            datos = self._json(respuesta)
            item = datos["solicitud"]["itemsSolicitados"][0]
            self.assertEqual(item["precioEstimado"], esperado)
            self.assertEqual(item["descuentoMayoreo"], descuento)
            if cantidad == 6:
                solicitud_seis = datos

        self.assertIsNotNone(solicitud_seis)

        # La conversión conserva el importe final y lo reparte en precio unitario.
        cotizacion_resp = self.client.post(
            "/api/cotizaciones",
            headers=headers,
            json={"solicitudId": solicitud_seis["solicitud"]["id"]},
        )
        self.assertEqual(
            cotizacion_resp.status_code, 201, cotizacion_resp.get_data(as_text=True)
        )
        cotizacion = self._json(cotizacion_resp)
        self.assertEqual(cotizacion["subtotal"], 480.0)
        self.assertEqual(cotizacion["impuestos"], 76.8)
        self.assertEqual(cotizacion["total"], 556.8)
        self.assertEqual(cotizacion["items"][0]["precioUnitario"], 80.0)
        self.assertEqual(cotizacion["items"][0]["importe"], 480.0)

        # Una cotización capturada a mano aplica la misma regla.
        manual = self.client.post(
            "/api/cotizaciones",
            headers=headers,
            json={
                "clienteId": self.cliente.id,
                "items": [
                    {
                        "productoId": self.producto_sin_receta.id,
                        "cantidad": 6,
                        "precioUnitario": 100,
                    }
                ],
            },
        )
        self.assertEqual(manual.status_code, 201, manual.get_data(as_text=True))
        manual_data = self._json(manual)
        self.assertEqual(manual_data["items"][0]["precioUnitario"], 80.0)
        self.assertEqual(manual_data["items"][0]["importe"], 480.0)
        self.assertEqual(manual_data["total"], 556.8)

        # Un producto de precio bajo no se queda en cero ni negativo.
        bajo = Producto(
            nombre="Producto Bajo QA",
            categoria="otro",
            linea_produccion="gran-formato",
            precio_base=15,
            unidad_venta="pieza",
        )
        db.session.add(bajo)
        db.session.commit()
        bajo_resp = self.client.post(
            "/api/public/solicitudes",
            json={
                "nombre": "Cliente Bajo",
                "correo": "mayoreo-bajo@example.com",
                "mensaje": "Quiero seis piezas de un producto económico",
                "items": [{"productoId": bajo.id, "cantidad": 6}],
            },
        )
        self.assertEqual(bajo_resp.status_code, 201, bajo_resp.get_data(as_text=True))
        bajo_item = self._json(bajo_resp)["solicitud"]["itemsSolicitados"][0]
        self.assertEqual(bajo_item["precioEstimado"], 90.0)
        self.assertEqual(bajo_item["descuentoMayoreo"], 0.0)

        # Lona/Vinil conserva su fórmula base + adicionales y aplica mayoreo.
        lona = Producto(
            nombre="Lona/Vinil QA",
            categoria="gran-formato",
            linea_produccion="gran-formato",
            precio_base=220,
            unidad_venta="m2",
        )
        db.session.add(lona)
        db.session.commit()
        lona_resp = self.client.post(
            "/api/public/solicitudes",
            json={
                "nombre": "Cliente Lona Mayoreo",
                "correo": "mayoreo-lona@example.com",
                "mensaje": "Quiero seis metros cuadrados de lona",
                "items": [
                    {
                        "productoId": lona.id,
                        "nombreProducto": "Lona/Vinil QA",
                        "cantidad": 6,
                        "especificaciones": "Medida 1 × 6 m (6 m²)",
                    }
                ],
            },
        )
        self.assertEqual(lona_resp.status_code, 201, lona_resp.get_data(as_text=True))
        lona_item = self._json(lona_resp)["solicitud"]["itemsSolicitados"][0]
        # 220 + 5 × 120 = 820; menos 6 × 20 = 700.
        self.assertEqual(lona_item["precioEstimado"], 700.0)
        self.assertEqual(lona_item["descuentoMayoreo"], 120.0)


if __name__ == "__main__":
    unittest.main()

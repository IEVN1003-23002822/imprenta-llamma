"""Pruebas de flujo de la API sobre una base SQLite aislada.

Se ejecutan con la biblioteca estándar, sin dependencias nuevas:

    .venv\\Scripts\\python.exe -m unittest discover -s tests -v

Cubren los flujos críticos de arranque, login, solicitud pública, cotización,
pedido con descuento de inventario, pagos, órdenes de compra y adjuntos.
"""

from __future__ import annotations

import io
import json
import os
import shutil
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

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
        self.assertEqual(pedido["saldo"], 58.0)

        excedido = self.client.post(
            f"/api/pedidos/{pedido['id']}/pagos",
            headers=self._auth(self._token()),
            json={"tipo": "abono", "monto": 100},
        )
        self.assertEqual(excedido.status_code, 400)

        liquidado = self.client.post(
            f"/api/pedidos/{pedido['id']}/pagos",
            headers=self._auth(self._token()),
            json={"tipo": "saldo", "monto": 58},
        )
        self.assertEqual(liquidado.status_code, 201, liquidado.get_data(as_text=True))
        self.assertEqual(self._json(liquidado)["pedido"]["saldo"], 0.0)
        self.assertEqual(self._json(liquidado)["pedido"]["estado"], "en-produccion")

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

    def test_13_anticipo_pagado_reduce_saldo(self) -> None:
        """H-12: el pago del anticipo debe liquidar el saldo del pedido."""
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
        self.assertEqual(pedido["saldo"], 0)
        self.assertEqual(pedido["estado"], "en-produccion")

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


if __name__ == "__main__":
    unittest.main()

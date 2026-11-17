# Llamma

Sistema web de la imprenta y empresa de transformación de productos **Llamma**. La aplicación está
dividida en dos experiencias segmentadas:

- **Portal público:** landing corporativa, catálogo y solicitud de cotización para clientes externos,
  sin autenticación.
- **ERP interno:** panel protegido por autenticación y roles, con bandeja de solicitudes, cotizador,
  pedidos, inventario, producción, clientes y marketing.

## Tecnologías

- **Frontend:** Angular 22+ (Standalone Components, Signals, Reactive Forms, Angular Router).
- **UI:** Bootstrap 5.3, Bootstrap Icons y Google Fonts (Space Grotesk / Inter).
- **Backend:** Python + Flask, Flask-Cors, Flask-SQLAlchemy, PyMySQL.
- **Base de datos:** MySQL en producción; SQLite para desarrollo local.
- **Estilos:** CSS con sistema de diseño institucional CMYK.

## Identidad visual

| Color              | Hex       | Uso                                    |
| ------------------ | --------- | -------------------------------------- |
| Cian vibrante      | `#00AEEF` | Acentos, enlaces y datos positivos.    |
| Magenta intenso    | `#EC008C` | Llamados a la acción y énfasis.        |
| Amarillo proceso   | `#FFF200` | Botones principales y sellos gráficos. |
| Negro carbón       | `#1A1A1A` | Fondos, tipografía y estructura.       |

## Sistema dual

### Portal público

| Ruta        | Descripción                                                          |
| ----------- | -------------------------------------------------------------------- |
| `/`         | Landing corporativa con llamados a cotizar y ver catálogo.           |
| `/productos`| Catálogo activo con precios base, filtros por línea y búsqueda.      |
| `/cotizar`  | Formulario de solicitud, constructor de partidas, adjuntos y folio.  |
| `/login`    | Acceso exclusivo del equipo interno.                                 |

El seguimiento de una solicitud se consulta en `/cotizar#seguimiento` con folio + correo. Al enviar
el formulario se muestra el folio `SOL-YYYY-NNN`, se puede copiar y descargar el comprobante.

### ERP interno

Todas las rutas internas están protegidas con `authGuard` y, cuando aplica, `roleGuard`:

`/dashboard`, `/solicitudes`, `/captura`, `/detalle`, `/consultas`, `/inventario`,
`/abastecimiento`, `/produccion`, `/clientes` y `/marketing`.

La barra interna muestra un contador de solicitudes nuevas. La bandeja `/solicitudes` permite
filtrar por estado, revisar el detalle, copiar correo, abrir WhatsApp, descargar adjuntos, cambiar
estado y convertir el lead en cotización.

### Endpoints principales

Públicos:

- `GET /api/public/productos`
- `POST /api/public/solicitudes` (JSON o multipart con `archivos`)
- `GET /api/public/solicitudes/<folio>?correo=...`

Internos (Bearer token):

- `POST /api/auth/login`
- `GET /api/solicitudes`
- `GET /api/solicitudes/<id>`
- `PATCH /api/solicitudes/<id>/estado`
- `POST /api/solicitudes/<id>/convertir-cotizacion`
- `GET /api/solicitudes/resumen`
- `GET|POST /api/cotizaciones`
- `GET|POST /api/pedidos`
- Resto de módulos operativos del ERP.

## Estructura del proyecto

```text
Llamma/
├── Flask_Llamma_API/
│   ├── app.py
│   ├── auth.py
│   ├── config.py
│   ├── extensions.py
│   ├── models.py
│   ├── seed.py
│   ├── utils.py
│   ├── routes/
│   │   ├── auth_routes.py
│   │   ├── public_routes.py
│   │   └── admin_routes.py
│   └── requirements.txt
├── public/
├── src/
│   ├── app/
│   │   ├── llamma/
│   │   │   ├── auth.guard.ts
│   │   │   ├── auth.interceptor.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── solicitudes.store.ts
│   │   │   ├── cotizar/
│   │   │   ├── solicitudes/
│   │   │   ├── captura/
│   │   │   └── ...módulos del ERP
│   │   ├── app.config.ts
│   │   ├── app.routes.ts
│   │   ├── app.ts
│   │   ├── app.html
│   │   └── app.css
│   ├── index.html
│   ├── main.ts
│   ├── assets/
│   │   └── images/
│   │       └── logo-llamma.png
│   └── styles.css
├── proxy.conf.json
├── angular.json
└── package.json
```

## Módulos funcionales

| Módulo           | Propósito                                                          |
| ---------------- | ------------------------------------------------------------------ |
| `home`           | Landing corporativa y propuesta de valor.                          |
| `productos`      | Catálogo público con precios base y filtros.                       |
| `cotizar`        | Solicitud pública con partidas, adjuntos, folio y seguimiento.     |
| `login`          | Autenticación del equipo y roles.                                  |
| `solicitudes`    | Bandeja de leads con filtros, detalle y conversión a cotización.   |
| `dashboard`      | KPIs, ventas y métricas del negocio.                               |
| `captura`        | Cotizador interno, IVA, anticipo y conversión a pedido.            |
| `detalle`        | Historial y desglose de órdenes.                                   |
| `consultas`      | Filtros dinámicos por día, mes y cliente.                          |
| `inventario`     | Control de existencias de materias primas.                         |
| `abastecimiento` | Reglas de stock mínimo/máximo y compras.                           |
| `produccion`     | Seguimiento de etapas de transformación y calidad.                 |
| `clientes`       | Directorio, segmentación e historial de clientes.                  |
| `marketing`      | Estrategia promocional, ROI y calendario de actividades.           |

## Puesta en marcha

### Frontend

```bash
npm install
npm start
```

Disponible en `http://localhost:4200`. El archivo `proxy.conf.json` redirige `/api` a
`http://127.0.0.1:5000`.

### Backend

```bash
cd Flask_Llamma_API
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Con SQLite para desarrollo:

```powershell
$env:DATABASE_URL="sqlite:///llamma_dev.db"
flask --app app init-db
flask --app app seed-db
python app.py
```

La API se ejecuta en `http://127.0.0.1:5000`. Para MySQL, define `DATABASE_URL` con el driver
`mysql+pymysql://usuario:password@host/base`.

### Base de datos MySQL en Laragon

El archivo `llamma_laragon.sql` de la raíz contiene el esquema completo y los datos demo: 26 tablas,
llaves foráneas, índices, cotejamiento `utf8mb4_unicode_ci` y seeds.

1. Arranca MySQL 8 desde Laragon (`localhost:3306`, usuario `root` sin contraseña).
2. Importa el archivo desde HeidiSQL/phpMyAdmin o por consola:

```powershell
& "C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe" -u root < llamma_laragon.sql
```

El dump crea/restaura `llamma_db`. Como alternativa equivalente puedes regenerar la base desde
Flask con `flask --app app init-db` y `flask --app app seed-db`.

### Usuarios demo

Contraseña para todos: `llamma2026`.

| Correo               | Rol        |
| -------------------- | ---------- |
| `ana@llamma.mx`      | admin      |
| `diego@llamma.mx`    | ventas     |
| `mariana@llamma.mx`  | produccion |
| `ivan@llamma.mx`     | inventario |
| `paola@llamma.mx`    | marketing  |

## Estado

- Backend funcional con 26 tablas, autenticación por token, roles y permisos.
- Portal público con catálogo, solicitud de cotización, adjuntos y seguimiento.
- ERP interno con bandeja de solicitudes, conversión a cotización y pedido.
- Inventario, producción, clientes y marketing conectados a la API.
- Build de producción limpio y datos demo cargados con `seed-db`.

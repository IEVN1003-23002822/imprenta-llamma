# Llamma

Sistema web de la imprenta y empresa de transformación de productos **Llamma**. La aplicación está
dividida en dos experiencias segmentadas:

- **Portal público:** landing corporativa, catálogo y solicitud de cotización para clientes externos,
  sin autenticación.
- **ERP interno:** panel protegido por autenticación y roles, con bandeja de solicitudes, cotizador,
  pedidos, inventario, producción, clientes y marketing.

## Tecnologías

- **Frontend:** Angular 22+ (Standalone Components, Signals, Reactive Forms, Angular Router).
- **UI:** Tailwind CSS 4 + Flowbite, Bootstrap Icons y fuentes autoalojadas (Space Grotesk / Inter).
- **Backend:** Python + Flask, Flask-Cors, Flask-SQLAlchemy, PyMySQL.
- **Base de datos:** MySQL en producción; SQLite para desarrollo local.
- **Estilos:** capas de Tailwind (`theme`, `base`, `components`, `utilities`) con el sistema de diseño
  institucional CMYK y utilidades propias.

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
| `/seguimiento` | Consulta de estatus por folio + correo, chat y adjuntos.          |
| `/login`    | Acceso exclusivo del equipo interno.                                 |
| `/aviso-privacidad` | Aviso de privacidad y datos de contacto del responsable.     |

El seguimiento vive en `/seguimiento` y acepta `?folio=SOL-YYYY-NNN&correo=...` para abrir el
resultado directo. Al enviar el formulario se muestra el folio, se puede copiar y descargar el
comprobante; el botón «Consultar estatus» del comprobante lleva a esa ruta con los datos
precargados. Dentro del seguimiento, el cliente puede chatear con el equipo de Llamma: el
historial, el envío de mensajes y los adjuntos quedan ligados a la solicitud sin necesidad de
crear una cuenta.

El cotizador guarda un borrador en `localStorage` (`llamma.cotizacion.borrador.v1`) durante 30
días, con formulario, partidas, paso activo y metadatos de los archivos. Los adjuntos deben
volver a seleccionarse por seguridad.

#### SEO, estado de red y catálogo

- Cada ruta declara su descripción en `data.seo` (`app.routes.ts`) y `SeoService` aplica título,
  descripción, canonical, `robots`, Open Graph/Twitter y JSON-LD `LocalBusiness`. El ERP y el login
  se marcan `noindex, nofollow`.
- `public/robots.txt` y `public/sitemap.xml` usan el dominio provisional `https://llamma.mx`; al
  publicar en otro dominio hay que actualizar ambos, el `canonical` estático de `src/index.html` y
  las etiquetas sociales de ese archivo.
- Cualquier ruta desconocida muestra el 404 (`no-encontrado`) con buscador que navega a
  `/productos?q=...`; el catálogo lee `q` de la URL.
- `resilienciaInterceptor` corta las peticiones a los 20 s y reintenta una vez solo los `GET` ante
  `status 0` o 5xx. Los errores de red se traducen a mensajes claros en `UiService`.
- El catálogo público se comparte con `shareReplay`; las mutaciones del ERP llaman
  `listarProductosPublicos(true)` para invalidar la copia.
- Las secciones bajas de la portada (materias primas y proceso) viven en
  `HomeDetalleComponent` y se cargan con `@defer (on viewport)`, con esqueleto en
  `prefers-reduced-motion`.
- Las acciones destructivas usan `ConfirmacionService` (diálogo con `appModalAccesible`), no
  `window.confirm`.
- `productos.imagen_url` guarda la foto del producto. Debe ser una ruta local (`assets/...`) o del
  mismo dominio por la CSP; si la imagen falla, la tarjeta vuelve al icono.

### ERP interno

Todas las rutas internas están protegidas con `authGuard` y, cuando aplica, `roleGuard`:

`/dashboard`, `/solicitudes`, `/captura`, `/detalle`, `/consultas`, `/inventario`,
`/abastecimiento`, `/produccion`, `/clientes` y `/marketing`.

La barra interna muestra un contador de solicitudes nuevas. La bandeja `/solicitudes` permite
filtrar por estado, revisar el detalle, copiar correo, abrir WhatsApp, descargar adjuntos, cambiar
estado, responder el chat del cliente y convertir el lead en cotización.

### Endpoints principales

Públicos:

- `GET /api/public/productos`
- `POST /api/public/solicitudes` (JSON o multipart con `archivos`)
- `GET /api/public/solicitudes/<folio>?correo=...` (incluye el hilo del chat)
- `GET /api/public/solicitudes/<folio>/mensajes?correo=...`
- `POST /api/public/solicitudes/<folio>/mensajes` (JSON o multipart con `archivo`)
- `GET /api/public/solicitudes/<folio>/mensajes/<id>/archivo?correo=...`

Internos (Bearer token):

- `POST /api/auth/login`
- `GET /api/solicitudes`
- `GET /api/solicitudes/<id>` (incluye `mensajes`)
- `PATCH /api/solicitudes/<id>/estado`
- `POST /api/solicitudes/<id>/convertir-cotizacion`
- `GET /api/solicitudes/resumen`
- `GET|POST /api/solicitudes/<id>/mensajes`
- `GET /api/mensajes/<id>/archivo`
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
│   ├── estados.py
│   ├── extensions.py
│   ├── models.py
│   ├── ratelimit.py
│   ├── seed.py
│   ├── utils.py
│   ├── routes/
│   │   ├── admin_routes.py        # reúne los blueprints internos
│   │   ├── comun.py               # helpers compartidos del ERP
│   │   ├── auth_routes.py
│   │   ├── public_routes.py
│   │   ├── solicitudes_routes.py
│   │   ├── cotizaciones_routes.py
│   │   ├── pedidos_routes.py
│   │   ├── clientes_routes.py
│   │   ├── productos_routes.py
│   │   ├── inventario_routes.py
│   │   ├── compras_routes.py
│   │   ├── produccion_routes.py
│   │   ├── marketing_routes.py
│   │   ├── dashboard_routes.py
│   │   ├── usuarios_routes.py
│   │   └── archivos_routes.py
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

### Calidad y pruebas

| Comando | Qué hace |
| --- | --- |
| `npm run lint` | ESLint 10 + angular-eslint sobre plantillas y TypeScript. |
| `npm run format` / `npm run format:check` | Aplica o verifica Prettier en `src/**/*.{ts,html,css}`. |
| `npm test` | Vitest sobre los `*.spec.ts` (servicios, guards e interceptor). En local usa `npx ng test --watch=false` para una sola pasada. |
| `npm run build` | Compila plantillas, aplica budgets y genera `dist/llamma`. |

Las pruebas corren con `@angular/build:unit-test`, Vitest y jsdom. Hay dos ajustes propios:

- `vitest-base.config.mts` convierte los `include` absolutos que entrega Angular CLI en rutas
  relativas. Sin eso, `tinyglobby` no encuentra los archivos en Windows y Vitest responde
  «No test files found».
- `src/test-setup.ts` vuelve a enlazar `localStorage` y `sessionStorage` con la ventana de jsdom.
  Node 26 los expone como globales experimentales que devuelven `undefined` si no se arranca con
  `--localstorage-file`, y esa sombra tapa los de jsdom.

El flujo `.github/workflows/ci.yml` ejecuta `npm ci`, `npm run format:check`, `npm run lint`,
`npm test -- --watch=false` y `npm run build` en cada push a `main` y en cada pull request.

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

El archivo `llamma_laragon.sql` de la raíz contiene el esquema completo y los datos demo: 27 tablas,
llaves foráneas, índices, cotejamiento `utf8mb4_unicode_ci` y seeds.

1. Arranca MySQL 8 desde Laragon (`localhost:3306`, usuario `root` sin contraseña).
2. Importa el archivo desde HeidiSQL/phpMyAdmin o por consola:

```powershell
& "C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe" -u root < llamma_laragon.sql
```

El dump crea/restaura `llamma_db`. Como alternativa equivalente puedes regenerar la base desde
Flask con `flask --app app init-db` y `flask --app app seed-db`.

### Configuración y seguridad

La API arranca en modo desarrollo con valores locales. Antes de publicarla define al menos
`LLAMMA_ENV=production` y una `SECRET_KEY` propia: sin ella `create_app` falla a propósito.

| Variable | Valor por defecto | Uso |
| --- | --- | --- |
| `LLAMMA_ENV` | `development` | `production` exige `SECRET_KEY`, desactiva el depurador y quita el aviso de desarrollo. |
| `SECRET_KEY` | vacío (clave fija en desarrollo) | **Obligatoria en producción.** |
| `FLASK_DEBUG` | `0` | `1` activa el depurador solo fuera de producción. |
| `CORS_ORIGINS` | `http://localhost:4200,http://127.0.0.1:4200` | Orígenes autorizados, separados por coma. |
| `TRUST_PROXY_HEADERS` | `0` | `1` solo detrás de un proxy de confianza (usa `X-Forwarded-For`). |
| `TOKEN_TTL_HOURS` | `12` | Vigencia de la sesión del equipo. |
| `LOGIN_MAX_INTENTOS` / `LOGIN_VENTANA_SEGUNDOS` | `10` / `60` | Intentos de login por IP. |
| `LOGIN_MAX_POR_CUENTA` / `LOGIN_VENTANA_CUENTA_SEGUNDOS` | `5` / `300` | Intentos por correo. |
| `PUBLICO_MAX_SOLICITUDES` / `PUBLICO_VENTANA_SEGUNDOS` | `5` / `3600` | Solicitudes nuevas por IP. |
| `PUBLICO_MAX_CONSULTAS` / `PUBLICO_VENTANA_CONSULTAS_SEGUNDOS` | `60` / `60` | Consultas de folio y descargas públicas. |
| `CHAT_MAX_MENSAJES` / `CHAT_VENTANA_SEGUNDOS` | `20` / `600` | Mensajes de chat por folio e IP. |

Los límites se guardan **en memoria y por proceso** (`ratelimit.py`). Sirven para una instancia o
para desarrollo; con varios workers hay que sustituirlos por Flask-Limiter con Redis manteniendo la
misma interfaz. Al superar un límite la API responde `429` con `Retry-After`.

El token de sesión viaja **solo** en `Authorization: Bearer` (o `X-Auth-Token`). Ya no se acepta
`?token=` en la URL, para no filtrarlo en logs, historial ni `Referer`. En el frontend,
«Recordarme» decide si la sesión se guarda en `localStorage` (persiste al cerrar el navegador) o en
`sessionStorage`; la expiración se revisa cada 30 segundos y un `401` cierra la sesión y regresa al
login con el aviso correspondiente.

Los datos de contacto del portal (teléfono, WhatsApp, dirección y horario) se editan en
`src/app/llamma/site-info.ts`. Los campos vacíos no se muestran en el pie de página. El correo
`soporte@llamma.mx` es el canal público de soporte y privacidad.

> Las credenciales demo son solo para desarrollo local. Elimina o cambia esos usuarios antes de
> publicar el sistema.

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

- Backend funcional con 27 tablas, autenticación por token, roles y permisos.
- Portal público con catálogo, solicitud de cotización, adjuntos y seguimiento.
- ERP interno con bandeja de solicitudes, conversión a cotización y pedido.
- Inventario, producción, clientes y marketing conectados a la API.
- Build de producción limpio y datos demo cargados con `seed-db`.
- Fase 0 de seguridad aplicada: login sin credenciales demo visibles, «Recordarme», expiración y
  manejo global de `401`, cabeceras de seguridad, CORS restringido, límites de peticiones, token
  solo por cabecera, contraste accesible del CTA, pie de página con contacto y aviso de privacidad.
- Fase 1 de acceso y usabilidad aplicada: Bootstrap, Bootstrap Icons e Inter/Space Grotesk
  autoalojados con CSP (el framework Bootstrap se retiró en la migración a Tailwind); `/seguimiento`
  como ruta propia; modales con foco atrapado, `Esc` y
  `aria-labelledby`; stepper y borrador del cotizador; skip link, `aria-current`, captions y
  `scope="col"` en tablas, etiquetas de controles y foco en el primer error de cada formulario.
- Fase 2 de conversión aplicada: logo WebP con `srcset`, 404 real, SEO social por ruta con
  `robots.txt`/`sitemap.xml`, `timeout` y reintento de `GET`, catálogo cacheado, confirmaciones
  propias, `@defer` de las secciones bajas de la portada y soporte de fotos de producto.
- Fase 3 en curso: catálogo único de estados en `src/app/llamma/estados.ts` y `Flask_Llamma_API/estados.py`;
  ESLint + Prettier con `build` como compuerta; 53 pruebas unitarias de servicios, guards, interceptores
  y catálogo de estados; CI que valida formato, lint, pruebas y build.
- Migración visual a Tailwind CSS 4 + Flowbite completada el 19 de noviembre de 2026: Bootstrap ya no
  se carga, las utilidades se expresan en Tailwind, las clases semánticas viven en la capa
  `components` de `src/styles.css` y el contenedor pasó a `.llamma-container`. Se conservan Bootstrap
  Icons (solo los glifos `bi-*`) y se verificó login, navegación, modales, tablas, paginación y menús
  móviles con el build de producción sin advertencias.
- **Pendiente de contenido:** no hay fotos reales de producto ni portafolio/testimonios
  autorizados. Las secciones de prueba social permanecen ocultas hasta capturarlos en
  `site-info.ts` y `assets/images/productos/`.

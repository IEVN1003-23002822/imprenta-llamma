# AGENTS.md

Llamma es un portal público + ERP interno: SPA Angular 22 en la raíz y API Flask + MySQL en
`Flask_Llamma_API/`. UI, endpoints, modelos y mensajes están en español; mantén ese idioma.

## Arranque

- API: `cd Flask_Llamma_API` y `.venv\Scripts\python.exe app.py` → `http://127.0.0.1:5000`.
  Los imports son planos (`from config import Config`, `from models import ...`), así que **debe**
  ejecutarse desde esa carpeta.
- Frontend: `npm start` → abre `http://localhost:4200`. Usa `localhost`, no `127.0.0.1`
  (el dev server escucha en `::1` y `127.0.0.1:4200` puede no responder).
- `ng serve` ya aplica `proxy.conf.json` (`/api` → `127.0.0.1:5000`, configurado en `angular.json`).
  Todo el frontend usa rutas relativas (`LlammaService.apiUrl = '/api'`); sin ese proxy no hay datos.
- La interfaz usa **Tailwind CSS v4** con el plugin de **Flowbite** (`.postcssrc.json` +
  `src/styles.css`). Bootstrap ya no se carga: las clases semánticas de las plantillas (`navbar`,
  `btn`, `modal`, `table`, `badge`, …) se conservan y se definen en la capa `components` de
  `src/styles.css`. Bootstrap Icons sigue viniendo de `node_modules` (solo los glifos `bi-*`).
- El contenedor propio es `.llamma-container`, no `.container`: Tailwind genera su propia utilidad
  `.container` y ambas chocarían. Para rejillas usa `grid grid-cols-12 gap-x-* gap-y-*`; no
  reintroduzcas `row`, `col-*`, `d-*` ni utilidades de Bootstrap.
- El plugin de Flowbite se registra con `forms: false` porque su base de formularios emite selectores
  inválidos (`:is()`) que rompen el CSS crítico; los formularios usan la capa propia del proyecto.
- Los recursos estáticos propios se sirven desde `public/` (raíz) y desde `src/assets/` (mapeado a
  `/assets` en `angular.json`). El logotipo oficial vive en `src/assets/images/logo-llamma.png`;
  en plantillas se referencia como `assets/images/...`.

## Verificación

- `npm run lint` (ESLint + angular-eslint), `npm run format:check` (Prettier) y
  `npx ng test --watch=false` (Vitest + jsdom) deben quedar en verde antes de dar algo por terminado.
  `npm test` sin argumentos entra en modo watch si hay TTY.
- Los specs viven junto al código (`src/app/llamma/*.spec.ts`) e importan `describe/it/expect/vi` de
  `'vitest'` de forma explícita. `src/test-setup.ts` y `vitest-base.config.mts` son obligatorios: el
  primero reenlaza `localStorage`/`sessionStorage` de jsdom frente a los globales experimentales de
  Node 26 y el segundo relativiza los `include` absolutos que `tinyglobby` no resuelve en Windows.
- `npm run build` compila plantillas y aplica budgets; es la última compuerta del flujo
  `.github/workflows/ci.yml`, que también corre formato, lint y pruebas en cada push y pull request.
- Budget de producción: 16 kB warning / 20 kB **error** por estilos de componente
  (`anyComponentStyle`). Los estilos compartidos van a `src/styles.css`.

## Base de datos

- MySQL de Laragon por defecto: `mysql+pymysql://root:@127.0.0.1:3306/llamma_db?charset=utf8mb4`
  (root sin contraseña). `DATABASE_URL` lo sobreescribe; SQLite es solo para pruebas.
- No hay `python-dotenv`: un `.env` **no** se carga. Exporta las variables en la shell.
- `flask --app app init-db` crea las 27 tablas sin borrar nada; `seed-db` carga los datos demo y
  **se omite si ya existe algún usuario**. Para reiniciar datos, borra la BD o reimporta el dump.
- `llamma_laragon.sql` es un dump `--databases` con `DROP TABLE`: importarlo **reemplaza**
  `llamma_db`. Regenerarlo con
  `mysqldump --databases llamma_db --default-character-set=utf8mb4 --set-gtid-purged=OFF
  --single-transaction --routines --triggers --result-file=llamma_laragon.sql`
  (binario en `C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin`).
- Usuarios demo y contraseña: ver `README.md` (`llamma2026`). Son solo para desarrollo local.

## Seguridad y entorno

- En producción define `LLAMMA_ENV=production` y `SECRET_KEY`; sin clave `create_app` lanza
  `RuntimeError`. `FLASK_DEBUG=1` solo tiene efecto fuera de producción.
- `CORS_ORIGINS` limita los orígenes del frontend (lista separada por comas). `TRUST_PROXY_HEADERS=1`
  solo si hay un proxy de confianza delante; de lo contrario `X-Forwarded-For` se ignora.
- El token de sesión solo se acepta en `Authorization: Bearer` o `X-Auth-Token`. **No** reintroduzcas
  `?token=` en la URL.
- `ratelimit.py` limita login (por IP y por cuenta), solicitudes públicas, consultas/descargas y chat.
  Es en memoria y por proceso: con varios workers hay que cambiarlo por Flask-Limiter + Redis
  manteniendo `excedido()`, `reiniciar()` y `demasiadas_peticiones()`. Responde `429` con
  `Retry-After` y sus topes se configuran con las variables documentadas en `README.md`.
- `app.py` añade cabeceras de seguridad (`nosniff`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, COOP, HSTS en HTTPS y `Cache-Control: no-store` en `/api`).
- Los datos de contacto del portal viven en `src/app/llamma/site-info.ts`; los campos vacíos no se
  renderizan. El aviso de privacidad está en `/aviso-privacidad` y su texto es una base LFPDPPP que
  debe revisarse con asesoría legal antes de publicarse.

## Contratos API ↔ frontend

- El backend separa los endpoints internos por dominio en `routes/*_routes.py`; `admin_routes.py`
  solo reúne `ADMIN_BLUEPRINTS` y `routes/comun.py` concentra los helpers que cruzan dominios
  (totales, alta de clientes, partidas y descuento de inventario). Un endpoint nuevo va en el
  módulo de su dominio; si creas un blueprint, agrégalo a `ADMIN_BLUEPRINTS`.
- El backend serializa con `to_dict()` en camelCase y los tipos espejo están en
  `src/app/llamma/llamma.models.ts`. Un campo o estado nuevo exige tocar ambos lados.
- Los estados válidos se declaran una sola vez por lado: `Flask_Llamma_API/estados.py`
  (`ESTADOS_PEDIDO`, `ETAPAS`, `ESTADOS_PRODUCCION`, `ESTADOS_COMPRA`, `CANALES`, …) y
  `src/app/llamma/estados.ts` con el campo `valor` y las ayudas `etiquetaDe`/`badgeDe`/`iconoDe`.
  Un estado nuevo exige tocar la unión de `llamma.models.ts`, ese catálogo y el backend; no
  reintroduzcas mapas de etiqueta o badge locales en los componentes.
- Los listados devuelven `{ items, total }`. `GET /api/pedidos` omite `items`: usa
  `GET /api/pedidos/<id>` para el detalle (producción lo carga aparte y lo cachea por pedido).
- El chat por solicitud vive en `mensajes_chat` y se serializa como `mensajes`. El cliente entra
  solo con folio + correo exactos (`/api/public/solicitudes/<folio>/mensajes`); el interno exige
  rol `admin` o `ventas` (`/api/solicitudes/<id>/mensajes`). `GET /api/solicitudes/<id>` ya incluye
  `mensajes`, y los adjuntos se descargan con token en `/api/mensajes/<id>/archivo` (en público,
  `/api/public/solicitudes/<folio>/mensajes/<id>/archivo?correo=...`).
- `PATCH /api/produccion/ordenes/<id>` ignora `observaciones: null` o `""`; no se puede limpiar
  desde la API (se hizo por SQL cuando fue necesario).
- Permisos: `@token_required` y `@role_required(...)` de `Flask_Llamma_API/auth.py`; roles `admin`,
  `ventas`, `produccion`, `inventario`, `marketing`. En Angular, `authGuard`/`roleGuard` con
  `data.roles` en `app.routes.ts`.
- Pasar una OC a `recibida` (`PATCH /api/ordenes-compra/<id>/estado`) suma stock y crea un
  `MovimientoInventario` tipo `entrada`; no dupliques ese ajuste a mano.

## Convenciones frontend

- Componentes standalone con `ChangeDetectionStrategy.OnPush`, signals, `inject()` y control flow
  `@if`/`@for`. Nada de datos mock: todo pasa por `LlammaService` (HttpClient) y los toasts por
  `UiService`.
- El seguimiento público es su propio componente y ruta (`/seguimiento`); el cotizador solo enlaza
  con `folio`/`correo` por query params. No vuelvas a incrustar el formulario de seguimiento en
  `/cotizar`.
- Los modales usan la directiva `appModalAccesible` (`src/app/llamma/modal-accesible.directive.ts`):
  rol de diálogo, `aria-labelledby` al `.modal-title`, foco inicial, trampa de Tab, `Esc` mediante
  `(cerrar)` y bloqueo de scroll. No dupliques esa lógica a mano.
- Accesibilidad mínima obligatoria: skip link y `<main id="contenido">`, `aria-current="page"` en la
  navegación vía `esRuta()`, `<caption class="sr-only">` + `scope="col"` en cada tabla,
  nombre accesible en todo control y `aria-invalid`/`aria-describedby` con foco al primer error.
- Las acciones destructivas usan `ConfirmacionService.confirmar(...)` (diálogo global con
  `appModalAccesible`). No uses `window.confirm`: el único punto de montaje es
  `<app-confirmacion-dialog />` en `app.html`.
- El SEO de cada ruta se declara en `data.seo` (`app.routes.ts`) y lo aplica `SeoService`
  (`src/app/llamma/seo.service.ts`): descripción, canonical, `robots`, OG/Twitter y JSON-LD. El ERP y
  el login van `noindex`. Si cambias el dominio, ajusta `robots.txt`, `sitemap.xml` y `src/index.html`.
- `resilienciaInterceptor` aplica `timeout` de 20 s y un reintento solo a `GET` (status 0/5xx). No
  reintentes escrituras: duplicarían altas y movimientos de inventario.
- `listarProductosPublicos()` cachea el catálogo con `shareReplay`; tras crear, editar, publicar o dar
  de baja un producto llama `listarProductosPublicos(true)` para invalidar la copia.
- La foto de producto es `productos.imagen_url` (`imagenUrl` en la API y en los tipos TS). Debe ser
  una ruta local o del mismo dominio: la CSP solo permite `img-src 'self' data: blob:`. Si la imagen
  falla, la tarjeta vuelve al icono.
- Las secciones bajas de la portada viven en `HomeDetalleComponent` y se cargan con
  `@defer (on viewport)`. Mantén ahí su HTML y CSS para que el chunk de la portada no crezca.
- El borrador del cotizador se guarda en `localStorage` con la clave
  `llamma.cotizacion.borrador.v1` (30 días). Los archivos no se persisten: solo sus metadatos y se
  pide volver a adjuntarlos.
- La sesión vive en `llamma.session.v1` como `{ usuario, token, permisos, expiraEn }`: en
  `localStorage` si el usuario marcó «Recordarme» y en `sessionStorage` si no. El interceptor añade
  `Authorization: Bearer` salvo en `/public/` y `/auth/login`; ante un `401` cierra la sesión, evita
  toasts duplicados y redirige a `/login?expirada=1&redirect=...`. La expiración también se revisa
  cada 30 segundos.
- Para verificar rutas internas con un navegador automatizado, haz `POST /api/auth/login`, guarda
  esa respuesta en la clave anterior y recarga; los guards redirigen sin sesión.

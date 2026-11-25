# AGENTS.md

Llamma es un portal público + ERP interno: SPA Angular 22 en la raíz y API Flask + MySQL en
`Flask_Llamma_API/`. UI, endpoints, modelos y mensajes están en español; mantén ese idioma.

## Arranque

- API: `cd Flask_Llamma_API` y `.venv\Scripts\python.exe app.py` → `http://127.0.0.1:5000`.
  Los imports son planos (`from config import Config`, `from models import ...`), así que **debe**
  ejecutarse desde esa carpeta. Dependencias en `Flask_Llamma_API/requirements.txt`; el venv del repo
  es `.venv` (no versionado).
- Frontend: `npm start` → abre `http://localhost:4200`. Usa `localhost`, no `127.0.0.1`
  (el dev server escucha en `::1` y `127.0.0.1:4200` puede no responder).
- `ng serve` ya aplica `proxy.conf.json` (`/api` → `127.0.0.1:5000`, configurado en `angular.json`).
  Todo el frontend usa rutas relativas (`LlammaService.apiUrl = '/api'`); sin ese proxy no hay datos.
- Para compartir el dev server, `angular.json` ya permite `allowedHosts: [".ngrok-free.app"]`; un
  túnel a `4200` basta porque el proxy sirve `/api`. No expongas la API directamente.
- La interfaz usa **Tailwind CSS v4** con el plugin de **Flowbite** (`.postcssrc.json` +
  `src/styles.css`). Bootstrap ya no se carga; solo queda `bootstrap-icons` para los glifos `bi-*`.
- Ya usan utilidades Tailwind sin CSS propio: shell (`app.html`), `login`, `clientes`,
  `no-encontrado`, `aviso-privacidad`, `productos` y `seguimiento`.
  `app.css`, `login.component.css`, `clientes.component.css`, `no-encontrado.component.css`,
  `aviso-privacidad.component.css`, `productos.component.css` y `seguimiento.component.css` solo
  conservan un comentario.
- `dashboard`, `solicitudes`, `detalle` y `produccion` tienen las primitivas en Tailwind, pero aún
  conservan CSS local para kanban, timeline, listas y resúmenes. `home`, `cotizar`, `marketing`,
  `captura`, `abastecimiento`, `consultas` e `inventario` todavía dependen de clases semánticas de
  `src/styles.css`; no borres esas reglas hasta migrar cada módulo.
- El contenedor propio es `.llamma-container`, no `.container`: Tailwind genera su propia utilidad
  `.container` y ambas chocarían. Para rejillas usa `grid grid-cols-12 gap-x-* gap-y-*`; no
  reintroduzcas `row`, `col-*`, `d-*` ni utilidades de Bootstrap.
- El plugin de Flowbite se registra con `forms: false` porque su base de formularios emite selectores
  inválidos (`:is()`) que rompen el CSS crítico; los formularios usan la capa propia del proyecto.
- Los recursos estáticos propios se sirven desde `public/` (raíz) y desde `src/assets/` (mapeado a
  `/assets` en `angular.json`). El logotipo oficial servido es
  `src/assets/images/logo-llamma.webp`; el PNG se conserva como fuente. El favicon usa
  `public/favicon.webp` y `public/favicon.ico` queda como respaldo legacy.
- La vitrina «Nuestros productos» de la portada usa `#nuestros-productos` y las imágenes WebP de
  `src/assets/images/portafolio/{textil,promocionales}`. Los casos se declaran en `PORTAFOLIO`
  (`src/app/core/config/site-info.ts`). No agregues otro ítem al navbar: el acceso secundario está en
  el footer. Los JPG fuente de `Lamma  Mockup realista/` no se publican y están ignorados por Git.
- Las vistas previas del catálogo viven en
  `src/assets/images/catalogo/{gran-formato,textil,promocionales,papeleria}` y se asignan a
  `productos.imagen_url`; la tarjeta usa encuadre cuadrado `object-contain` y vuelve al icono si la
  imagen falla. Los archivos fuente de `Imagenes catalago/` están ignorados por Git.

## Estructura

- Frontend: `src/app/core/` (servicios singleton, modelos, guards, interceptores y configuración),
  `src/app/shared/` (UI reutilizable: diálogo de confirmación y directiva de modales) y
  `src/app/features/` (un directorio por dominio: `home`, `productos`, `cotizar`, `detalle`, …).
  Cada componente conserva su TS/HTML/CSS juntos; los subcomponentes del cotizador viven dentro de
  `features/cotizar/`.
- Backend: `models/` agrupa las 27 tablas por dominio (`usuarios`, `catalogos`, `inventario`,
  `compras`, `solicitudes`, `ventas`, `produccion`, `marketing`) y `models/__init__.py` reexporta
  todo, así que los imports existentes (`from models import Pedido`) siguen siendo válidos.
  `routes/` mantiene un blueprint por dominio y `migrations/` guarda scripts de esquema y datos.
- Los módulos de arranque (`app.py`, `config.py`, `extensions.py`, `auth.py`, `ratelimit.py`,
  `utils.py`, `estados.py`, `seed.py`) se quedan en la raíz para conservar `flask --app app` y los
  imports planos.

## Verificación

- `npm run lint` (ESLint + angular-eslint), `npm run format:check` (Prettier) y
  `npx ng test --watch=false` (Vitest + jsdom) deben quedar en verde antes de dar algo por terminado.
  `npm test` sin argumentos entra en modo watch si hay TTY.
- Orden del CI frontend: `format:check` → `lint` → `test -- --watch=false` → `build`.
- El backend tiene pruebas de flujo en `Flask_Llamma_API/tests/` con `unittest` y SQLite temporal
  (no tocan `llamma_db`): `.venv\Scripts\python.exe -m unittest discover -s tests -v`.
  Antes, valida sintaxis con `.venv\Scripts\python.exe -m compileall -q app.py auth.py config.py
  estados.py extensions.py ratelimit.py seed.py utils.py models routes migrations tests` y, si hace
  falta, prueba los endpoints contra la API viva.
- Un solo spec: `npx ng test --watch=false --include=src/app/core/services/auth.service.spec.ts`
  (o `--filter='AuthService'` para filtrar por nombre).
- Los specs viven junto al código (`src/app/**/*.spec.ts`) e importan `describe/it/expect/vi` de
  `'vitest'` de forma explícita. `src/test-setup.ts` y `vitest-base.config.mts` son obligatorios: el
  primero reenlaza `localStorage`/`sessionStorage` de jsdom frente a los globales experimentales de
  Node 26 y el segundo relativiza los `include` absolutos que `tinyglobby` no resuelve en Windows.
  El CI usa Node 22 y `npm test -- --watch=false`.
- `npm run build` compila plantillas y aplica budgets; es la última compuerta del job `frontend` de
  `.github/workflows/ci.yml`, que también corre formato, lint y pruebas en cada push y pull request.
  El job `backend` instala `requirements.txt` y ejecuta las pruebas de flujo en SQLite.
- E2E: `npm run test:e2e` (Playwright) usa un backend Flask aislado en `:5001` con SQLite en
  `e2e/.tmp/` y un `ng serve` en `:4300` con `e2e/proxy.e2e.json`; nunca toca `llamma_db`.
  `e2e/global-setup.ts` crea un `storageState` por rol (admin `ana`, ventas `diego`, marketing
  `paola`). Los 4 proyectos son `chromium`, `firefox`, `webkit` y `mobile-chrome`. El job E2E de CI
  aún no está aplicado; la propuesta vive en `AUDITORIA-E2E-PLAYWRIGHT.md`.
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
- Los índices de rendimiento se declaran en `models/*.py` (bases nuevas) y se aplican a una base
  existente con `.venv\Scripts\python.exe migrations\indices_rendimiento.py` (idempotente). La
  versión SQL equivalente está en `migrations/2026_11_indices_rendimiento.sql`.
- La bandera `inventario_descontado` se aplica con
  `.venv\Scripts\python.exe migrations\inventario_descontado.py` (idempotente) en bases existentes.
  Las medidas de recetas (sticker 5×5) se actualizan con
  `.venv\Scripts\python.exe migrations\recetas_medidas.py`.
- Los precios oficiales del catálogo se actualizan con
  `.venv\Scripts\python.exe migrations\precios_productos.py` (idempotente): Lona `$220` por
  `1 m²` + `$120` por m² adicional, playera `$220` (29 × 29 cm) / `$200` (menor) y taza `$85`.
  El cálculo de lona en el cotizador aplica la misma regla base + adicionales.
- Las fotos del catálogo se asignan con
  `.venv\Scripts\python.exe migrations\imagenes_catalogo.py` (idempotente); `seed.py` ya incluye
  `imagen` para cada producto. Si renombras una playera, actualiza también el alias de
  `MOCKUPS_CATALOGO` en `cotizar.component.ts`.
- El dump `llamma_laragon.sql` **no** se regenera automáticamente tras cambios de datos
  (precios/fotos): aplica las migraciones sobre `llamma_db` o vuelve a generarlo antes de usarlo como
  fuente de verdad.
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
- Los datos de contacto del portal viven en `src/app/core/config/site-info.ts`; los campos vacíos no se
  renderizan. El aviso de privacidad está en `/aviso-privacidad` y su texto es una base LFPDPPP que
  debe revisarse con asesoría legal antes de publicarse.

## Contratos API ↔ frontend

- El backend separa los endpoints internos por dominio en `routes/*_routes.py`; `admin_routes.py`
  solo reúne `ADMIN_BLUEPRINTS` y `routes/comun.py` concentra los helpers que cruzan dominios
  (totales, alta de clientes, partidas y descuento de inventario). Un endpoint nuevo va en el
  módulo de su dominio; si creas un blueprint, agrégalo a `ADMIN_BLUEPRINTS`.
- El backend serializa con `to_dict()` en camelCase y los tipos espejo están en
  `src/app/core/models/llamma.models.ts`. Un campo o estado nuevo exige tocar ambos lados.
- Los estados válidos se declaran una sola vez por lado: `Flask_Llamma_API/estados.py`
  (`ESTADOS_PEDIDO`, `ETAPAS`, `ESTADOS_PRODUCCION`, `ESTADOS_COMPRA`, `CANALES`, …) y
  `src/app/core/models/estados.ts` con el campo `valor` y las ayudas `etiquetaDe`/`badgeDe`/`iconoDe`.
  Un estado nuevo exige tocar la unión de `llamma.models.ts`, ese catálogo y el backend; no
  reintroduzcas mapas de etiqueta o badge locales en los componentes.
- Los listados devuelven `{ items, total }`. `GET /api/pedidos` omite `items`: usa
  `GET /api/pedidos/<id>` para el detalle (producción lo carga aparte y lo cachea por pedido).
  Las consultas de listado cargan relaciones con `joinedload` (many-to-one) y `selectinload`
  (colecciones) para que `to_dict()` no dispare N+1; no agregues un `to_dict()` que toque una
  relación sin su opción de carga.
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
- `_descontar_inventario` valida **todo** el stock de la receta antes de tocar la base. Si falta,
  lanza `InventarioInsuficiente` con `mensaje` y `detalles`; la ruta hace rollback y responde `400`
  con `{ error: "Inventario insuficiente", mensaje, detalles }`. Se ejecuta al aprobar la cotización
  o al convertirla en pedido, y la bandera `inventario_descontado` evita el doble descuento.
  La respuesta incluye `descuento: { descontados, alertas }`. Aplica la migración
  `migrations/inventario_descontado.py` en bases existentes.
- Las fechas de entrega (`fechaDeseada` en solicitudes y `fechaEntrega` en pedidos/conversión)
  deben respetar **2 días hábiles**. La regla vive en `utils.calcular_fecha_minima_entrega()`,
  los festivos en `config.DIAS_FESTIVOS` y la API responde `400` con
  `MENSAJE_FECHA_MINIMA`. Ver `REGLAS-ENTREGA.md` para actualizar cierres cada año.
- `GET /api/productos/insumos` devuelve los productos activos con `receta` y sus componentes
  (`nombreMateriaPrima`, `stockActual`, `bajoStock`). Usa `joinedload`/`selectinload` para evitar
  N+1; un producto sin receta viaja con `receta: null`.

## Convenciones frontend

- Componentes standalone con `ChangeDetectionStrategy.OnPush`, signals, `inject()` y control flow
  `@if`/`@for`. Nada de datos mock: todo pasa por `LlammaService` (HttpClient) y los toasts por
  `UiService`.
- El seguimiento público es su propio componente y ruta (`/seguimiento`); el cotizador solo enlaza
  con `folio`/`correo` por query params. No vuelvas a incrustar el formulario de seguimiento en
  `/cotizar`.
- Los modales usan la directiva `appModalAccesible` (`src/app/shared/modal-accesible.directive.ts`):
  rol de diálogo, `aria-labelledby` al `[data-modal-title]` (o `.modal-title` de módulos antiguos),
  foco inicial dentro de `[data-modal-body]` (o `.modal-body`), trampa de Tab, `Esc` mediante
  `(cerrar)` y bloqueo de scroll. No dupliques esa lógica a mano.
- La vista `/detalle` usa divulgación progresiva: los paneles secundarios (`produccion`, `calidad`,
  `pagos`, `entrega`, `archivos`) se pliegan con `estaAbierta()`/`alternarSeccion()` sobre un
  `signal` y recuerdan su estado por dispositivo en `llamma.detalle.secciones.v1`. `imprimir()` los
  abre antes de imprimir y restaura la preferencia; un panel nuevo debe seguir ese mismo patrón.
- La visibilidad de los accesos del menú «Módulos» se controla con `modulosVisibles` en `app.ts`.
  Marketing está en `false` por decisión de producto: su ruta, componente y permisos siguen
  activos. Cambia la bandera a `true` para reactivarlo; no borres la entrada de `app.html`.
- `/usuarios` es solo para `admin` (`authGuard` + `roleGuard`), con tabla y alta en la misma
  página. El acceso del menú «Módulos» se muestra con `auth.esAdmin()`. El formulario incluye
  indicador de fuerza de contraseña; el mínimo de 8 se valida también en el backend.
- En `captura`, el botón «Aprobar cotización» descuenta inventario y muestra el resumen; después
  «Convertir en pedido» no vuelve a descontar gracias a `inventario_descontado`.
- Las fechas de entrega usan `src/app/core/utils/fechas.ts` (misma regla que el backend) y
  `src/app/core/config/dias-festivos.ts`; el `min` del input y la cláusula visible se alimentan
  de esa utilidad. No dupliques listas de festivos en componentes.
- `inventario` alterna entre tarjetas por producto (default) y tabla general con
  `vistaActual`. El botón «Reponer» reutiliza `abrirAjuste(materia, 'entrada')`; no crees un
  segundo modal de entradas.
- El cotizador público muestra Ancho × Largo (m) para productos vendidos en m² y envía el área
  como `cantidad`; «Lona Frontlit impresa» añade selector Lona/Vinil y oculta «Lonas». Los
  productos por pieza conservan la cantidad capturada. Fórmulas: lona `$220 + $120/m² adicional`;
  vinil `$180 + $90/m² adicional`. La aprobación bloquea si falta stock y devuelve `descuento`.
- La previsualización de mockups de `/cotizar` vive en `cotizar.component.*`: catálogo
  `MOCKUPS_CATALOGO` indexado por nombre de producto, imágenes en
  `src/assets/images/mockups/*.webp` y área de impresión en
  porcentajes. El calibrador interno solo se habilita con `/cotizar?calibrar=1`. Si un producto
  no tiene entrada en `MOCKUPS_CATALOGO`, el modal 2D muestra «Previsualización no disponible».
- «Adjuntar diseño 2D» y «Adjuntar vista 3D» exportan la escena a JPEG (`canvas.toBlob`) y la suman
  a `archivos()`; `mockups()` guarda la metadata por nombre de archivo y `crearSolicitud` la envía en
  el campo `mockups`. El backend la persiste en `solicitud_archivos.mockup_data` (JSON). El panel
  `/solicitudes` muestra la tarjeta «Previsualización del diseño» descargando el blob con token y
  ofrece la descarga de la captura; aplica `migrations/mockup_data_archivos.py` en bases existentes.
- El comprobante de `/cotizar` se genera con `jspdf` + `jspdf-autotable` bajo demanda
  (`import('jspdf')`, chunk aparte): A4 vectorial, sin `window.print()` ni HTML oculto, logo
  rasterizado a 220 px y archivo `Comprobante_<folio>_Llamma.pdf`. Las tablas largas paginan solas y
  cada página lleva pie con las cláusulas de entrega y datos de contacto.
- El login marca correo y contraseña con `aria-invalid` cuando la API responde `401` y limpia esa
  marca al escribir; el mensaje global queda en un `role="alert"` con `id="authError"`.
  `POST/PUT /api/productos` rechazan `precioBase < 0` con `400 precio_invalido`.
- `e2e/tests/smoke/auditoria-panel.spec.ts` recorre las 10 rutas internas y falla ante cualquier
  `console.error`, `pageerror` o respuesta `4xx/5xx`. `e2e/tests/usuarios/registro-login.spec.ts`
  cubre alta → login → logout con un contexto limpio y verifica que se vacíen ambos storages.
- El visor 3D usa `CotizarMockup3dComponent` con `three` y modelos GLB en
  `src/assets/models/`; las imágenes del cliente se optimizan en
  `POST /api/public/mockups/preparar-imagen` (Pillow en `requirements.txt`). Mientras carga
  muestra un overlay; si el GLB falla, cae a un modelo procedural con aviso «Vista aproximada»
  y si WebGL no inicia muestra un error explícito.
- Accesibilidad mínima obligatoria: skip link y `<main id="contenido">`, `aria-current="page"` en la
  navegación vía `esRuta()`, `<caption class="sr-only">` + `scope="col"` en cada tabla,
  nombre accesible en todo control y `aria-invalid`/`aria-describedby` con foco al primer error.
- Las acciones destructivas usan `ConfirmacionService.confirmar(...)` (diálogo global con
  `appModalAccesible`). No uses `window.confirm`: el único punto de montaje es
  `<app-confirmacion-dialog />` en `app.html`.
- El SEO de cada ruta se declara en `data.seo` (`app.routes.ts`) y lo aplica `SeoService`
  (`src/app/core/services/seo.service.ts`): descripción, canonical, `robots`, OG/Twitter y JSON-LD. El ERP y
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

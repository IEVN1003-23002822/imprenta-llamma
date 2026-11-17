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
- Bootstrap 5.3 y Bootstrap Icons vienen por CDN desde `src/index.html`, no de `package.json`.
  Los overrides globales van en `src/styles.css`.
- Los recursos estáticos propios se sirven desde `public/` (raíz) y desde `src/assets/` (mapeado a
  `/assets` en `angular.json`). El logotipo oficial vive en `src/assets/images/logo-llamma.png`;
  en plantillas se referencia como `assets/images/...`.

## Verificación

- No hay tests (`**/*.spec.ts` está vacío): `npm test` / `ng test` falla con "No tests found".
  Verifica con `npm run build`, que compila plantillas y aplica budgets.
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
- Usuarios demo y contraseña: ver `README.md` (`llamma2026`).

## Contratos API ↔ frontend

- El backend serializa con `to_dict()` en camelCase y los tipos espejo están en
  `src/app/llamma/llamma.models.ts`. Un campo o estado nuevo exige tocar ambos lados.
- Los estados válidos son constantes al inicio de `routes/admin_routes.py` (`ESTADOS_PEDIDO`,
  `ETAPAS`, `ESTADOS_PRODUCCION`, `ESTADOS_COMPRA`, `CANALES`, …) y están duplicados como uniones
  TS más mapas de etiqueta/badge en los componentes. Actualiza todas las copias.
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
- La sesión vive en `localStorage['llamma.session.v1']` como `{ usuario, token, permisos, expiraEn }`.
  El interceptor añade `Authorization: Bearer` salvo en `/public/` y `/auth/login`.
- Para verificar rutas internas con un navegador automatizado, haz `POST /api/auth/login`, guarda
  esa respuesta en la clave anterior y recarga; los guards redirigen sin sesión.

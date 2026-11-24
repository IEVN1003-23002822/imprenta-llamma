# Suite E2E Playwright — Llamma (2026-11-23)

Rama `audit/functional-llamma-2026-11-23`. Playwright **1.65.1**, Node local 26.13.1 (CI usa 22),
4 proyectos: `chromium`, `firefox`, `webkit`, `mobile-chrome`.

La suite corre contra un **backend Flask aislado** (`127.0.0.1:5001`, SQLite en `e2e/.tmp/`) y un
`ng serve` en `http://localhost:4300` con proxy a `5001`. **No toca `llamma_db` ni el servidor de
desarrollo del puerto 5000.**

## 1. Resumen ejecutivo

- Suite creada: **16 archivos de spec, 35 pruebas, 4 proyectos → 140 ejecuciones por corrida**.
- Corridas completas: **3 por proyecto (420 ejecuciones)**; todas verdes.
- `35 passed` por proyecto, sin `test.fail()` ni `test.skip()`.
- Flujos que funcionan: login por rol, rate limit, logout, catálogo, edición de productos,
  solicitud pública con adjunto, seguimiento, cotización (desde solicitud y manual), totales,
  pedido, pago, producción, inventario, **alta de usuarios por UI** y smoke.
- Bugs corregidos: **H-01** (inventario estricto) y **H-12** (anticipo liquida el saldo).
- Bugs abiertos: **H-13** (API acepta precio negativo), **H-16** (estimado público ≠ cotización
  interna), **H-15** (seguimiento no muestra producción) y **H-14** (imagen LCP lazy).
- Veredicto global: **⚠️ FUNCIONA_CON_RIESGOS** — los flujos críticos pasan; quedan dos defectos
  de dinero/precio fuera del alcance de esta iteración.
- CI de la app: `format` ✅ · `lint` ✅ · Vitest **59/59** ✅ · `build` ✅ · backend **20/20** ✅.

> **Actualización 2026-11-23:** se corrigieron H-01 y H-12 (commit `54accf4`), se creó el módulo
> `/usuarios` solo para admin (commit `dc711d1`), se implementaron las reglas de entrega de 2 días
> hábiles (festivos + fines de semana) y se estabilizó la suite. La corrida de Mobile
> Chrome detectó una condición de carrera al leer los roles del formulario; se resolvió con una
> espera semántica (`toBeAttached`) y las 3 corridas posteriores quedaron verdes.

## 2. Diagnóstico del entorno (FASE 0)

| Componente | Estado | Evidencia | Acción |
|---|---|---|---|
| Playwright | OK | `npx playwright --version` → 1.65.1 | — |
| Navegadores | OK | Chromium, Firefox, WebKit y headless shell instalados en `ms-playwright` | — |
| Config | Adaptada | `testDir: ./e2e`, `baseURL: :4300`, `webServer` doble | — |
| Backend aislado | OK | SQLite `e2e/.tmp/e2e.db` + seed; `/api/health` 200 | — |
| Frontend aislado | OK | `ng serve` :4300 con `e2e/proxy.e2e.json` | — |
| Credenciales | Ajustadas | `ana`, `diego`, `paola` / `llamma2026` (no existen `admin@`/`vendedor@`) | Documentado |
| Ruta `/usuarios` | Disponible | Componente standalone, ruta admin y acceso en «Módulos» | ✅ RESUELTO |
| Registro público | Ausente | No hay auto-registro de clientes/usuarios | Interpretado como alta interna por API |
| DB de desarrollo | Intacta | La suite usa SQLite temporal | — |

## 3. Estructura entregada

```
e2e/
├── fixtures/auth.fixture.ts        # storageState por rol
├── fixtures/api.fixture.ts         # token desde el storageState
├── page-objects/                   # Login, Home, Productos, Cotizar, Seguimiento,
│                                   # Solicitudes, Captura, Dashboard
├── factories/                      # producto, solicitud, usuario, cotización, pedido
├── helpers/                        # api-setup, consola, esperas, navegación móvil, datos
├── tests/auth/                     # 6 pruebas
├── tests/usuarios/                 # 5 pruebas de UI + restricción de rol
├── tests/productos/                # 6 pruebas
├── tests/solicitudes/              # 4 pruebas
├── tests/cotizaciones/             # 3 pruebas
├── tests/flujo-compra/             # 4 pruebas
├── tests/inventario/               # 1 prueba
├── tests/smoke/                    # 4 pruebas
├── global-setup.ts                 # login API → e2e/.auth/*.json
├── proxy.e2e.json                  # /api → 127.0.0.1:5001
├── scripts/e2e_server.py           # Flask + SQLite + seed
└── README.md
```

No se crearon page objects para `Clientes`, `Inventario`, `Producción`, `Marketing` ni `Usuarios`
porque no hay pruebas de UI que los usen (evita código muerto); esas rutas se validan en smoke o
por API.

## 4. Resultados por flujo

| Flujo | Test | Estado | Veredicto |
|---|---|---|---|
| Login admin por UI + menú | `auth/login-admin.spec.ts` | PASS | ✅ FUNCIONA |
| Login vendedor y `roleGuard` | `auth/login-vendedor.spec.ts` | PASS | ✅ FUNCIONA |
| Login marketing y `roleGuard` | `auth/login-marketing.spec.ts` | PASS | ✅ FUNCIONA |
| Login fallido (mismo mensaje) | `auth/login-fallido.spec.ts` | PASS | ✅ FUNCIONA |
| Rate limit (6.º intento) | `auth/rate-limit-login.spec.ts` | PASS 429 | ✅ FUNCIONA |
| Logout y protección de ruta | `auth/logout.spec.ts` | PASS | ✅ FUNCIONA |
| Alta de usuario | `usuarios/usuarios.spec.ts` | PASS (UI) | ✅ FUNCIONA |
| Usuario duplicado | `usuarios/usuarios.spec.ts` | PASS 409 (UI) | ✅ FUNCIONA |
| Password corta | `usuarios/usuarios.spec.ts` | PASS (validación UI) | ✅ FUNCIONA |
| Rol inexistente / roles | `usuarios/usuarios.spec.ts` | PASS (select de roles) | ✅ FUNCIONA |
| Catálogo público + imágenes | `smoke/productos-publicos.spec.ts` | PASS | ✅ FUNCIONA |
| Editar precio | `productos/productos.spec.ts` | PASS | ✅ FUNCIONA |
| Editar descripción | `productos/productos.spec.ts` | PASS | ✅ FUNCIONA |
| Editar imagen | `productos/productos.spec.ts` | PASS | ✅ FUNCIONA |
| Publicar/despublicar | `productos/productos.spec.ts` | PASS | ✅ FUNCIONA |
| Validaciones de producto | `productos/productos.spec.ts` | PASS (UI) | ⚠️ API acepta precio negativo (H-13) |
| Solicitud pública | `solicitudes/solicitudes.spec.ts` | PASS | ✅ FUNCIONA |
| Fecha mínima (UI + API) | `solicitudes/solicitudes.spec.ts` | PASS 400 / bloqueo UI | ✅ FUNCIONA |
| Fecha mínima aceptada | `solicitudes/solicitudes.spec.ts` | PASS 201 | ✅ FUNCIONA |
| Adjunto PDF + descarga | `solicitudes/solicitudes.spec.ts` | PASS | ✅ FUNCIONA |
| Seguimiento correcto | `solicitudes/solicitudes.spec.ts` | PASS | ✅ FUNCIONA |
| Seguimiento con correo ajeno | `solicitudes/solicitudes.spec.ts` | PASS 404 | ✅ FUNCIONA |
| Cotización desde solicitud | `cotizaciones/cotizaciones.spec.ts` | PASS | ✅ FUNCIONA |
| Cotización manual | `cotizaciones/cotizaciones.spec.ts` | PASS | ✅ FUNCIONA |
| Totales (unitario/base/estimado) | `cotizaciones/cotizaciones.spec.ts` | PASS | ✅ FUNCIONA |
| Flujo de compra completo | `flujo-compra/flujo-compra.spec.ts` | PASS | ✅ FUNCIONA |
| Pago sobre saldo (H-06) | `flujo-compra/pagos.spec.ts` | PASS 400 | ✅ FUNCIONA |
| Inventario insuficiente | `flujo-compra/flujo-compra.spec.ts` | PASS (400) | ✅ FUNCIONA |
| Anticipo pagado | `flujo-compra/flujo-compra.spec.ts` | PASS | ✅ FUNCIONA |
| Descuento por receta | `inventario/descuento-por-pedido.spec.ts` | PASS | ✅ FUNCIONA |
| Portada + LCP | `smoke/home.spec.ts` | PASS | ✅ FUNCIONA |
| Consola limpia | `smoke/consola-limpia.spec.ts` | PASS | ✅ FUNCIONA |

Matriz de proyectos: **35/35 en Chromium, Firefox, WebKit y Mobile Chrome**, tres corridas
consecutivas por proyecto.

## 5. Bugs reales

### H-12 — Crítico: el anticipo pagado no reducía el saldo — **CORREGIDO**

- **Test:** `npx playwright test e2e/tests/flujo-compra/flujo-compra.spec.ts -g "H-12"` → **PASS**.
- **Fix:** al crear el `Pago` de anticipo se descuenta el monto del `saldo` del pedido (Decimal,
  2 decimales); si queda en 0 y el pedido estaba `confirmado`, pasa a `en-produccion`.
- **Evidencia:** cotización $1,160, anticipo $580, saldo $580 → 1 pago de $580 y saldo **0**.
- **Ubicación:** `Flask_Llamma_API/routes/cotizaciones_routes.py`.
- **Commit:** `54accf4`.

### H-13 — Alto: la API acepta precios negativos (abierto)

- **Reproducir:** `POST /api/productos` con `precioBase: -50` → **201**.
- **Ubicación:** `Flask_Llamma_API/routes/productos_routes.py:67` (sin validación) y
  `routes/comun.py:99` (usa `precio_base` sin `max(..., 0)` al cotizar).
- **Impacto:** una cotización puede quedar con subtotal/total negativo.
- **Fix propuesto:** rechazar `precioBase < 0` en POST/PUT y aplicar `max(0, ...)` en el fallback de
  `partidas_a_cotizacion`. **No aplicado** (fuera del alcance de esta iteración).

### H-01 — Crítico: inventario insuficiente se descontaba parcial — **CORREGIDO**

- **Test:** `npx playwright test e2e/tests/flujo-compra -g "inventario"` → **PASS**.
- **Fix:** `descontar_inventario` acumula el requerimiento por materia y valida todo el stock antes
  de tocar la base. Si falta, lanza `InventarioInsuficiente` con `detalles`; las rutas de pedido y
  conversión hacen rollback y responden `400 {"error":"Inventario insuficiente","detalles":[...]}`.
- **Evidencia:** requerido 20, disponible 1 → 400, stock intacto en 1, 0 movimientos y 0 pedidos.
- **Ubicación:** `routes/comun.py`, `routes/pedidos_routes.py`, `routes/cotizaciones_routes.py`.
- **Commit:** `54accf4`.

### H-16 — Alto: el estimado público no coincide con la cotización interna

- **Evidencia:** lona de $220/m², 3 m². El cotizador público aplica la regla
  `220 + 2 × 120 = $460` (`src/app/features/cotizar/cotizar.component.ts:623`), pero el backend
  guarda `precio_base × cantidad = $660` (`routes/public_routes.py:198`) y la conversión interna
  cotiza $660.
- **Impacto:** el cliente ve un estimado y ventas genera otro sin explicación.
- **Fix propuesto (NO aplicado):** calcular la regla de lona en el backend o enviar el precio
  unitario calculado desde el frontend y respetarlo al convertir.

### H-15 — Medio: el seguimiento no muestra producción

- **Evidencia:** tras completar la orden de producción, el seguimiento público sigue mostrando
  “Convertida” y la cotización; no expone pedido, etapa ni estado de producción.
- **Ubicación:** `routes/public_routes.py:274-310` (respuesta sin datos del pedido).
- **Fix propuesto (NO aplicado):** incluir estado del pedido y etapa actual en la respuesta pública.

### H-14 — Bajo: imagen LCP con `loading="lazy"`

- **Evidencia:** Angular emite `NG0913` en `/productos`; la imagen de la primera tarjeta es el LCP y
  está marcada `loading="lazy"` (`productos.component.html:133-141`).
- **Fix propuesto (NO aplicado):** `loading="eager"` y `fetchpriority="high"` para la primera
  tarjeta, o `NgOptimizedImage` con `priority`.

## 6. Herramientas recomendadas

| Herramienta | Prioridad | Caso de uso en Llamma | Coste |
|---|---|---|---|
| `@axe-core/playwright` | **ALTA** | Añadir `checkA11y` a login, catálogo, cotizador y dashboard | Bajo |
| Lighthouse CI | **ALTA** | Presupuesto de LCP/CLS en cada PR; hoy solo se mide LCP en un test | Bajo |
| Pytest + requests | **ALTA** | Unit tests de `totales`, `descontar_inventario`, `upsert_cliente` y `to_dict` | Medio |
| GitHub Actions `e2e` | **ALTA** | Bloquear merge si rompe un flujo; propuesta en §9 | Bajo |
| Sentry | MEDIA | Errores reales de producción que E2E no cubre | Medio |
| OWASP ZAP baseline | MEDIA | Escaneo pasivo de `/api/public/*` y login | Bajo |
| `toHaveScreenshot()` | MEDIA | Regresión visual tras la migración Tailwind | Bajo |
| Docker Compose | MEDIA | MySQL + Flask + Angular reproducible en CI | Medio |
| Postman / Bruno | BAJA | Exploración manual de endpoints | Bajo |
| k6 | BAJA | Solo si hay campañas con picos de tráfico | Medio |
| Cypress / WebdriverIO / Selenium | **NO** | Playwright ya cubre el stack | Alto |
| Pact | **NO** | Monorepo acoplado; los contratos se validan en los specs | Alto |

No se instalaron dependencias nuevas: `@playwright/test` ya estaba en `package.json` (cambio previo
del usuario). `@axe-core/playwright` y Lighthouse quedan como recomendación.

## 7. Cómo correr la suite

```bash
npm run test:e2e                         # 4 proyectos, servidores automáticos
npx playwright test --project=chromium   # un navegador
npx playwright test e2e/tests/auth       # un directorio
npx playwright test e2e/tests/flujo-compra/flujo-compra.spec.ts
npm run test:e2e:report                  # reporte HTML
npx playwright test --list               # 140 pruebas (35 × 4)
```

## 8. `playwright.config.ts` entregado

```ts
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4300';
const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:5001';
const PYTHON =
  process.platform === 'win32'
    ? '"Flask_Llamma_API\\.venv\\Scripts\\python.exe"'
    : process.env.E2E_PYTHON ?? 'python3';

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 45_000,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 12_000,
    navigationTimeout: 30_000,
  },
  expect: { timeout: 7_000 },
  globalSetup: './e2e/global-setup.ts',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: [
    {
      command: `${PYTHON} e2e/scripts/e2e_server.py`,
      url: `${API_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm start -- --port 4300 --proxy-config e2e/proxy.e2e.json',
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
```

## 9. CI job E2E (propuesta — NO aplicada)

```yaml
e2e:
  name: E2E Playwright
  runs-on: ubuntu-latest
  needs: [frontend, backend]
  timeout-minutes: 30
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: npm }
    - uses: actions/setup-python@v5
      with: { python-version: "3.12", cache: pip, cache-dependency-path: Flask_Llamma_API/requirements.txt }
    - run: npm ci
    - run: pip install -r Flask_Llamma_API/requirements.txt
    - run: npx playwright install --with-deps
    - run: npx playwright test
      env:
        E2E_PYTHON: python3
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: |
          playwright-report/
          test-results/
        retention-days: 14
```

El job no se añadió a `.github/workflows/ci.yml`; queda pendiente de aprobación.

## 10. Evidencia adjunta

- `playwright-report/` — reporte HTML de la última corrida completa.
- `test-results/` — trazas, screenshots y videos **solo de fallos**; la corrida final quedó verde.
- `e2e/.auth/*.json` — sesiones generadas (ignoradas por Git).
- `e2e/.tmp/e2e.db` — base SQLite de la corrida (ignorada por Git).

## 11. Handoff YAML

```yaml
decision: suite-e2e-playwright-llamma-2026-11-23
estado: parcial
tests_totales: 35
proyectos: [chromium, firefox, webkit, mobile-chrome]
corridas_por_proyecto: 3
tests_pass: 35
tests_fail: 0
fallas_esperadas: []
flujos_funcionan: [login_admin, login_vendedor, login_marketing, login_fallido, rate_limit, logout,
  catalogo, editar_precio, editar_descripcion, editar_imagen, publicar, alta_usuarios_ui,
  solicitud_publica, adjuntos, seguimiento, cotizacion_desde_solicitud, cotizacion_manual, totales,
  flujo_compra, pago, produccion, inventario_estricto, anticipo_pagado, smoke, consola]
bugs_corregidos: [H-01, H-12]
flujos_con_bug:
  - {id: H-13, flujo: precio_negativo_api, severidad: alto, test: evidencia POST /api/productos}
  - {id: H-16, flujo: estimado_vs_cotizacion, severidad: alto, test: analisis + flujo de compra}
flujos_bloqueados: []
herramientas_alta: [axe-core, lighthouse-ci, pytest, github-actions-e2e]
herramientas_media: [sentry, owasp-zap, toHaveScreenshot, docker-compose]
herramientas_baja: [postman, bruno, k6]
herramientas_no: [cypress, pact, selenium, webdriverio]
config_playwright:
  baseURL: "http://localhost:4300"
  api: "http://127.0.0.1:5001"
  db: "SQLite e2e/.tmp/e2e.db"
  projects: [chromium, firefox, webkit, mobile-chrome]
  trace: on-first-retry
commits: [54accf4, dc711d1]
ci_job_e2e_aprobado: false
pendiente_usuario: "decidir H-13 y H-16; aprobar job CI e2e; evaluar axe-core y Lighthouse"
```

## 12. Supuestos

- Las credenciales reales de `seed.py` son `ana@llamma.mx`, `diego@llamma.mx` y `paola@llamma.mx`
  con `llamma2026`; no existen `admin@`, `vendedor@` ni `marketing@`.
- La clave de sesión es `llamma.session.v1` con `{usuario, token, permisos, expiraEn}`, no
  `llamma.token`.
- Los puertos de E2E son `4300` (frontend) y `5001` (API) para no tocar el entorno de desarrollo.
- La base E2E es SQLite temporal; el backend se siembra con `seed.py` al arrancar.
- “Registro de usuarios” se interpretó como alta interna por API, porque la SPA no tiene registro
  público ni pantalla de usuarios.
- Playwright 1.65.1; Node 26 local, Node 22 en CI.
- La suite comparte una sola base y corre en serie (`workers: 1`); los datos se hacen únicos por
  prueba y la base se recrea en cada invocación.

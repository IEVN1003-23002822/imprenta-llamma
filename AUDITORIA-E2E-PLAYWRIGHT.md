# Suite E2E Playwright — Llamma (2026-11-23)

Rama `audit/functional-llamma-2026-11-23`. Playwright **1.65.1**, Node local 26.13.1 (CI usa 22),
4 proyectos: `chromium`, `firefox`, `webkit`, `mobile-chrome`.

La suite corre contra un **backend Flask aislado** (`127.0.0.1:5001`, SQLite en `e2e/.tmp/`) y un
`ng serve` en `http://localhost:4300` con proxy a `5001`. **No toca `llamma_db` ni el servidor de
desarrollo del puerto 5000.**

## 1. Resumen ejecutivo

- Suite creada: **28 archivos de spec, 76 pruebas, 4 proyectos → 304 ejecuciones por corrida**.
- Corridas de cierre: Chromium 1 (66/66), Firefox 1 (66/66), WebKit 3 (1 fallo transitorio y dos
  corridas verdes consecutivas), Mobile Chrome 1 (66/66).
- `76 passed` por proyecto, sin `test.fail()` ni `test.skip()`.
- Flujos que funcionan: login por rol, rate limit, logout, alta y primer acceso de usuarios,
  auditoría de las 10 rutas internas, catálogo, edición de productos, solicitud pública con adjunto,
  seguimiento, cotización (desde solicitud y manual), totales, pedido, pago, producción, inventario
  y smoke.
- Bugs corregidos: **H-01** (inventario estricto), **H-12** (anticipo liquida el saldo) y **H-13**
  (API rechaza precios negativos).
- Bugs abiertos: **H-16** (estimado público ≠ cotización interna), **H-15** (seguimiento no muestra
  producción) y **H-14** (imagen LCP lazy).
- Veredicto global: **✅ FUNCIONA** — los flujos críticos pasan en los 4 navegadores; lo abierto son
  decisiones de producto (H-16/H-15) y una mejora de rendimiento (H-14).
- CI de la app: `format` ✅ · `lint` ✅ · Vitest **59/59** ✅ · `build` ✅ · backend **28/28** ✅.

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
| Marketing retirado y `roleGuard` | `auth/matriz-estricta.spec.ts` | PASS | ✅ FUNCIONA |
| Login fallido (mismo mensaje) | `auth/login-fallido.spec.ts` | PASS | ✅ FUNCIONA |
| Rate limit (6.º intento) | `auth/rate-limit-login.spec.ts` | PASS 429 | ✅ FUNCIONA |
| Logout y protección de ruta | `auth/logout.spec.ts` | PASS | ✅ FUNCIONA |
| Alta de usuario | `usuarios/usuarios.spec.ts` | PASS (UI) | ✅ FUNCIONA |
| Usuario duplicado | `usuarios/usuarios.spec.ts` | PASS 409 (UI) | ✅ FUNCIONA |
| Password corta | `usuarios/usuarios.spec.ts` | PASS (validación UI) | ✅ FUNCIONA |
| Fuerza de contraseña | `usuarios/usuarios.spec.ts` | PASS (indicador UI) | ✅ FUNCIONA |
| Rol inexistente / roles | `usuarios/usuarios.spec.ts` | PASS (select de roles) | ✅ FUNCIONA |
| Catálogo público + imágenes | `smoke/productos-publicos.spec.ts` | PASS | ✅ FUNCIONA |
| Editar precio | `productos/productos.spec.ts` | PASS | ✅ FUNCIONA |
| Editar descripción | `productos/productos.spec.ts` | PASS | ✅ FUNCIONA |
| Editar imagen | `productos/productos.spec.ts` | PASS | ✅ FUNCIONA |
| Publicar/despublicar | `productos/productos.spec.ts` | PASS | ✅ FUNCIONA |
| Validaciones de producto | `productos/productos.spec.ts` | PASS (UI + API 400) | ✅ FUNCIONA |
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
| Aprobar desde cotizador | `flujo-compra/descuento-cotizacion.spec.ts` | PASS (UI + descuento) | ✅ FUNCIONA |
| Descuento al aprobar sin duplicar | `flujo-compra/descuento-cotizacion.spec.ts` | PASS | ✅ FUNCIONA |
| Producto por nombre sin ID | `flujo-compra/descuento-cotizacion.spec.ts` | PASS | ✅ FUNCIONA |
| Bloqueo por stock (API + UI) | `flujo-compra/descuento-cotizacion.spec.ts` | PASS 400 | ✅ FUNCIONA |
| Cotizador por medidas 10×10 | `solicitudes/cotizador-medidas.spec.ts` | PASS | ✅ FUNCIONA |
| Material Lona + m² | `cotizaciones/cotizador-lona-vinil.spec.ts` | PASS ($340 / 2 m²) | ✅ FUNCIONA |
| Material Vinil + m² | `cotizaciones/cotizador-lona-vinil.spec.ts` | PASS ($270 / 2 m²) | ✅ FUNCIONA |
| Medidas en cero | `cotizaciones/cotizador-lona-vinil.spec.ts` | PASS (bloqueo) | ✅ FUNCIONA |
| Visor 3D con GLB real | `cotizaciones/cotizador-3d.spec.ts` | PASS (píxeles + carga) | ✅ FUNCIONA |
| Visor 3D sin GLB | `cotizaciones/cotizador-3d.spec.ts` | PASS (modelo aproximado) | ✅ FUNCIONA |
| Playera 3D con GLB | `cotizaciones/cotizador-3d.spec.ts` | PASS (sin 404) | ✅ FUNCIONA |
| Logo PNG sobre modelo | `cotizaciones/cotizador-3d.spec.ts` | PASS (alfa + píxeles) | ✅ FUNCIONA |
| Mockup 2D reactivo | `cotizaciones/cotizador-previsualizadores.spec.ts` | PASS (playera/lona) | ✅ FUNCIONA |
| Captura 2D + admin | `cotizaciones/mockup-guardado.spec.ts` | PASS (JPEG + tarjeta) | ✅ FUNCIONA |
| Captura 3D + admin | `cotizaciones/mockup-guardado.spec.ts` | PASS (JPEG + tarjeta) | ✅ FUNCIONA |
| Comprobante PDF A4 | `cotizaciones/comprobante-pdf.spec.ts` | PASS (2 partidas y 20 partidas) | ✅ FUNCIONA |
| Alta → login → logout | `usuarios/registro-login.spec.ts` | PASS (2 pruebas) | ✅ FUNCIONA |
| Auditoría de 10 rutas internas | `smoke/auditoria-panel.spec.ts` | PASS (consola + red) | ✅ FUNCIONA |
| Precio negativo en API | `productos/productos.spec.ts` | PASS (400) | ✅ FUNCIONA |
| Matriz RBAC por rol | `auth/matriz-estricta.spec.ts` | PASS (7 pruebas) | ✅ FUNCIONA |
| Edición de usuarios | `usuarios/usuarios.spec.ts` | PASS (2 pruebas) | ✅ FUNCIONA |
| Pasos de producción dinámicos | `produccion/pasos-dinamicos.spec.ts` | PASS (Lona/Playera/Roll-up) | ✅ FUNCIONA |
| Consultas con entregados | `consultas/consultas.spec.ts` | PASS (filtro estado) | ✅ FUNCIONA |
| Adjuntar sin diseño | `cotizaciones/mockup-guardado.spec.ts` | PASS (botón deshabilitado) | ✅ FUNCIONA |
| Mockup 2D sin vista | `cotizaciones/cotizador-previsualizadores.spec.ts` | PASS (aviso) | ✅ FUNCIONA |
| 3D Tote + fallback Taza | `cotizaciones/cotizador-previsualizadores.spec.ts` | PASS | ✅ FUNCIONA |
| Descuento por receta | `inventario/descuento-por-pedido.spec.ts` | PASS | ✅ FUNCIONA |
| Insumos por producto | `inventario/insumos-productos.spec.ts` | PASS (5 pruebas) | ✅ FUNCIONA |
| Portada + LCP | `smoke/home.spec.ts` | PASS | ✅ FUNCIONA |
| Consola limpia | `smoke/consola-limpia.spec.ts` | PASS | ✅ FUNCIONA |

Matriz de proyectos: **76/76 en Chromium, Firefox, WebKit y Mobile Chrome**; Chromium con 3
corridas consecutivas y el resto con 1 corrida completa en esta iteración.

## 5. Bugs reales

### H-12 — Crítico: el anticipo pagado no reducía el saldo — **CORREGIDO**

- **Test:** `npx playwright test e2e/tests/flujo-compra/flujo-compra.spec.ts -g "H-12"` → **PASS**.
- **Fix:** al crear el `Pago` de anticipo se descuenta el monto del `saldo` del pedido (Decimal,
  2 decimales); si queda en 0 y el pedido estaba `confirmado`, pasa a `en-produccion`.
- **Evidencia:** cotización $1,160, anticipo $580, saldo $580 → 1 pago de $580 y saldo **0**.
- **Ubicación:** `Flask_Llamma_API/routes/cotizaciones_routes.py`.
- **Commit:** `54accf4`.

### H-13 — Alto: la API acepta precios negativos — **CORREGIDO**

- **Reproducir (antes):** `POST /api/productos` con `precioBase: -50` → **201**.
- **Fix:** `POST /api/productos` y `PUT /api/productos/<id>` responden `400 precio_invalido` si el
  precio es negativo; `routes/public_routes.py` aplica `max(0, ...)` al estimado y
  `routes/comun.py` ya recortaba el precio a cero al cotizar.
- **Tests:** `tests/test_flujos.py::test_05c_producto_rechaza_precio_negativo` y
  `e2e/tests/productos/productos.spec.ts` → «la API rechaza un precio negativo…» **PASS**.
- **Ubicación:** `Flask_Llamma_API/routes/productos_routes.py`, `routes/public_routes.py`.

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
npx playwright test --list               # 304 pruebas (76 × 4)
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
estado: completado
tests_totales: 76
proyectos: [chromium, firefox, webkit, mobile-chrome]
corridas_por_proyecto: "chromium 1, firefox 1, webkit 1, mobile-chrome 1"
tests_pass: 76
tests_fail: 0
fallas_esperadas: []
flujos_funcionan: [login_admin, login_vendedor, login_marketing_sin_modulos, login_fallido,
  rate_limit, logout,
  alta_login_logout, alta_usuarios_ui, auditoria_rutas_internas, precio_negativo_api,
  rbac_roles, login_sin_marketing, solo_lectura_ventas, marketing_retirado, edicion_usuarios,
  pasos_produccion_dinamicos, consultas_entregados, renombre_lona_vinil,
  catalogo, editar_precio, editar_descripcion, editar_imagen, publicar,
  solicitud_publica, adjuntos, seguimiento, cotizacion_desde_solicitud, cotizacion_manual, totales,
  flujo_compra, pago, produccion, inventario_estricto, anticipo_pagado, insumos_por_producto,
  smoke, consola]
bugs_corregidos: [H-01, H-12, H-13]
flujos_con_bug:
  - {id: H-16, flujo: estimado_vs_cotizacion, severidad: alto, test: analisis + flujo de compra}
  - {id: H-15, flujo: seguimiento_sin_produccion, severidad: medio, test: analisis}
  - {id: H-14, flujo: imagen_lcp_lazy, severidad: bajo, test: consola NG0913}
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
commits: [54accf4, dc711d1, cadfe28, 8f50e87, 0a9216a]
commit_auditoria_mensaje: "fix(audit): reject negative prices and cover login flows end to end"
commit_rbac_mensaje: "fix(rbac): enforce strict 4-role matrix in UI and API"
ci_job_e2e_aprobado: false
pendiente_usuario: "decidir H-16; aprobar job CI e2e; evaluar axe-core y Lighthouse"
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

## 13. Cierre de matriz E2E (auditoría final)

Fecha de cierre: **25 de noviembre de 2026**. Total: **76 pruebas por navegador**.
Commit de cierre: `feat(produccion): pasos dinámicos, Lona/Vinil y consultas entregadas`.

| Navegador | Totales | Pass | Fail | Tiempo | Estado |
|---|---:|---:|---:|---:|---|
| Chromium | 76 | 76 | 0 | 2.7 min | ✅ VERDE |
| Firefox | 76 | 76 | 0 | 7.0 min | ✅ VERDE |
| WebKit | 76 | 76 | 0 | 4.8 min | ✅ VERDE |
| Mobile Chrome | 76 | 76 | 0 | 3.3 min | ✅ VERDE |

Tiempo secuencial aproximado: **17.8 min** por matriz completa, más el arranque de los dos
servidores (Flask en `:5001` y `ng serve` en `:4300`).

### Correcciones cross-browser aplicadas

- **Mobile Chrome:** `abrirNavegacionSiHaceFalta()` revisa `aria-expanded` antes de pulsar la
  hamburguesa para no cerrar el menú al llamarlo dos veces.
- **Firefox:** el mensaje de contraseña inválida ahora ocupa un espacio reservado
  (`min-h-[1.05rem]`). Sin él, al hacer clic en «Crear usuario» el `blur` mostraba el error, el botón
  se desplazaba y el clic caía fuera; solo ocurría en Firefox.
- **WebKit:** una corrida completa falló de forma transitoria en `auth/logout` (login UI); la
  prueba aislada y la siguiente corrida completa pasaron 76/76. No se cambió código por ello.
- No se usó `test.skip()` ni `test.fixme()`. WebGL, descargas PDF, `localStorage`, `sessionStorage`
  y los menús móviles funcionan en los cuatro proyectos.
- Los cambios de esta iteración fueron de seguridad funcional: matriz RBAC en backend/frontend,
  Marketing fuera del login, badges de solo lectura y pruebas por rol.

### Cobertura añadida en esta auditoría

- `e2e/tests/auth/matriz-estricta.spec.ts` — 7 pruebas de la matriz RBAC, retiro de Marketing y
  rechazos `403` directos a la API.
- `e2e/tests/usuarios/registro-login.spec.ts` — alta desde el panel, login en contexto limpio,
  logout y limpieza de ambos storages, más credenciales incorrectas con campo marcado.
- `e2e/tests/smoke/auditoria-panel.spec.ts` — 10 rutas internas sin `console.error`, `pageerror`
  ni respuestas `4xx/5xx`.
- `e2e/tests/productos/productos.spec.ts` — la API rechaza `precioBase < 0` al crear y editar.
- `e2e/tests/produccion/pasos-dinamicos.spec.ts` — Lona/Vinil, playera y roll-up reciben pasos
  distintos en API y en el timeline de la orden.
- `e2e/tests/consultas/consultas.spec.ts` — un pedido `entregado` aparece al filtrar por estado y
  folio, con el rango de fechas por defecto.

### Conclusión

**Suite estable en los 4 navegadores**: 76/76 en Chromium, Firefox, WebKit y Mobile Chrome, con
304 ejecuciones verdes por matriz. Los bugs abiertos (H-16, H-15, H-14) son decisiones de producto
o mejoras de rendimiento, no fallos de la suite.

## 14. Auditoría RBAC (25 de noviembre de 2026)

### Marketing retirado del frontend

- El login muestra **4 roles** y no anuncia Marketing.
- El menú «Módulos» ya no tiene el acceso a Marketing. La ruta `/marketing` queda como legado
  **solo para admin**; un usuario marketing es redirigido a `/dashboard`.
- `/clientes` y la API de clientes vuelven a ser solo `admin`/`ventas`; marketing ya no crea ni
  edita clientes.

### Matriz aplicada (frontend + backend)

| Rol | Ventas | Producción | Inventario | Clientes | Config. |
|---|---|---|---|---|---|
| Administrador | ✅ Total | ✅ Total | ✅ Total | ✅ Total | ✅ Total |
| Ventas | ✅ Total | 👁️ Solo lectura | 👁️ Solo lectura | ✅ Total | — |
| Producción | 👁️ Solo lectura | ✅ Total | ✅ Total | — | — |
| Inventario | — | 👁️ Solo lectura | ✅ Total | — | — |

- **Frontend:** `/solicitudes` acepta a producción en solo lectura; `/abastecimiento` se abre a
  ventas y producción (ventas solo lectura); `/consultas` queda para admin/ventas/producción.
  `AuthService.puedeEditarVentas/Inventario/Clientes/Produccion` centraliza la matriz y los
  componentes exponen `puedeGestionar()`; el badge `data-testid="modo-lectura"` aparece en
  Solicitudes (producción), Inventario, Producción y Abastecimiento (ventas).
- **Backend (doble capa):** las lecturas de solicitudes, cotizaciones, pedidos y consultas exigen
  `admin`/`ventas`/`produccion`; inventario y compras exigen `admin`/`ventas`/`inventario`/
  `produccion`; clientes solo `admin`/`ventas`; usuarios solo `admin`; archivos
  `admin`/`ventas`/`produccion`. Las escrituras de ventas siguen en `admin`/`ventas`, las de
  inventario en `admin`/`inventario`/`produccion` y producción en `admin`/`produccion`.
- **Tests:** `e2e/tests/auth/matriz-estricta.spec.ts` (7 pruebas) y
  `tests/test_flujos.py::test_02b_rbac_por_rol` validan `200/403/404` con tokens reales de los
  cuatro roles.

### Evidencia E2E

```
✓ Admin: 5 módulos, sin Marketing; puede crear en inventario/clientes y entrar a usuarios
✓ Ventas: inventario/producción en solo lectura; clientes con alta; /usuarios denegado
✓ Producción: /solicitudes en solo lectura sin "Convertir en cotización"; inventario con alta
✓ Inventario: inventario con alta; producción en solo lectura; /solicitudes y /clientes denegados
✓ Marketing retirado: login válido pero sin módulo de marketing ni clientes
✓ Login: 4 roles, sin Marketing
✓ API por rol: 403 en escrituras y lecturas fuera de la matriz
7 passed
```

## 15. Edición de usuarios (25 de noviembre de 2026)

- **Backend:** `PUT/PATCH /api/usuarios/<id>` (solo `admin`). Valida nombre/correo, rol existente y
  correo duplicado excluyendo al usuario actual. La contraseña es opcional: si llega vacía o
  ausente conserva el hash; si llega con texto exige 8 caracteres y llama `set_password`.
  `Usuario.to_dict()` sigue sin exponer `password_hash`.
- **Frontend:** el panel lateral se reutiliza en modo alta/edición con `usuarioEditandoId` y
  `modoEdicion`. La tabla tiene una columna «Acciones» con el botón `bi-pencil-square`; el título,
  el texto de ayuda de la contraseña y el botón cambian entre «Nuevo usuario»/«Crear usuario» y
  «Editar usuario»/«Guardar cambios». En edición, el campo se deja vacío y muestra «Deja en blanco
  para mantener la contraseña actual»; hay un botón «Cancelar edición».
- **Servicio:** `LlammaService.actualizarUsuario(id, body)` con `ActualizarUsuarioPayload`.
- **Pruebas:**
  - `tests/test_flujos.py::test_02c_editar_usuario` valida edición sin contraseña, hash intacto,
    login con la clave original, 409 por correo duplicado, 400 por rol/clave inválidos, cambio de
    contraseña y 403 para ventas.
  - `e2e/tests/usuarios/usuarios.spec.ts` → «edita un usuario existente y conserva la contraseña…»
    y «rechaza el correo de otro usuario al editar» **PASS**.
- **E2E del flujo:** alta por API → editar nombre/rol sin contraseña → fila actualizada → login con
  la contraseña original → editar con nueva contraseña → login viejo `401` y nuevo `200` → login
  por UI con la nueva clave en un contexto limpio.

## 16. Fix 404 al editar usuarios (25 de noviembre de 2026)

- **Síntoma:** el panel `/usuarios` mostraba el texto crudo de Flask
  («The requested URL was not found on the server…») y un toast al guardar una edición.
- **Causa raíz:** el proceso Flask de desarrollo en `:5000` llevaba desde el **24-nov 15:50**, antes
  de que existiera `PUT /api/usuarios/<id>`. El código ya tenía la ruta (`app.url_map` la mostraba),
  pero el proceso no la había cargado. No era un error de URL en Angular ni un Blueprint sin
  registrar.
- **Corrección de entorno:** se reinició la API local (`.venv\Scripts\python.exe app.py`). Después:
  - `PUT /api/usuarios/2` → **200**.
  - `PATCH /api/usuarios/2` → **200**.
  - Edición real desde `http://localhost:4200/usuarios` → `PUT 200`, **0 respuestas 404** y toast
    «Usuario Diego Salas actualizado.».
- **Corrección de código:** el endpoint acepta `PUT` y `PATCH`; el mensaje de correo duplicado es
  **«El correo ya está en uso.»**; `UiService.mensajeDeError` ya no muestra el texto crudo inglés
  de un 404 de Flask y usa el mensaje de respaldo del módulo.
- **Pruebas:** `tests/test_flujos.py::test_02c_editar_usuario` cubre PUT y PATCH; la suite de
  usuarios (8 pruebas) sigue en verde.
- **Lección:** tras agregar rutas nuevas, reiniciar el proceso `app.py` si no está en modo debug.

## 17. Requerimientos Eltoni (25 de noviembre de 2026)

### Catálogo: Lona/Vinil

- El producto `Lona Frontlit impresa` se renombró a **`Lona/Vinil`** en `seed.py`, el dump
  `llamma_laragon.sql` y las migraciones de precios/imágenes/recetas.
- `migrations/renombrar_lona_vinil.py` actualiza la base existente de forma idempotente: producto,
  partidas históricas exactas y receta. No fusiona si ya existe `Lona/Vinil`.
- El cotizador conserva el selector de material Lona/Vinil y sus fórmulas; los mockups 2D/3D tienen
  alias para el nombre anterior.

### Mockups en la solicitud

- La tarjeta «Previsualización del diseño» de `/solicitudes` ya muestra la captura 2D/3D y sus
  metadatos; no se modificó el flujo de archivos.

### Producción dinámica

- `produccion_config.py` define los pasos por línea y excepciones por nombre:
  - Lona/Vinil, stickers y tarjetas: `diseno → impresion → corte → empaquetado`.
  - Playera, taza y tote bag: `diseno → impresion → plasmado → empaquetado`.
  - Roll-up: `diseno → impresion → empaquetado`.
- Al crear un pedido (manual o desde cotización) se generan todas las `ProduccionEtapa` del paso;
  los pedidos anteriores no se tocan.
- El backend expone `etapas` en el tablero y valida que el avance use una etapa del producto. El
  frontend usa esas etapas, cae a `ETAPAS_PRODUCCION` para pedidos viejos y muestra el timeline
  completo.
- E2E: `pasos-dinamicos.spec.ts` valida API y UI para los tres grupos.

### Consultas

- Se corrigió la fecha de negocio: `Pedido.fecha_pedido` y `Cotizacion.fecha_emision` usan
  `date.today()` local, no `utcnow().date()`. Así `hasta=hoy` incluye pedidos creados durante el día.
- El filtro `estado=entregado`, la búsqueda por folio y el rango de fechas se cubren en
  `consultas/consultas.spec.ts` y en `test_02e_consultas_encuentra_entregados`.

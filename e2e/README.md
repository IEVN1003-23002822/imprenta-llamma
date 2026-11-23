# Suite E2E — Llamma

Playwright 1.65 verifica los flujos críticos de la SPA contra un **backend Flask aislado**
(SQLite en `e2e/.tmp/e2e.db`, puerto `5001`) y un **dev server Angular en el puerto `4300`**
que hace proxy de `/api` a `5001`. Nunca toca `llamma_db`.

## Requisitos

- Node 22+ y dependencias instaladas (`npm ci`).
- Python del repo en `Flask_Llamma_API/.venv` con `requirements.txt`.
- Navegadores de Playwright (`npx playwright install`).

## Comandos

```bash
npx playwright test                       # los 4 proyectos
npx playwright test --project=chromium    # solo Chromium
npx playwright test e2e/tests/auth        # solo autenticación
npx playwright test e2e/tests/flujo-compra/flujo-compra.spec.ts
npx playwright show-report                # reporte HTML
npx playwright test --list                # inventario de pruebas
```

Los servidores se levantan solos (`webServer` en `playwright.config.ts`). Si ya tienes uno
corriendo, se reutiliza; para forzar una base limpia, detenlo antes de ejecutar o define
`E2E_REUSE_DB=0` (el lanzador borra `e2e/.tmp/e2e.db` en cada arranque por defecto).

## Cuentas

| Rol | Correo | Contraseña |
|---|---|---|
| admin | `ana@llamma.mx` | `llamma2026` |
| ventas | `diego@llamma.mx` | `llamma2026` |
| marketing | `paola@llamma.mx` | `llamma2026` |

`e2e/global-setup.ts` inicia sesión por API y guarda un `storageState` por rol en `e2e/.auth/`
(clave real `llamma.session.v1`). Esa carpeta y `e2e/.tmp/` están ignoradas por Git.

## Estructura

```
e2e/
├── fixtures/        # storageState por rol y lectura del token
├── page-objects/    # Login, Home, Productos, Cotizar, Seguimiento, Solicitudes, Captura, Dashboard
├── factories/       # datos únicos para producto, solicitud, usuario, cotización y pedido
├── helpers/         # API de setup, consola, esperas y navegación móvil
├── tests/
│   ├── auth/        # login por rol, fallo, rate limit, logout
│   ├── productos/   # edición, imagen, publicación y validaciones
│   ├── solicitudes/# solicitud pública, adjuntos y seguimiento
│   ├── cotizaciones/# conversión, cotizador manual y totales exactos
│   ├── flujo-compra/# compra completa, pagos e inventario insuficiente
│   ├── inventario/  # descuento por receta y movimiento de salida
│   ├── usuarios/    # alta y listado de usuarios por UI + restricción de rol
│   └── smoke/       # portada, catálogo, LCP y consola
├── global-setup.ts
├── proxy.e2e.json
└── scripts/e2e_server.py
```

## Limitaciones conocidas

- **`H-13`**: la API de productos acepta `precioBase` negativo; la UI lo bloquea. Pendiente de
  aprobación para endurecer el backend.
- **`H-16`**: el estimado público de lona y la cotización interna usan reglas de precio distintas.
- El seguimiento público muestra el estado de la **solicitud/cotización**, no el avance del
  pedido u orden de producción (`H-15`).
- La suite comparte una sola base SQLite y corre con `workers: 1` para que las escrituras sean
  deterministas.

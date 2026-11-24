# Auditoría funcional de Llamma — 2026-11-23

Rama `audit/functional-llamma-2026-11-23` · tag `baseline-pre-audit-functional` · respaldo
`../llamma-audit-backup-2026-11-23/` (207 archivos, 3.31 MB).

> **Actualización 2026-11-23:** H-01 quedó corregido en `54accf4` (inventario estricto con 400 y
> rollback) y H-12 se detectó/corrigió en la suite E2E. El resto del reporte conserva el estado de
> la auditoría original; consulta `AUDITORIA-E2E-PLAYWRIGHT.md` para el estado vigente.

Herramientas: Flask 3.1 + MySQL 8 local, Angular 22 + Vitest, Playwright 1.65 con Microsoft Edge
(el MCP de Playwright apunta a Chrome, que no está instalado). Las pruebas nuevas del backend usan
SQLite temporal y no tocan `llamma_db`.

## 1. Resumen ejecutivo

- Flujos inventariados: **20/20**.
- Flujos con evidencia automatizada completa: **13/20**.
- Flujos parciales: **4/20** (chat, conversión cotización→pedido, producción, alta de cliente).
- Flujos no probables en esta sesión: **3/20** (movimiento manual, alta de usuario, ROI de marketing).
- Hallazgos: **11** — críticos 2, altos 0, medios 5, bajos 4.
- Corregidos: **3** (H-04, H-05, H-06).
- `REQUIERE_APROBACIÓN`: **6** (H-01, H-02, H-07, H-08, H-09, H-11).
- `BLOQUEADOS`: **2** (H-03 por contrato de test, H-10 por infraestructura).
- CI final: `format` ✅ · `lint` ✅ · `test` 54/54 ✅ · `build` ✅ · backend 12/12 ✅ · E2E 34/34 ✅.
- Baseline inicial: verde; no hubo fallos previos que condicionaran la auditoría.

## 2. Baseline (FASE 0)

| Métrica | Baseline | Final |
|---|---|---|
| `format:check` | PASS | PASS |
| `lint` | PASS | PASS |
| Vitest | 53/53 | 54/54 |
| Build inicial | 551.85 kB / 122.39 kB | 551.88 kB / 122.40 kB |
| `dist/` completo | — | 3,508.7 kB en 81 archivos |
| Pruebas backend | no existían | 12/12 |
| Tablas / usuarios / productos demo | — | 27 / 5 / 8 |

Tiempos de respuesta medidos contra la API viva (5 muestras):

| Endpoint | mín | promedio | máx |
|---|---|---|---|
| `GET /api/public/productos` | 42 ms | 185 ms | 533 ms (primera, en frío) |
| `POST /api/auth/login` | 332 ms | 349 ms | 371 ms |
| `GET /api/public/solicitudes/SOL-2026-018` | 52 ms | 60 ms | 81 ms |

## 3. Inventario de flujos (FASE 1)

| # | Flujo | Estado | Evidencia |
|---|---|---|---|
| 1 | Inicialización / seed | PASS | 27 tablas, 5 usuarios, 8 productos |
| 2 | Login exitoso | PASS | API 200 + UI redirige a `/dashboard` |
| 3 | Login fallido | PASS | API 401; UI muestra “Credenciales incorrectas” y no guarda sesión |
| 4 | Rate limit de login | PASS | 5 fallos → 6.º `429` con `Retry-After: 300` |
| 5 | Expiración / token inválido | PASS | UI limpia `llamma.session.v1` y va a `/login?expirada=1&redirect=%2Fdashboard` |
| 6 | Catálogo público | PASS | 200, productos activos/publicados |
| 7 | Solicitud pública | PASS | Folio `SOL-2026-001` en SQLite aislada; validación de correo y adjuntos |
| 8 | Seguimiento público | PASS | Correcto 200; correo ajeno 404; folio inexistente 404 |
| 9 | Chat de solicitud | PARCIAL | Lectura visible en seguimiento; envío/respuesta no automatizado |
| 10 | Cotización | PASS | Subtotal 440, IVA 70.4, total 510.4, anticipo/saldo 255.2 |
| 11 | Cotización → pedido + inventario | PARCIAL | Descuento por receta verificado (6.6 m²); endpoint `convertir-pedido` no ejercitado |
| 12 | Pago | PASS | Sobrepago 400; liquidación 58 → saldo 0 y estado `en-produccion` |
| 13 | Producción | PARCIAL | Ruta UI carga; etapas y calidad sin automatizar |
| 14 | Orden de compra | PASS | Total 580; stock +10; doble recepción no duplica |
| 15 | Movimiento manual de inventario | NO_PROBABLE | Requiere escritura sin ruta aislada preparada |
| 16 | Alta de cliente | PARCIAL | Upsert no duplica; endpoint de clientes no probado |
| 17 | Alta de usuario | NO_PROBABLE | Sin fixture/aislamiento para el endpoint |
| 18 | ROI de marketing | NO_PROBABLE | Ruta UI carga; cálculo no ejercitado |
| 19 | Descarga de adjunto | PASS | `.exe` → 415; PDF con token 200; sin token 401 |
| 20 | Resiliencia de red | PASS | Specs: retry GET 1×, sin retry POST, timeout 20 s |

## 4. Hallazgos estáticos (FASE 2)

| ID | Hallazgo | Categoría | Severidad | Ubicación | Evidencia | Estado |
|---|---|---|---|---|---|---|
| H-01 | Si el stock es menor al requerido se descuenta solo lo disponible y no se registra faltante | Lógica / inventario | Crítico | `Flask_Llamma_API/routes/comun.py:223` | `test_08_descuento_parcial_documenta_h01`: requerido 8, descontado 5, stock 0, sin movimiento de faltante | **CORREGIDO** `54accf4` |
| H-02 | `upsert_cliente` sobrescribe nombre, teléfono, empresa, dirección y RFC del cliente existente | Lógica / datos | Medio | `routes/comun.py:49` | Lectura de código + `test_11_cliente_recurrente_no_se_duplica` | `REQUIERE_APROBACIÓN` |
| H-03 | `roleGuard` deja pasar si la ruta no declara `data.roles` | Seguridad | Medio | `src/app/core/guards/auth.guard.ts:28` | `auth.guard.spec.ts` lo fija como contrato (“deja pasar si la ruta no exige roles”) | `BLOQUEADO` |
| H-04 | `includes('/public/')` omitía el token en URLs internas con `/public/` en el query | Seguridad / frontend | Bajo | `src/app/core/interceptors/auth.interceptor.ts:16` | Test nuevo falla sin fix y pasa con fix | **CORREGIDO** `e8dbb16` |
| H-05 | El CI solo ejecutaba el frontend; sin pruebas de backend | Mantenibilidad | Medio | `.github/workflows/ci.yml` | 14 `test_*.py` hallados solo dentro de `.venv` | **CORREGIDO** `634fde8` + `ad19ec0` |
| H-06 | La validación de pagos usaba `total − pagado`, ignorando el anticipo del pedido | Lógica / dinero | Crítico | `routes/pedidos_routes.py:296` | Pedido 116/anticipo 58: un pago de 100 era aceptado y dejaba saldo 16 | **CORREGIDO** `ad19ec0` |
| H-07 | `generar_folio` toma `MAX + 1` sin reintento ante `IntegrityError` (folio `unique`) | Concurrencia | Medio | `Flask_Llamma_API/utils.py:19` | Análisis estático; no reproducido con carga | `REQUIERE_APROBACIÓN` |
| H-08 | Los adjuntos se validan por extensión, no por MIME real | Seguridad | Bajo | `utils.py:71` | Lectura + prueba 415 con `.exe`; se sirven con `as_attachment=True` | `REQUIERE_APROBACIÓN` |
| H-09 | 35 usos de `Query.get()` legado de SQLAlchemy | Mantenibilidad | Bajo | `Flask_Llamma_API/**/*.py` | Warnings `LegacyAPIWarning` en la suite; docs SQLAlchemy 2.0 confirman que `Session.get()` reemplaza a `Query.get()` | `REQUIERE_APROBACIÓN` |
| H-10 | Rate limit en memoria por proceso | Operación | Medio | `Flask_Llamma_API/ratelimit.py` | Diseño documentado; no comparte estado entre workers | `BLOQUEADO` (requiere Redis) |
| H-11 | No hay suite E2E versionada ni job de navegador en CI | Cobertura | Bajo | repo | Esta auditoría usó un script Playwright externo | `REQUIERE_APROBACIÓN` |

## 5. E2E ejecutado (FASE 3 y 4)

Script Playwright con Edge, 1440×900 / 768×1024 / 375×812. **34/34 comprobaciones PASS**:

- Públicas: `/`, `/productos`, `/cotizar`, `/seguimiento`, `/login`, `/aviso-privacidad` con
  `main#contenido`, meta description, sin overflow y sin errores de consola/red.
- SEO: login `noindex, nofollow`; portada con canonical absoluto.
- Login fallido: mensaje visible, sin sesión almacenada.
- Seguimiento: `SOL-2026-018` + correo correcto muestra folio, cotización y chat; correo ajeno no
  revela datos y muestra error.
- Login admin por UI con “Recordarme” → sesión en `localStorage` y dashboard con KPIs.
- Internas: `/dashboard`, `/solicitudes`, `/captura`, `/consultas`, `/inventario`,
  `/abastecimiento`, `/produccion`, `/clientes`, `/marketing` cargan, sin overflow ni errores.
- Roles: marketing no entra a `/inventario` (redirige a `/dashboard`) y sí a `/marketing`;
  ventas no entra a `/abastecimiento`.
- Token inválido: cierra sesión, limpia storage y redirige a `/login?expirada=1`.
- Responsive: 0 px de overflow en 10 combinaciones ruta×viewport.
- Capturas: `%TEMP%\opencode\capturas-auditoria\` (`home`, `productos`, `cotizar`, `seguimiento`,
  `login` a 1440 px y `home` a 375 px).

No se ejecutó axe-core/Lighthouse (sin dependencia instalada): accesibilidad solo verificada de forma
manual (labels asociados, `main`, skip link, `aria-current`, foco en modales por código).

## 6. Fixes aplicados (FASE 6)

### H-04 — Token en rutas internas con `/public/` en el query

- Test: `src/app/core/interceptors/auth.interceptor.spec.ts` →
  `añade el token si una URL interna solo menciona /public/ en sus parámetros`.
- TDD: sin fix `1 failed | 6 passed`; con fix `7 passed`.
- Fix mínimo: comparar la ruta sin query contra `/api/public/…` y `/api/auth/login`.
- Commit `e8dbb16`.
- Grill-me: ¿falla sin fix? sí (rojo capturado). ¿Pasa con fix? sí. ¿Rompe contratos? no: las rutas
  públicas siguen sin token y el manejo de 401 no cambia.

### H-06 — Pagos contra el saldo pendiente

- Test: `Flask_Llamma_API/tests/test_flujos.py::test_09_pagos_validan_saldo`.
- TDD: sin fix el sobrepago devolvía `201`; con fix devuelve `400`, el saldo queda intacto y la
  liquidación exacta deja saldo 0 y estado `en-produccion`.
- Fix mínimo: tope y recálculo sobre `pedido.saldo`, que ya descuenta el anticipo pactado.
- Commit `ad19ec0`.
- Verificación en vivo: instancia nueva en `:5001`, pedido `LLM-1051` (saldo 1218): pago de 1219 →
  `400`, saldo 1218, 0 pagos. La instancia de `:5000` seguía con código viejo hasta reiniciarse.
- Grill-me: ¿falla sin fix? sí (`201 != 400`). ¿Pasa con fix? sí (12/12 backend). ¿Rompe contratos?
  no: respuesta y campos no cambian; pedidos demo con pago de anticipo siguen liquidando con saldo.

### H-05 — Pruebas de backend en CI

- Suite `Flask_Llamma_API/tests/test_flujos.py` (12 pruebas, `unittest`, SQLite temporal, sin
  dependencias nuevas) y job `backend` en `.github/workflows/ci.yml`.
- Commit `634fde8` (CI) y `ad19ec0` (suite).
- Grill-me: no aplica TDD de comportamiento; el job es independiente del frontend y no altera
  contratos. Verificado en local con `python -m unittest discover -s tests` → 12/12.

## 7. Requiere aprobación (no aplicado)

| ID | Propuesta | Riesgo de aplicarlo sin decisión |
|---|---|---|
| H-01 | Rechazar el pedido o registrar un movimiento de faltante cuando `stock < requerido` | Cambia la operación del taller y pedidos ya confirmados |
| H-02 | No sobrescribir datos del cliente; solo rellenar campos vacíos | Puede dejar datos obsoletos que ventas espera actualizar |
| H-07 | Reintentar `generar_folio` 2–3 veces ante `IntegrityError` | Requiere prueba de concurrencia y coordinar con MySQL/SQLite |
| H-08 | Validar MIME real y limitar SVG | Puede rechazar archivos que hoy se aceptan |
| H-09 | Migrar `Query.get()` a `db.session.get()` | Refactor amplio sin impacto funcional |
| H-11 | Versionar Playwright y añadir job E2E | Nueva dependencia y costo de CI |

## 8. Bloqueados / no probables

- **H-03:** el test existente fija el comportamiento actual; cambiarlo exige decisión de producto y
  revisar todas las rutas sin `roles`.
- **H-10:** el límite en memoria no se comparte entre workers; requiere Redis/Flask-Limiter.
- **Flujos 15, 17 y 18:** no se preparó aislamiento para movimientos manuales, alta de usuarios ni
  cálculo de ROI; quedan como pendientes de una siguiente sesión.

## 9. Verificación global (FASE 7)

- `format:check` ✅ · `lint` ✅ · Vitest **54/54** ✅ · `build` ✅ (551.88 kB / 122.40 kB).
- Backend: `compileall` ✅ (incluye `tests/`) y **12/12** pruebas ✅.
- E2E **34/34** ✅ y responsive sin overflow.
- Consola/red: limpias en rutas públicas e internas; el único error esperado es el 401 del login
  fallido.
- Contratos `to_dict`, endpoints, folios y estados: **sin cambios**.
- Bundle: +0.03 kB (+0.005 %) respecto al baseline, dentro del umbral.

## 10. Handoff

```yaml
decision: auditoria-funcional-llamma-2026-11-23
estado: parcial
flujos_probados: [1,2,3,4,5,6,7,8,10,12,14,19,20]
flujos_parciales: [9,11,13,16]
flujos_no_probables: [15,17,18]
hallazgos:
  criticos_corregidos: [H-06]
  criticos_requieren_aprobacion: [H-01]
  medios_corregidos: [H-05]
  medios_requieren_aprobacion: [H-02, H-07]
  medios_bloqueados: [H-03, H-10]
  bajos_corregidos: [H-04]
  bajos_requieren_aprobacion: [H-08, H-09, H-11]
tests_creados:
  - archivo: Flask_Llamma_API/tests/test_flujos.py
    nombre: 12 pruebas de flujo (login, solicitud, cotización, pedidos, pagos, compras, adjuntos, estados)
    comando: cd Flask_Llamma_API && .venv\Scripts\python.exe -m unittest discover -s tests -v
  - archivo: src/app/core/interceptors/auth.interceptor.spec.ts
    nombre: añade el token si una URL interna solo menciona /public/ en sus parámetros
    comando: npx ng test --watch=false --include=src/app/core/interceptors/auth.interceptor.spec.ts
commits: [e8dbb16, ad19ec0, 634fde8]
ci_resultado: {format: pass, lint: pass, test: pass, build: pass, backend: pass, e2e: pass}
performance: {lcp_home_antes: no_medido, lcp_home_despues: no_medido, sin_regresion: true}
accesibilidad: {violaciones_antes: no_medido, violaciones_despues: no_medido}
contratos_modificados: []
backup: tag baseline-pre-audit-functional + ../llamma-audit-backup-2026-11-23/
pendiente_usuario: "decidir H-01, H-02, H-07, H-08, H-09 y H-11; reiniciar la API :5000 para servir el fix de pagos"
```

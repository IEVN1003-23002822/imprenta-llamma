# Auditoría integral — Llamma

**Alcance:** portal público (`/`, `/productos`, `/cotizar`, `/login`) + ERP interno (10 rutas), API Flask
(66 endpoints) y base MySQL.
**Método:** revisión de código, build de producción, recorrido E2E de 64 pasos contra API real,
medición de contraste, inspección de accesibilidad y revisión de configuración del backend.
**Fecha:** noviembre 2026.

---

## 1. Resumen ejecutivo

Llamma es un producto **funcional y con una base técnica por encima de la media**: toda la interfaz
consume la API real (sin mocks), el build de producción sale limpio y el rendimiento inicial es bueno.
El problema no es "que falte app", sino **cerrar la brecha entre un sistema interno correcto y un
portal público confiable**.

| Pilar | Nota | Lectura |
| --- | --- | --- |
| UX / usabilidad | 7.0 / 10 | Flujos claros y consistentes; seguimiento escondido, formulario largo sin borrador |
| Diseño visual | 7.5 / 10 | Identidad CMYK fuerte y coherente; faltan fotos reales y prueba social |
| Rendimiento | 8.5 / 10 | 89 kB de transferencia inicial, 15 chunks lazy, OnPush + signals |
| Robustez / seguridad | 5.0 / 10 | Sesión y 401 sin resolver; backend no apto para exponerse tal cual |
| Mantenibilidad | 6.0 / 10 | Monolitos de 600-1 500 líneas, 0 tests, 0 lint |

**Fortalezas verificadas**

- Build sin advertencias: **332.5 kB raw / 89.0 kB de transferencia inicial**, 15 chunks lazy (13-51 kB).
- **14/14 componentes con `OnPush`**, 74 signals, sin `zone.js`, todas las rutas con `loadComponent`.
- **15/15 tablas** envueltas en `table-responsive`; `:focus-visible` global; toasts con `aria-live`;
  17 bloques `role="alert"`; títulos por ruta; `scrollPositionRestoration` y anclas.
- Backend: tokens aleatorios **hasheados** en BD con expiración, 500 genérico sin traza, 413 con mensaje
  propio, nombres de archivo saneados (`utils.nombre_archivo_seguro`), permisos por rol.
- Se corrigieron y verificaron los tres huecos funcionales previos: ayuda de acceso, consultas
  guardadas y guard de solicitudes sin partidas. E2E: **64/64 pasos OK, 0 errores de consola**.

**Debilidades que más cuestan**

1. El portal no transmite confianza: **no hay footer, ni teléfono/WhatsApp, ni aviso de privacidad**, y
   el catálogo no tiene una sola foto de producto.
2. El CTA principal (blanco sobre degradado cian→magenta) está en **2.53:1**, por debajo de AA.
3. La sesión caducada no se detecta y **no existe manejo global del 401**: el usuario ve pantallas
   vacías o errores genéricos.
4. El backend, publicado tal cual, queda expuesto: **CORS `*`, `SECRET_KEY` por defecto, `debug=True`,
   MySQL `root` sin contraseña y token aceptado por `?token=`**.
5. **0 pruebas automatizadas y 0 lint** con `vitest`/`jsdom` ya instalados: el siguiente cambio grande
   se valida solo a mano.

**Veredicto:** listo para operación interna controlada. **No** para abrirse a internet sin cerrar los
P0 de seguridad y confianza (fase 0 del plan).

---

## 2. Hallazgos críticos

| ID | Hallazgo | Evidencia | Impacto | Prioridad |
| --- | --- | --- | --- | --- |
| H-01 | Correo y contraseña demo precargados en el login | `login.component.ts:29-30` | Cualquiera que abra `/login` entra con la cuenta admin | **P0** |
| H-02 | Sesión caducada no invalida la UI y el 401 no se maneja | `auth.service.ts:25,91-108`; `auth.interceptor.ts:7-21` | Pantallas vacías y errores crípticos a las 12 h | **P0** |
| H-03 | Backend inseguro por defecto | `app.py:28-33,123`; `config.py:14,19`; `auth.py:56` | Exposición total si se despliega sin cambios | **P0** |
| H-04 | Login y formulario público sin límite de intentos | `auth_routes.py` login; `public_routes.py` POST | Fuerza bruta y spam de solicitudes/archivos | **P0** |
| H-05 | Contraste insuficiente en el CTA principal | `styles.css:318-326` | 2.53:1 (AA exige 4.5:1); afecta conversión y accesibilidad | **P1** |
| H-06 | 9 modales sin nombre accesible, Esc, foco ni scroll lock | `abastecimiento.component.html:341` y 8 más; 0 `aria-labelledby` | Usuarios de teclado/lector quedan atrapados | **P1** |
| H-07 | Portal sin footer, contacto ni aviso de privacidad | `app.html:161` (termina en `<main>`); sin `<footer>` en el repo | Falta de confianza y de canal directo de contacto | **P1** |
| H-08 | Seguimiento enterrado al final de `/cotizar` | `cotizar.component.html:476`; `app.routes.ts:19` | El cliente no encuentra su estatus sin hacer scroll | **P1** |
| H-09 | Sin 404, OG, robots ni sitemap | `app.routes.ts:113-114`; `index.html`; `public/` solo `favicon.ico` | Mala indexación y enlaces rotos silenciosos | P2 |
| H-10 | 0 tests y 0 lint | Sin `*.spec.ts` en `src`; sin `eslint.config.*` | Regresiones solo detectables a mano | P2 |

### Detalle de los tres primeros

- **H-01** — El formulario arranca con `ana@llamma.mx` / `llamma2026` y `recordarme: true`, pero
  `recordarme` no se usa en ningún punto (`login.component.ts:30,43`). Es a la vez riesgo de acceso y
  falsa promesa de UX.
- **H-02** — `autenticado` es `sesion !== null`; la expiración solo se evalúa al leer `localStorage`
  (`leerSesion`). Si el token vence con la pestaña abierta, la UI sigue "autenticada" y cada llamada
  devuelve 401 sin que nadie redirija. El interceptor solo añade el header: no tiene `catchError`.
- **H-03** — `CORS(origins="*")`, `SECRET_KEY` con valor por defecto, `debug=True` en `app.run`,
  `mysql+pymysql://root:@127.0.0.1` y `request.args.get("token")`. Cualquier token en URL termina en
  logs, historial y `Referer`.

---

## 3. Propuestas de mejora

### 3.1 UX / UI

**Arquitectura de información y navegación**

1. **Ruta propia `/seguimiento`** (folio + correo) con enlace en el navbar y en el comprobante de la
   solicitud. Hoy vive al final de un formulario de 645 líneas.
2. **Menú ERP escalable**: 8 accesos dentro de «Módulos» es aceptable en móvil, pero en escritorio
   conviene una barra lateral colapsable con secciones (Comercial / Operación / Catálogo) y
   `aria-current="page"`; `routerLinkActive` no lo emite.
3. **404 real** con buscador, enlaces a catálogo/cotizar y registro del intento, en lugar del
   wildcard que redirige a `/` (`app.routes.ts:113`).
4. **Migas de pan** en detalle de pedido y captura para volver sin usar el botón del navegador.

**Formularios y fricción**

5. **Borrador persistente** del cotizador en `localStorage` (incluye metadatos de archivos) y aviso de
   "recuperamos tu solicitud". Una recarga hoy pierde todo el avance.
6. **Stepper real**: hoy «Paso 1 de 3» es una etiqueta; convertirla en indicador navegable, validar por
   paso y mostrar un **resumen lateral** con partidas y estimado antes de enviar.
7. **Pedir solo lo necesario**: el front exige teléfono (`cotizar.component.ts:75`) y la API lo trata
   como opcional; el mensaje exige 20 caracteres sin indicarlo hasta el error. Añadir hint, contador y
   validación en `blur`.
8. **Login honesto**: quitar credenciales demo, implementar «recordarme» (persistente vs. sesión) o
   eliminarlo, avisar de Bloq Mayús y ofrecer recuperación real (hoy solo `mailto:soporte@llamma.mx`).
9. **Confirmaciones propias** en lugar de `window.confirm` (5 usos: clientes, productos, inventario,
   abastecimiento, producción): mismo lenguaje visual, foco atrapado y texto específico de la acción.
10. **Errores accionables**: mapear `status 0` a "Sin conexión. Revisa tu red." y evitar mostrar el
    `HttpErrorResponse.message` técnico (`ui.service.ts:49-52`).

**Contenido y confianza (el mayor retorno comercial)**

11. **Footer global** con dirección, teléfono/WhatsApp, correo, horario, redes y aviso de privacidad.
    Hoy no existe ningún dato de contacto en toda la app.
12. **Catálogo con fotos reales**: las tarjetas solo muestran un icono y una etiqueta
    (`productos.component.html:86-91`). Añadir imagen, medidas, material y acabados; es lo que decide
    una cotización de imprenta.
13. **Prueba social**: portafolio de proyectos, testimonios y logotipos de clientes. Las cifras del
    hero («12+ años», «850+ proyectos») no tienen sustento visible ni enlace a casos.
14. **Microcopy de conversión** junto al CTA: tiempo de respuesta, garantía de color y "sin costo".

**Diseño visual y microinteracciones**

15. **Paleta accesible sin romper la marca**: conservar CMYK para acentos y añadir un "brand-strong"
    para texto sobre color, p. ej. degradado `#0077A3 → #C4006F` (5.04:1 y 5.87:1 con blanco) en
    sustitución de `#00AEEF → #EC008C` (2.53:1 y 4.25:1) en `.btn-brand`.
16. **Escala tipográfica y pesos**: 2 familias con 4-5 pesos cada una; limitar a 3 pesos y fijar una
    escala (12/14/16/20/28/40) para que las pantallas del ERP no varíen entre módulos.
17. **Microinteracciones de 150-200 ms** en cards, chips y CTA, y `prefers-reduced-motion` para el
    ticker y las animaciones de entrada (hoy no existe ninguna regla).
18. **Unificar estados de carga**: hay 12 spinners con patrones distintos; usar skeleton en tablas y
    mantener spinners solo en acciones puntuales.
19. **Revisar contraste en secundarios**: `--llamma-muted` sobre carbón da **3.43:1** y el amarillo
    sobre blanco **1.17:1**; usar `#867d00` (ya presente en home) para texto amarillo.

**Accesibilidad**

20. **Skip link** y landmarks (`<main>` ya existe; falta el enlace de salto al contenido).
21. **9 modales**: `aria-labelledby` al `h2` del header, foco inicial, trampa de foco, Esc, retorno de
    foco y bloqueo de scroll del `body`. Hoy no hay ningún handler de teclado.
22. **15 tablas**: añadir `<caption>` (visible u oculto) y `scope="col"`; sin ellos el lector anuncia
    celdas sin contexto.
23. **Etiquetas faltantes**: 6 `input` y 1 `select` sin `id`/`aria-label` (p. ej. el buscador del
    catálogo usa solo `placeholder`); 125 campos frente a 100 `<label>`.
24. **Errores de formulario**: mover el foco al primer campo inválido y enlazar con `aria-describedby`.

### 3.2 Rendimiento y arquitectura

**Lo que ya está bien (no tocar):** lazy loading total, `OnPush` en 14/14, signals, sin `zone.js`,
imágenes con `width`/`height` (sin CLS), tablas responsivas, presupuestos de bundle configurados.

**Quick wins de rendimiento**

25. **Autoalojar Bootstrap, Bootstrap Icons y las fuentes** (o purgar Bootstrap a lo usado). Hoy son
    4 peticiones a 2 CDN sin SRI, render-blocking y con riesgo de supply chain. Autoalojar permite
    cache inmutable, CSP estricta y control de versión.
    **Superada en parte el 19 de noviembre de 2026:** Bootstrap se retiró por completo y la interfaz
    pasó a Tailwind CSS 4 + Flowbite; Bootstrap Icons y las fuentes ya se sirven desde el mismo origen.
26. **Logo a SVG** (o WebP 2x de 4-6 kB): el PNG pesa **63.3 kB** para mostrarse a 31×44 px y se repite
    en 6 plantillas.
27. **Fuentes**: subset latino en `woff2`, `preload` de 1-2 pesos y `size-adjust` para el fallback; o
    reducir a una sola familia.
28. **`@defer`** en las secciones bajo el pliegue de home (materiales, proceso, CTA) y en los modales
    grandes de abastecimiento y captura. Hoy no se usa en ninguna plantilla.
29. **Timeout + reintento con backoff** en GET idempotentes (catálogo, resumen, listados). No hay
    `timeout` ni `retry` en ningún punto.
30. **Cache y deduplicación**: `shareReplay` para catálogo/resumen compartido entre navbar y bandeja;
    el `solicitudes.store` es la única pieza de estado compartido y el resto recarga por su cuenta.
31. **Cabeceras de cache** para `GET /api/public/productos` (ETag/`Cache-Control: 60`) y compresión
    Brotli en el servidor.

**Deuda estructural**

32. **Dividir monolitos**: `home.component.css` 16.1 kB/777 líneas (roza el budget de 16 kB),
    `cotizar` 645, `captura` 632 y `abastecimiento` 607 líneas de plantilla; extraer secciones y
    modales a componentes.
33. **Constantes de estado en un solo lugar**: los 7 conjuntos de `admin_routes.py:52-58` están
    duplicados en uniones TS y mapas de etiqueta/badge (44 mapeos). Exponer `GET /api/meta/estados` o
    generar un `estados.ts` compartido.
34. **Modularizar la API**: `admin_routes.py` son **1 507 líneas / 59.7 kB**; separar por dominio
    (solicitudes, pedidos, inventario, producción, marketing) y registrar blueprints.
35. **Migraciones**: hoy `create_all`; introducir Flask-Migrate antes del próximo cambio de esquema.
36. **PWA opcional**: manifest, iconos y service worker de shell para el ERP en taller/tablet. El
    proyecto se llama PWA pero no hay manifest, ni `theme-color`, ni offline.
37. **Presupuesto por chunk** (p. ej. warning 120 kB) y `--stats-json` en CI para detectar regresiones
    antes de que crezca el bundle.

### 3.3 Funcionalidad y seguridad

**P0 — antes de publicar**

38. Quitar credenciales demo y `recordarme` sin efecto; forzar cambio de contraseña si aplica.
39. `SECRET_KEY` obligatoria: fallar al arrancar si falta en producción; `debug=False`; CORS limitado
    al dominio real; usuario MySQL con contraseña y permisos mínimos.
40. Rechazar `?token=` (solo `Authorization: Bearer`) o sustituirlo por enlaces firmados de un solo uso
    y vida corta para descargas.
41. **Rate limiting** con Flask-Limiter: login (5/min por IP+cuenta con backoff), solicitudes públicas
    (3/h por IP), mensajes de chat y descargas; registrar intentos fallidos.
42. **Manejo global del 401** en el interceptor: limpiar sesión, redirigir a `/login?redirect=…&expirada=1`
    y un solo toast; validar `expiraEn` también en `autenticado()` y programar el cierre.
43. **Cabeceras de seguridad**: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
    `Permissions-Policy`, `frame-ancestors`. Sin CSP, un XSS en una app con token en `localStorage`
    equivale a robo de sesión.

**P1 — endurecimiento**

44. Subidas: validar MIME real además de extensión, nombre aleatorio, cuarentena/antivirus y descarga
    con `Content-Disposition: attachment`.
45. Validación de servidor completa: límites de longitud homogéneos (hoy hay truncados a 160),
    coherencia de totales/IVA/anticipo y transacciones en solicitud→cotización→pedido.
46. Auditoría de cambios: extender el registro (hoy solo `MovimientoInventario`) a estados de pedido,
    precios y pagos: quién, cuándo, valor anterior y nuevo.
47. Respaldos automáticos del dump y **prueba de restauración** documentada; alertas de errores 500.
48. Revisar enumeración de folios en el portal público (formato `SOL-YYYY-NNN` es predecible) y
    limitar la respuesta a folio+correo exactos con rate limit.

**Calidad y mantenimiento**

49. **Tests**: unitarios de `AuthService`, guards, interceptor y `UiService`; componente de cotizar;
    E2E Playwright de los 4 flujos críticos (solicitud pública, conversión a cotización, recepción de
    OC, cierre de producción). `vitest` y `jsdom` ya están instalados: solo falta el primer spec.
50. **ESLint + Prettier en CI** (`ng lint` no existe hoy) y `npm run build` como gate.
51. Documentar el contrato API↔frontend en un solo lugar (hoy `AGENTS.md` + `llamma.models.ts` +
    constantes duplicadas).

---

## 4. Plan de acción priorizado

Escala: impacto y esfuerzo en **A**lto / **M**edio / **B**ajo. Esfuerzo en días-desarrollador ideales.

| # | Acción | Impacto | Esfuerzo | Prioridad | Fase |
| --- | --- | --- | --- | --- | --- |
| 1 | Quitar credenciales demo y `recordarme` falso | A | 0.2 | P0 | 0 |
| 2 | Validar expiración en `autenticado()` + interceptor 401 con redirect y toast | A | 0.5 | P0 | 0 |
| 3 | Endurecer config: `SECRET_KEY` obligatoria, `debug=False`, CORS por dominio, MySQL con password | A | 0.5 | P0 | 0 |
| 4 | Rate limiting en login, solicitudes públicas, chat y descargas | A | 1.0 | P0 | 0 |
| 5 | Quitar `?token=` y descargas firmadas de corta vida | A | 0.5 | P0 | 0 |
| 6 | Degradado accesible del CTA (`#0077A3→#C4006F`) | A | 0.2 | P1 | 0 |
| 7 | Footer con contacto, horario, redes y aviso de privacidad | A | 0.5 | P1 | 0 |
| 8 | Autoalojar Bootstrap/Icons/fuentes + SRI/CSP | A | 1.5 | P1 | 1 |
| 9 | Ruta `/seguimiento` + enlaces en navbar y comprobante | A | 1.0 | P1 | 1 |
| 10 | Modales accesibles: `aria-labelledby`, Esc, foco, scroll lock | A | 1.5 | P1 | 1 |
| 11 | Borrador persistente del cotizador + stepper validado | A | 2.0 | P1 | 1 |
| 12 | Fotos reales en catálogo + portafolio/testimonios | A | 5.0 | P1 | 2 |
| 13 | Etiquetas, captions, skip link, `aria-current`, foco en errores | M | 1.5 | P1 | 1 |
| 14 | Logo SVG/WebP + `srcset` | M | 0.3 | P2 | 2 |
| 15 | 404 real + OG/Twitter/canonical/robots/sitemap/JSON-LD | M | 1.0 | P2 | 2 |
| 16 | `timeout`/`retry`/`shareReplay` + mensaje de red claro | M | 1.0 | P2 | 2 |
| 17 | `@defer` en home y modales pesados | M | 1.0 | P2 | 2 |
| 18 | Reemplazar `window.confirm` por diálogo propio | M | 0.5 | P2 | 2 |
| 19 | Dividir home/cotizar/captura/abastecimiento en subcomponentes | M | 4.0 | P2 | 3 |
| 20 | Constantes de estado compartidas (meta endpoint o `estados.ts`) | M | 1.0 | P2 | 3 |
| 21 | Modularizar `admin_routes.py` por dominio | M | 3.0 | P2 | 3 |
| 22 | Vitest (servicios/guards/interceptor) + Playwright (4 flujos) | A | 5.0 | P1 | 3 |
| 23 | ESLint + Prettier + CI (build + lint + test) | M | 1.0 | P2 | 3 |
| 24 | Flask-Migrate y prueba de restauración de respaldo | M | 2.0 | P3 | 4 |
| 25 | PWA instalable (manifest, iconos, shell offline) | B | 2.0 | P3 | 4 |

### Roadmap sugerido

- **Fase 0 — "no exponerse" (1-2 días):** 1-7. Cierra accesos indebidos, sesión rota, backend abierto,
  contraste del CTA y ausencia de contacto. Es lo que separa "interno" de "publicable".
  **Implementada y verificada el 17 de noviembre de 2026** (login sin credenciales demo, sesión y
  401, configuración segura, límites de peticiones, token solo por cabecera, contraste accesible,
  pie de página con contacto y aviso de privacidad).
- **Fase 1 — "encontrar y usar" (1-2 semanas):** 8-11 y 13. Seguimiento visible, formulario que no
  pierde datos, modales usables con teclado y assets bajo control.
  **Implementada y verificada el 18 de noviembre de 2026** (Bootstrap, Bootstrap Icons e Inter/Space
  Grotesk autoalojados con CSP; ruta `/seguimiento` con chat y adjuntos; directiva
  `appModalAccesible` en los 9 modales; stepper validado y borrador del cotizador en
  `localStorage`; skip link, `aria-current`, captions de tabla, `scope="col"`, etiquetas de
  controles y foco en el primer error).
- **Fase 2 — "convertir" (2-3 semanas):** 12, 14-18. Fotos reales, portafolio, SEO social, rendimiento
  percibido y microinteracciones.
  **Implementada y verificada el 18 de noviembre de 2026** (logo en WebP de 128 y 256 px con `srcset`
  en sus 8 apariciones; 404 real con buscador, `noindex` y enlaces de salida; `SeoService` que ajusta
  título, descripción, canonical, robots, Open Graph/Twitter y JSON-LD por ruta, más `robots.txt` y
  `sitemap.xml`; interceptor con `timeout` de 20 s y un reintento solo para `GET`; catálogo público
  cacheado con `shareReplay` y refresco tras mutaciones; `ConfirmacionService` con diálogo accesible en
  lugar de los 5 `window.confirm`; `@defer` de las secciones bajas de la portada en
  `HomeDetalleComponent`, con esqueleto y `prefers-reduced-motion`; columna `productos.imagen_url` con
  respaldo al icono si la foto falla).
  **Pendiente de contenido:** la acción 12 solo tiene la infraestructura. Faltan fotos reales de
  producto y proyectos/testimonios con autorización del cliente; hasta entonces esas secciones no se
  publican.
- **Fase 3 — "sostener" (3-4 semanas):** 19-23. Arquitectura, tests y lint para que las fases anteriores
  no se degraden.
  **En curso desde el 18 de noviembre de 2026** con el bloque «calidad primero»: catálogo único de
  estados compartido entre frontend y backend (20), ESLint + Prettier + CI con el build como compuerta
  (23), la primera batería de pruebas con Vitest/jsdom (22, 53 casos en verde) y la modularización del
  backend por dominio (21, `admin_routes.py` pasó de 1 750 a 40 líneas). La acción 19 avanzó con los
  subcomponentes de `cotizar` (comprobante, pasos y resumen); faltan los de captura y abastecimiento.
  De la 22 falta el tramo de Playwright para los cuatro flujos críticos.
  **Migración visual (19 de noviembre de 2026):** Bootstrap 5.3 y su JS salieron de `angular.json` y
  de `package.json`; las 21 plantillas usan utilidades Tailwind y las clases semánticas se definen en
  la capa `components` de `src/styles.css`, con `.llamma-container` como contenedor propio. Build de
  producción en 484.55 kB raw / 113.93 kB estimados (CSS 149.74 kB / 22.14 kB) sin advertencias de
  presupuesto ni selectores inválidos; Bootstrap Icons se conserva solo para los glifos `bi-*`.
- **Fase 4 — "operar" (continuo):** 24-25. Migraciones, respaldos probados y PWA opcional.

### Cómo medir el éxito

| Métrica | Línea base | Meta |
| --- | --- | --- |
| Lighthouse Performance (móvil, home) | medir tras fase 1 | ≥ 90 |
| Lighthouse Accessibility | 9 modales y 15 tablas sin nombre/contexto | ≥ 95 |
| Contraste CTA | 2.53:1 | ≥ 4.5:1 |
| Transferencia inicial | 89.0 kB | ≤ 100 kB (sin crecer con fotos) |
| Solicitudes que llegan a cotización | sin instrumentar | +10% en 60 días |
| Abandono del formulario | sin instrumentar | −20% |
| Cobertura de pruebas | 0 | ≥ 60% en lógica crítica |
| Errores 500 / semana | sin alertas | 0 con alerta activa |

---

## Anexo: evidencia medida

- Build: `chunk` inicial 187.00 kB + `main` 115.00 kB + `styles` 30.51 kB = **332.51 kB raw / 89.01 kB
  estimado de transferencia**; 15 chunks lazy de 13.52 a 51.06 kB; build en 4.8 s sin advertencias.
- Código: 14 componentes (14 `OnPush`), 74 signals, 0 `@defer`, 0 tests, 0 configuración de lint.
- Accesibilidad: 9 `role="dialog"` / 9 `aria-modal` / 9 backdrops / **0 `aria-labelledby`**; 15 tablas /
  15 `table-responsive` / **0 `<caption>`**; 125 campos, 100 `<label>`, 6 `input` + 1 `select` sin
  `id`/`aria-label`; 17 `role="alert"`; sin skip link; sin `prefers-reduced-motion`.
- Contraste calculado: blanco/cian **2.53:1**, blanco/magenta **4.25:1**, cian/blanco **2.53:1**,
  amarillo/blanco **1.17:1**, muted/carbón **3.43:1**, muted/papel **4.62:1**, carbón/amarillo **14.88:1**.
- Backend: 66 endpoints (9 públicos), `admin_routes.py` 1 507 líneas, CORS `*`, `debug=True`, TTL 12 h,
  token por header **o** `?token=`, `SECRET_KEY` con default, MySQL `root` sin contraseña.
- Portal: `public/` solo `favicon.ico`; `index.html` con Bootstrap/Icons/JS por CDN sin SRI y sin meta
  OG/Twitter/theme-color; `app.html` sin `<footer>`; catálogo sin imágenes; logo PNG 63.3 kB.

### Estado tras la Fase 2 (18 de noviembre de 2026)

- Build de producción: **764.1 kB raw / 151.6 kB estimado de transferencia**; portada en su propio
  chunk de 25.2 kB y las secciones diferidas en un chunk aparte. Sin advertencias ni exceso de
  presupuesto de estilos.
- Verificación automatizada en navegador: **Fase 0 30/30, Fase 1 40/40 y Fase 2 35/35** pasos OK,
  sin errores de consola ni respuestas API inesperadas. La Fase 2 comprueba SEO social, 404 y
  `noindex`, búsqueda `?q=`, logo WebP, carga diferida real, confirmaciones (cancelar y confirmar) y
  respaldo de imagen rota.
- Logo servido en WebP de 5.5 kB (128 px) y 10.9 kB (256 px) frente a 63.3 kB del PNG.
- Sigue pendiente la acción 12 en su parte de contenido: no hay fotos reales de producto ni
  portafolio/testimonios autorizados.

### Estado tras el bloque «calidad primero» de la Fase 3 (18 de noviembre de 2026)

- **Acción 20 (constantes compartidas).** `src/app/core/models/estados.ts` concentra estados de solicitud,
  cotización, pedido, producción, compras, actividades y marketing, además de prioridades, etapas,
  segmentos, líneas, categorías, unidades, tipos de movimiento y extensiones de archivo. Expone las
  ayudas `etiquetaDe`, `badgeDe`, `iconoDe`, `mapaEtiquetas`, `mapaIconos` y `mapaCortas`. Doce
  pantallas ya lo consumen y perdieron sus copias locales. En el backend, `Flask_Llamma_API/estados.py`
  es la única fuente y `routes/admin_routes.py` la importa. Las etiquetas quedaron unificadas (por
  ejemplo, la etapa `diseno` se muestra como «Diseño» en todas partes).
- **Acción 23 (lint, formato y CI).** ESLint 10 con `angular-eslint` 22 (reglas recomendadas para
  TypeScript y plantillas), Prettier con `endOfLine: auto` y `.prettierignore`, y los scripts `lint`,
  `format` y `format:check`. `.github/workflows/ci.yml` encadena `npm ci`, `format:check`, `lint`,
  las pruebas y `build`, de modo que un fallo de compilación o de estilo bloquea el cambio. El
  formateo se aplicó a todo `src/**/*.{ts,html,css}` sin cambios de comportamiento.
- **Acción 22 (pruebas, primera parte).** Vitest 4.1.12 con jsdom a través de
  `@angular/build:unit-test`. **53 pruebas en 7 archivos** cubren `AuthService` (sesión, almacenamiento,
  expiración y logout), los guards `authGuard`/`roleGuard`/`publicOnlyGuard`, `authInterceptor`
  (cabecera Bearer, rutas públicas y 401), `resilienciaInterceptor` (reintento solo de `GET`, sin
  reintento en escrituras ni en 4xx, corte a los 20 s), `UiService` (toasts, silencio y mensajes de
  error), `ConfirmacionService` (confirmar, cancelar y sustitución de solicitud pendiente) y el
  catálogo de estados (valores únicos, etiquetas, respaldos y compras abiertas).
- Dos ajustes de entorno quedaron documentados: `vitest-base.config.mts` relativiza los `include`
  absolutos porque `tinyglobby` no los resuelve en Windows, y `src/test-setup.ts` reenlaza
  `localStorage`/`sessionStorage` desde jsdom frente a los globales experimentales de Node 26.
- Verificación de regresión: `npm run format:check`, `npm run lint` y `npm test` en verde; build de
  producción en **764.2 kB raw / 151.6 kB** de transferencia, sin advertencias; E2E de Fase 0 30/30,
  Fase 1 40/40 y Fase 2 35/35.
- **Acción 21 (backend por dominio).** `routes/admin_routes.py` bajó de 1 750 a 40 líneas: ahora solo
  reúne los 12 blueprints internos en `ADMIN_BLUEPRINTS`. Los endpoints viven en
  `solicitudes_routes.py`, `cotizaciones_routes.py`, `pedidos_routes.py`, `clientes_routes.py`,
  `productos_routes.py`, `inventario_routes.py`, `compras_routes.py`, `produccion_routes.py`,
  `marketing_routes.py`, `dashboard_routes.py`, `usuarios_routes.py` y `archivos_routes.py`, y los
  helpers compartidos en `routes/comun.py`. Las 53 rutas conservan ruta, método y permisos.
  Verificación: 24/24 GET internos con 200 sobre MySQL; flujo completo en una SQLite temporal
  (**35/35**: compra y recepción, cotización → pedido, abonos, receta y descuento de inventario,
  solicitud → cotización, producción y calidad, marketing y usuarios) sin tocar los datos reales.
  Dos defectos previos salieron a la luz y se corrigieron: el abono no se reflejaba en el saldo del
  pedido (`Pago` se añadía por `pedido_id` en vez de a la colección) y `/api/consultas/pedidos`
  calculaba `ventasPorLinea` con un producto cartesiano por falta de unión con `Producto`.

### Estado tras la migración a Tailwind CSS + Flowbite (19 de noviembre de 2026)

- **Bootstrap retirado por completo.** `bootstrap.min.css` y `bootstrap.bundle.min.js` salieron de
  `angular.json` y el paquete `bootstrap` de `package.json`. Las plantillas ya no usan `row`,
  `col-*`, `d-*`, `justify-content-*`, `data-bs-*` ni utilidades equivalentes.
- **Tailwind CSS 4.3.5 + Flowbite 4.0.2** con `@tailwindcss/postcss` (`.postcssrc.json`). El tema
  institucional vive en `@theme` (colores CMYK, tipografías, radios y sombras) y la capa `components`
  de `src/styles.css` reimplementa contenedor, navbar, dropdown, botones, formularios, tablas,
  paginación, badges, alertas, spinner y modales con los mismos nombres de clase.
- **`.llamma-container`** sustituye a `.container` en las 21 plantillas y en el footer para no chocar
  con la utilidad `.container` de Tailwind. Las filas quedaron como
  `grid grid-cols-12` con `gap-x-*`/`gap-y-*` equivalentes a los antiguos `g-*`.
- **Menús sin Bootstrap JS.** El colapso del navbar y los desplegables usan signals de Angular,
  `[class.show]`, `aria-expanded`, cierre por clic fuera y `Escape`. El modal conserva
  `appModalAccesible` (foco, trampa de Tab, backdrop y bloqueo de scroll).
- **Flowbite con `forms: false`.** Su base de formularios emitía dos selectores inválidos (`:is()`)
  que el inliner de CSS crítico no podía parsear; los formularios usan la capa propia. Bootstrap
  Icons se mantiene solo para los ~150 glifos `bi-*` porque no hay reemplazo 1:1 en Flowbite.
- **Verificación:** `format:check`, `lint`, 53 pruebas y `build` en verde; build de producción en
  **484.55 kB raw / 113.93 kB estimados** (CSS 149.74 kB / 22.14 kB) sin advertencias. Comprobación
  automatizada en Edge/1440 y 390 px: 13/13 (tipografía, contenedor de 1320 px, rejilla de 12
  columnas, botón, dropdown, modal, tabla, página activa, menú móvil, consola y API limpias).
- **Corrección colateral:** `Cliente.to_dict` sumaba `Decimal` y Flask lo serializaba como cadena, así
  que el «Ticket promedio» del directorio mostraba `$NaN` cuando había pedidos. Ahora convierte a
  `float` (contrato `totalFacturado: number`) y el agregado se calcula bien.

### Detalle de órdenes: divulgación progresiva (20 de noviembre de 2026)

- **Problema.** `/detalle` apilaba cinco bloques densos sin jerarquía: el historial de producción
  repetía 11 etapas, el precio unitario aparecía dos veces en la misma fila, el teléfono del cliente
  se imprimía en dos tarjetas, la fecha de entrega y el saldo se repetían en tres lugares y había
  dos botones de impresión. La página medía 2 324 px a 1440 px y 4 126 px a 390 px.
- **Solución.** El encabezado de la orden pasó a ancho completo con los cuatro datos clave; el
  resumen económico vive en una columna lateral fija; y `produccion`, `calidad`, `pagos`, `entrega`
  y `archivos` son paneles plegables (`<h2>` + `<button aria-expanded>`) con un resumen visible en
  la cabecera. El estado se guarda por dispositivo en `llamma.detalle.secciones.v1`.
- **Duplicados eliminados.** Precio unitario dentro de «Especificación», «Sin archivo» repetido por
  partida, teléfono/correo en la tarjeta de entrega, saldo en el encabezado y chip de fecha del
  `page-header`. En móvil el resumen económico sube antes de las partidas mediante `order-*`.
- **Corrección funcional.** El `<select>` de estado se pintaba con la primera opción («Cotización»)
  porque el `[value]` se aplicaba antes de existir los `<option>`; ahora cada opción lleva
  `[selected]` y el control refleja el estado real de la orden.
- **Impresión.** `imprimir()` abre los cinco paneles, lanza `window.print()` y restaura la
  preferencia en `afterprint`, de modo que el papel incluye todo aunque la pantalla esté plegada.
- **Resultado.** 1 415 px a 1440 px (−39 %) y 2 466 px a 390 px (−40 %). Verificación automatizada
  en Edge: **19/19** (estado inicial plegado, persistencia abrir/cerrar, datos presentes al
  expandir, sin precio ni teléfono duplicados, selector sincronizado, impresión completa, orden
  móvil y consola/API limpias). `format:check`, `lint`, 53 pruebas y `build` en verde
  (484.87 kB raw / 114.03 kB estimados).

### Marketing oculto en la navegación (20 de noviembre de 2026)

- **Único acceso visual retirado:** la entrada «Marketing» del desplegable «Módulos» en `app.html`.
  Ahora se condiciona a `modulosVisibles.marketing` (`app.ts`), hoy en `false`. Afecta por igual a
  escritorio y móvil porque es el mismo DOM.
- **Se conserva íntegro:** `src/app/features/marketing/*`, la ruta `/marketing` con roles
  `admin`/`marketing` en `app.routes.ts`, los métodos `listarActividades`, `crearActividad` y
  `actualizarActividad` de `LlammaService`, el tipo `RolUsuario`, los endpoints de
  `marketing_routes.py` y el chunk diferido (31.12 kB) que sigue generándose.
- **La matriz «Permisos por rol» del login no se toca:** describe el rol, no es un acceso al módulo,
  y el usuario `paola@llamma.mx` puede seguir iniciando sesión.
- **Reactivación:** cambiar `modulosVisibles` a `{ marketing: true }` en `app.ts`. No hace falta
  tocar la plantilla ni las rutas.
- **Verificación:** **10/10** en Edge con administrador y con rol marketing, en 1440 y 390 px: el
  desplegable pasa de 8 a 7 accesos internos sin elementos ocultos por CSS, la navegación principal
  queda intacta, `/marketing` sigue renderizando por URL directa y la consola/red no registran
  errores. `format:check`, `lint`, 53 pruebas y `build` en verde (484.93 kB raw / 114.03 kB).

### Previsualización de mockups en el cotizador (20 de noviembre de 2026)

- **Alcance.** Solo se agregó la función de mockups a `/cotizar`: botón «Previsualizar diseño» en
  el paso 2, modal accesible con carga de imagen, dos vistas por producto, ajuste
  (contener/cubrir, tamaño y posición) y calibrador interno. Contacto, carrito, mensaje,
  logística, resumen, comprobante, chat y estilos existentes quedaron intactos.
- **Assets.** Los 14 PNG de `Toni/mockups` se convirtieron a WebP (máx. 1600 px, calidad 82) en
  `src/assets/images/mockups/`: pasan de ~112 MB a 0.55 MB sin cambiar la proporción, así que las
  coordenadas porcentuales siguen vigentes. El catálogo está indexado por nombre de producto en
  `cotizar.component.ts`, con respaldo a la lona.
- **Accesibilidad.** El modal usa `appModalAccesible` (rol, foco inicial, trampa de Tab, `Esc`),
  las miniaturas exponen `aria-pressed`, cada slider tiene etiqueta y el cierre tiene nombre
  accesible. El fondo oscuro no intercepta clics; se cierra con «Listo», la X o `Esc`.
- **Calibrador.** Es una herramienta interna: solo aparece con `/cotizar?calibrar=1` y copia el
  snippet listo para pegar en `MOCKUPS_CATALOGO`. El cliente nunca ve coordenadas técnicas.
- **Verificación.** 23/23 en Edge: apertura y cierre con `Esc` con retorno de foco, dos vistas y
  sus perspectivas, carga de diseño, sliders, `cover`/`contain`, reinicio, calibrador, 390 px sin
  desbordes, imágenes 200/304 y consola/red limpias. `format:check`, `lint`, 53 pruebas y `build`
  en verde (485.13 kB raw / 114.06 kB).

### Reorganización por dominio y optimización de consultas (20 de noviembre de 2026)

- **Frontend.** `src/app/llamma/` se dividió en `core/` (servicios, modelos, guards, interceptores y
  configuración), `shared/` (diálogo de confirmación y directiva de modales) y `features/` (17
  módulos). Los movimientos usaron `git mv` para conservar historial y se reescribieron 112 imports
  relativos; no se modificó ninguna plantilla, hoja de estilos ni flujo de UI.
- **Backend.** `models.py` (1004 líneas, 27 tablas) pasó a `models/` con un módulo por dominio
  (`usuarios`, `catalogos`, `inventario`, `compras`, `solicitudes`, `ventas`, `produccion`,
  `marketing`) más `base.py`. `models/__init__.py` reexporta todo, así que `from models import X`
  sigue funcionando sin tocar los endpoints.
- **Consultas.** Los listados y detalles usan `joinedload`/`selectinload` según cardinalidad, y el
  dashboard reemplazó sumas en Python por `count`/`sum`/`case`. Se ordenan de forma determinista los
  agregados por etapa y línea. Medición de `SELECT` por endpoint: total **193 → 92** (−52.3 %);
  clientes 25→6, solicitudes 41→7, órdenes de compra 14→6, tablero 18→9 y dashboard 21→13.
- **Base de datos.** 25 índices nuevos declarados en `models/*.py` y aplicados a `llamma_db`
  (44 en total en la metadata). La migración idempotente es
  `migrations/indices_rendimiento.py` y su equivalente SQL
  `migrations/2026_11_indices_rendimiento.sql`. El dump `llamma_laragon.sql` incorpora los índices
  sin alterar sus datos y se verificó importándolo en una base temporal (27 tablas).
- **Verificación.** Las 33 respuestas GET comparadas antes/después son idénticas (se normalizan
  fecha de health, último acceso y orden de tableros). **51/51** comprobaciones en Edge en 1440 y
  390 px, sin errores de consola ni respuestas 4xx/5xx. `format:check`, `lint`, 53 pruebas y `build`
  en verde (485.13 kB raw / 114.05 kB); `compileall` del backend sin errores.

### Migración a Tailwind + Flowbite en seis módulos (21 de noviembre de 2026)

- **Alcance.** Solo `login`, `dashboard`, `solicitudes`, `detalle`, `produccion` y `clientes`.
  No se modificaron `cotizar`, catálogo, inventario, abastecimiento, marketing ni el resto del ERP.
- **Componentes sustituidos.** Se retiraron de esas plantillas `btn*`, `form-label`,
  `form-control`, `form-select`, `form-check*`, `form-switch`, `input-group*`, `table`,
  `table-responsive`, `badge`, `alert`, `modal*`, `spinner-border*`, `pagination`, `page-*`,
  `h5`, `small`, `text-end` e `is-invalid`. En su lugar se usan utilidades Tailwind inline con los
  tokens de color y espaciado del proyecto.
- **Interacción.** Los modales usan overlay fijo, panel centrado y scroll interno; conservan
  `appModalAccesible` y ahora exponen `data-modal-title`/`data-modal-body`. Los interruptores de
  producción y clientes usan el patrón `peer` de Tailwind. La paginación activa/deshabilitada se
  resuelve con clases condicionales y `disabled`.
- **Compatibilidad.** La directiva de modales acepta los nuevos atributos y mantiene el respaldo a
  `.modal-title`/`.modal-body` para los módulos que aún no migraron.
- **Verificación.** `format:check`, `lint`, **53/53** pruebas y `build` en verde
  (500.14 kB raw / 116.18 kB). **51/51** comprobaciones de rutas en Edge; **21/21** capturas y
  comprobaciones de escritorio/móvil; **9/9** interacciones (abrir/cerrar modales, foco, bloqueo de
  scroll, interruptor y validación visual del login). Sin errores de consola ni desbordes a 390 px.

### Cierre de la migración en los seis módulos (21 de noviembre de 2026)

- **Login y clientes.** Todo el estilo pasó a utilidades Tailwind inline: estructura, marca, tarjeta,
  formulario, filas, pistas, notas, tabla de roles, permisos, seguridad, tarjetas de estadísticas,
  perfil, notas y segmentos. `login.component.css` y `clientes.component.css` quedaron sin reglas.
- **Primitivas compartidas.** En los seis módulos se sustituyeron `llamma-container`, `module-page`,
  `page-header`, `page-lead`, `panel-card`, `panel-head`, `panel-kicker`, `panel-link`, `date-chip`,
  `eyebrow`, `table-llamma`, `cell-main`, `cell-muted`, `table-note`, `field-error` y utilidades de
  color por clases Tailwind equivalentes. Las definiciones globales se conservan para el resto del
  ERP.
- **CSS depurado.** Se eliminaron reglas muertas (`auth-divider`, `session-*`, `kanban-legend`,
  `kanban-dot`, `dot-ink`, `kanban-more`, `machine-progress`) y las reglas locales que ya cubrían
  las utilidades migradas.
- **Flowbite.** No se añadió JavaScript: modales, tabs, toggles, paginación y formularios siguen
  controlados por Angular y `appModalAccesible`; se usan los patrones visuales de Flowbite/Tailwind.
- **Verificación.** `format:check`, `lint`, **53/53** pruebas y `build` en verde
  (518.47 kB raw / 118.57 kB). **51/51** rutas, **21/21** capturas y **9/9** interacciones en Edge;
  390 px sin desbordes y sin errores de consola.

### Fase 1 de migración global: shell y navegación (21 de noviembre de 2026)

- **Shell.** `app.html` pasó a utilidades Tailwind: contenedor de aplicación, skip link, franja CMYK,
  navbar, menú móvil, enlaces activos, desplegable «Módulos», chip de usuario, botones de acceso/salida,
  footer, toasts y `main`.
- **CSS eliminado.** `app.css` quedó sin reglas; se retiraron de `styles.css` los bloques de
  `.navbar*`, `.navbar-llamma*`, `.brand-*`, `.site-footer*`, `.app-shell`, `.app-main`, `.ink-strip`,
  `.skip-link`, `.user-*`, `.nav-link*` y los overrides del dropdown del navbar.
- **Conservado.** Las reglas genéricas de `.dropdown*` siguen disponibles para `consultas`; `.btn`
  y demás primitivas globales se mantienen para los módulos aún no migrados.
- **Verificación.** `format:check`, `lint`, **53/53** pruebas y `build` en verde
  (539.02 kB raw / 120.58 kB); **51/51** rutas y **9/9** interacciones en Edge, sin errores de
  consola ni desbordes a 390 px.

### Fase 2a: páginas públicas simples (21 de noviembre de 2026)

- **404.** `not-found-page`, `not-found-card`, `not-found-code`, búsqueda y enlaces migrados a
  utilidades Tailwind; `no-encontrado.component.css` quedó sin reglas.
- **Aviso de privacidad.** `legal-page`, `legal-back`, tipografía legal, listas, enlaces, `hr` y pie
  migrados; `aviso-privacidad.component.css` quedó sin reglas.
- **Primitivas reutilizadas.** Contenedor, `panel-card`, `panel-kicker`, `eyebrow`, `page-lead`,
  botones, inputs y `field-error` se resolvieron con las mismas utilidades de los módulos anteriores.
- **Verificación.** `format:check`, `lint`, **53/53** pruebas y `build` en verde
  (541.29 kB raw / 120.94 kB); **51/51** rutas en Edge; capturas de 404 y aviso revisadas sin
  desbordes ni errores de consola.

### Fase 2b: catálogo público de productos (21 de noviembre de 2026)

- **Catálogo.** Filtros por línea, buscador, rejilla de tarjetas, media, precio, badges, estado
  vacío, error y bloque de ayuda migrados a utilidades Tailwind.
- **Gestión interna.** Modal, tabla, formularios, switches, botones y acciones de publicación/baja
  pasaron al mismo patrón de utilidades; el switch usa `peer`.
- **CSS eliminado.** `productos.component.css` quedó sin reglas.
- **Verificación.** `format:check`, `lint`, **53/53** pruebas y `build` en verde
  (546.11 kB raw / 121.33 kB); **51/51** rutas en Edge y captura del catálogo revisada.

### Fase 2c: seguimiento público (21 de noviembre de 2026)

- **Consulta.** Cabecera, formulario folio/correo, validaciones, botones y tarjeta de ayuda migrados a
  utilidades Tailwind.
- **Resultado.** Datos de la solicitud, partidas, archivos, cotización y badges migrados.
- **Chat.** Hilos, burbujas propias, metadatos, adjuntos, composición, chips y ayudas migrados a
  utilidades; se eliminó la dependencia del CSS global del chat en esta vista.
- **CSS eliminado.** `seguimiento.component.css` quedó sin reglas.
- **Verificación.** `format:check`, `lint`, **53/53** pruebas y `build` en verde
  (551.10 kB raw / 121.92 kB); **51/51** rutas en Edge y captura de `/seguimiento` revisada.

### Vitrina «Nuestros productos» en la portada (21 de noviembre de 2026)

- **Decisión UX.** Se reutiliza la sección de portafolio que ya existía en la home, con el ancla
  `#nuestros-productos`. No se añade otro elemento al menú superior para no competir con «Catálogo»;
  el acceso secundario queda en el footer («Nuestros productos»). La vitrina muestra ejemplos de
  acabados y la sección explica que no es el catálogo comercial.
- **Assets.** 10 JPG de `Lamma  Mockup realista/` se convirtieron a WebP calidad 84 y máx. 1000 px:
  `src/assets/images/portafolio/textil/` (4) y `portafolio/promocionales/` (6). Pasan de 5.85 MB a
  0.52 MB. Los originales quedan fuera de Git mediante `.gitignore`.
- **Implementación.** `PORTAFOLIO` en `site-info.ts` contiene los 10 casos; la home usa un layout
  masonry Tailwind (`columns-1 md:columns-2 xl:columns-3`) con imágenes de altura natural, badges,
  títulos, descripciones y CTA final a `/cotizar`.
- **Verificación.** `format:check`, `lint`, **53/53** pruebas y `build` en verde
  (553.24 kB raw / 122.44 kB); **51/51** rutas en Edge, imágenes WebP con HTTP 200 y sin desbordes
  horizontales a 390 px.

### Precios oficiales de playeras, tazas y lona (21 de noviembre de 2026)

- **Catálogo.** Se separó la playera en dos SKU: `Playera DTF 29 × 29 cm` a `$220` y
  `Playera DTF menor a 29 × 29 cm` a `$200`. La taza quedó en `$85` y la lona en `$220` por `1 m²`.
- **Lona.** El cotizador aplica `$220 + $120 × (m² - 1)`, con una nota visible que explica la regla.
  Para 3 m² el estimado es `$460`.
- **Persistencia.** `seed.py` genera los nuevos precios y descripciones;
  `migrations/precios_productos.py` actualizó la base existente y clonó la receta de la playera
  menor. `MOCKUPS_CATALOGO` reconoce ambos nombres de playera.
- **Verificación.** En Edge: lona 3 m² `$460`, playera 29 × 29 ×2 `$440`, playera menor ×2 `$400`,
  taza ×4 `$340`; al agregar lona 3 m² el carrito muestra `$460`. `format:check`, `lint`,
  **53/53** pruebas y `build` en verde.

### Vistas previas del catálogo (22 de noviembre de 2026)

- **Mapping producto → imagen.** Lona → `catalogo/gran-formato/lona-frontlit-impresa.webp`;
  roll-up → `gran-formato/roll-up-premium.webp`; playeras → `textil/playera-dtf-29x29.webp` y
  `textil/playera-dtf-menor-29x29.webp`; tote → `textil/tote-bag-manta.webp`; taza →
  `promocionales/taza-ceramica-sublimada.webp`; sticker → `promocionales/sticker-troquelado.webp`;
  tarjetas → `papeleria/tarjetas-couche-300g.webp`.
- **Optimización.** 8 fuentes (5.51 MB) convertidas a WebP calidad 84, máx. 1000 px: **0.43 MB**.
  Los originales de `Imagenes catalago/` quedan ignorados por Git.
- **UI.** Las tarjetas con `imagen_url` muestran una vista cuadrada con `object-contain`; si la imagen
  falla se conserva el icono de respaldo. Precios, badges, filtros y CTA no cambian.
- **Persistencia.** `seed.py` incluye `imagen`; `migrations/imagenes_catalogo.py` actualizó los 8
  productos existentes.
- **Verificación.** Las 8 imágenes cargan en Edge (`complete=true`, dimensiones naturales), HTTP 200;
  `format:check`, `lint`, **53/53** pruebas y `build` en verde (553.28 kB raw / 122.47 kB).

### Limpieza y conversión de assets aplicada (23 de noviembre de 2026)

- **Borrado.** Se eliminaron `Toni/` completo (14 PNG, `mockups.zip`, backups de cotizar y snapshot),
  `repomix-output.xml` de la raíz y el snapshot interno de Toni. El working tree bajó de **254.57 MB a
  14.78 MB**; los tracked pendientes de commit bajan de 123.90 MB a ~2.76 MB.
- **Conversión.** `logo-llamma.png` → `src/assets/images/logo-llamma.webp` (23.9 KB, calidad 80) y
  `favicon.ico` → `public/favicon.webp` (7.4 KB). El logo PNG queda como fuente; el ICO funciona como
  fallback legacy.
- **Referencias.** `index.html` usa `logo-llamma.webp` para OG/Twitter/JSON-LD y declara
  `favicon.webp` antes de `favicon.ico`; `seo.service.ts` usa el logo WebP. Se eliminó el comentario
  obsoleto de `Toni/mockups` en `cotizar.component.ts`.
- **Validación.** `format:check`, `lint`, **53/53** pruebas y `build` en verde
  (551.85 kB raw / 122.39 kB). Playwright capturó `/`, `/productos`, `/cotizar` y `/login`; `/favicon.webp`
  y `/assets/images/logo-llamma.webp` responden HTTP 200. La suite Edge sigue en **51/51**, sin errores
  de consola.



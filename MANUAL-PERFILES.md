# Manual de operación por perfil

**Llamma · Portal público + ERP interno**

Versión 1.0 · 25 de noviembre de 2026

Este documento explica qué puede hacer cada perfil dentro del panel interno de Llamma, qué
módulos ve, qué acciones están disponibles y cuándo una pantalla es de solo lectura.

---

## 1. Acceso al sistema

### 1.1 Entrar

1. Abre la URL del portal que te haya compartido el administrador.
2. Pulsa **Acceso equipo** (esquina superior derecha).
3. Captura tu **correo corporativo** y tu **contraseña**.
4. Opcionalmente marca **Recordarme** para conservar la sesión en ese equipo.
5. Pulsa **Entrar al panel**.

En desarrollo local la URL es `http://localhost:4200`. La API no se expone por separado: el
frontend la consume a través del mismo dominio.

### 1.2 Salir

El botón **Salir** está en la barra superior, junto a tu nombre y rol. Cierra la sesión y borra
la sesión guardada del navegador. Si no ves el botón en el móvil, abre primero el menú de
navegación (hamburguesa).

### 1.3 Sesión y contraseña

- La sesión dura **12 horas** por defecto. Cuando expira, el sistema te manda al login.
- No existe auto-registro. Las cuentas las crea y edita un **Administrador** desde `/usuarios`.
- Si olvidaste tu contraseña, pide al administrador que la actualice desde **Usuarios → Editar**.
- Nunca compartas tu cuenta. Todas las acciones quedan asociadas a tu usuario.

### 1.4 Usuarios demo (solo desarrollo local)

Contraseña para todos: `llamma2026`.

| Correo              | Rol        | Perfil        |
| ------------------- | ---------- | ------------- |
| `ana@llamma.mx`     | admin      | Administrador |
| `diego@llamma.mx`   | ventas     | Ventas        |
| `mariana@llamma.mx` | produccion | Producción    |
| `ivan@llamma.mx`    | inventario | Inventario    |
| `paola@llamma.mx`   | marketing  | Legado        |

> **Importante:** estas cuentas son solo para desarrollo. En producción deben cambiarse o
> eliminarse. El perfil **Marketing** se conserva en la base de datos, pero ya no tiene módulos
> en el frontend.

---

## 2. Matriz de permisos

### 2.1 Módulos

| Módulo                                  | Administrador | Ventas          | Producción      | Inventario      |
| --------------------------------------- | ------------- | --------------- | --------------- | --------------- |
| **Ventas** (Solicitudes y Cotizaciones) | ✅ Total      | ✅ Total        | 👁️ Solo lectura | ❌ Sin acceso   |
| **Producción**                          | ✅ Total      | 👁️ Solo lectura | ✅ Total        | 👁️ Solo lectura |
| **Inventario** (Insumos y Compras)      | ✅ Total      | 👁️ Solo lectura | ✅ Total        | ✅ Total        |
| **Clientes**                            | ✅ Total      | ✅ Total        | ❌ Sin acceso   | ❌ Sin acceso   |
| **Configuración** (Usuarios y roles)    | ✅ Total      | ❌ Sin acceso   | ❌ Sin acceso   | ❌ Sin acceso   |

**Leyenda**

- ✅ **Total:** puede ver, crear, editar y ejecutar las acciones del módulo.
- 👁️ **Solo lectura:** puede consultar la información. Los botones de escritura se ocultan o se
  deshabilitan y aparece el distintivo **Solo lectura**.
- ❌ **Sin acceso:** el módulo no aparece en el menú. Si se escribe la URL directamente, el
  sistema redirige al **Dashboard**.

### 2.2 Rutas internas por rol

| Ruta                  | Admin | Ventas | Producción | Inventario |
| --------------------- | :---: | :----: | :--------: | :--------: |
| `/dashboard`          |  ✅   |   ✅   |     ✅     |     ✅     |
| `/solicitudes`        |  ✅   |   ✅   |     👁️     |     —      |
| `/captura`            |  ✅   |   ✅   |     —      |     —      |
| `/detalle`            |  ✅   |   ✅   |     ✅     |     —      |
| `/consultas`          |  ✅   |   ✅   |     ✅     |     —      |
| `/inventario`         |  ✅   |   👁️   |     ✅     |     ✅     |
| `/abastecimiento`     |  ✅   |   👁️   |     ✅     |     ✅     |
| `/produccion`         |  ✅   |   👁️   |     ✅     |     👁️     |
| `/clientes`           |  ✅   |   ✅   |     —      |     —      |
| `/usuarios`           |  ✅   |   —    |     —      |     —      |
| `/marketing` (legado) |  ✅   |   —    |     —      |     —      |

> El módulo **Marketing** ya no aparece en el menú de ningún perfil. La ruta queda como legado
> accesible solo por URL para un administrador.

---

## 3. El menú y la navegación

### 3.1 Barra superior

- **Dashboard:** resumen general del taller.
- **Solicitudes:** bandeja de solicitudes del portal (admin, ventas y producción).
- **Cotizador:** captura interna de cotizaciones (admin y ventas).
- **Módulos:** despliega el resto de accesos.
- **Nombre y rol:** identifica la sesión activa.
- **Salir:** cierra la sesión.

### 3.2 Dentro de «Módulos»

- **Detalle de órdenes** (admin, ventas, producción)
- **Consultas** (admin, ventas, producción)
- **Inventario** (todos)
- **Abastecimiento** (todos)
- **Producción** (todos)
- **Clientes** (admin, ventas)
- **Usuarios** (solo admin)
- **Ver sitio público**

### 3.3 En móvil

La barra se colapsa en un botón de hamburguesa. Ábrelo para ver los enlaces y el desplegable
**Módulos**. Los formularios y tablas se adaptan; las tablas anchas permiten desplazamiento
horizontal.

---

## 4. Perfil Administrador

**Cuenta demo:** `ana@llamma.mx` · rol `admin`

### 4.1 Qué ve

Todos los módulos:

- Dashboard
- Solicitudes
- Cotizador
- Detalle de órdenes
- Consultas
- Inventario
- Abastecimiento
- Producción
- Clientes
- Usuarios
- Catálogo público con el botón **Gestionar catálogo**
- Marketing solo por URL (`/marketing`), sin acceso en el menú

### 4.2 Qué puede hacer

- **Solicitudes:** cambiar estado, responder al cliente por chat, descargar adjuntos, convertir en
  cotización, abrir el cotizador y revisar el historial.
- **Cotizador:** crear cotizaciones manuales, aprobarlas (descuenta inventario), registrar el
  anticipo como pagado y convertir la cotización en pedido.
- **Clientes:** crear, editar, consultar notas e historial y **desactivar** clientes.
- **Inventario:** crear y editar insumos, registrar entradas/salidas/ajustes, reponer desde las
  tarjetas de producto y exportar el inventario a CSV.
- **Abastecimiento:** crear proveedores y órdenes de compra, generar una orden consolidada y
  marcar órdenes como recibidas (suma stock automáticamente).
- **Producción:** avanzar o regresar etapas, editar la orden, registrar el checklist de calidad y
  exportar el reporte de turno.
- **Usuarios:** crear cuentas, editar nombre/correo/rol y cambiar la contraseña. Único perfil que
  puede desactivar clientes y administrar usuarios.
- **Catálogo:** crear productos, editar precio, descripción e imagen, publicar u ocultar del
  catálogo público.
- **Consultas:** guardar filtros, consultar pedidos por fecha/cliente/estado y exportar resultados.

### 4.3 Rutina sugerida

1. Revisar el **Dashboard** (ventas, producción y alertas de inventario).
2. Atender **Solicitudes** pendientes.
3. Revisar cotizaciones y pedidos en **Detalle de órdenes**.
4. Supervisar **Inventario** y **Abastecimiento**.
5. Revisar **Producción** y calidad.
6. Administrar **Usuarios** y el catálogo cuando haga falta.

---

## 5. Perfil Ventas

**Cuenta demo:** `diego@llamma.mx` · rol `ventas`

### 5.1 Qué ve

- Dashboard
- Solicitudes
- Cotizador
- Detalle de órdenes
- Consultas
- Inventario **en solo lectura**
- Abastecimiento **en solo lectura**
- Producción **en solo lectura**
- Clientes
- Catálogo público con **Gestionar catálogo**

No ve **Usuarios** ni **Marketing**.

### 5.2 Qué puede hacer

- **Solicitudes:** atender la bandeja, filtrar por estado o texto, abrir el detalle, cambiar el
  estado, responder por chat, descargar archivos, revisar mockups y convertir la solicitud en
  cotización.
- **Cotizador:** crear cotizaciones manuales, aprobarlas, registrar el anticipo y convertir a
  pedido.
- **Clientes:** crear y editar clientes, consultar notas, historial y segmentos.
- **Catálogo:** crear y editar productos, precios, descripciones e imágenes; publicar u ocultar.
- **Consultas:** buscar pedidos y exportar resultados.
- **Inventario y Producción:** consultar existencias, movimientos, tablero y calidad. No puede
  crear insumos, ajustar stock, avanzar etapas ni registrar calidad.
- **Abastecimiento:** consultar órdenes y proveedores. No puede crear ni recibir órdenes.

### 5.3 Lo que no puede hacer

- Entrar a **Usuarios** (redirige al Dashboard).
- Crear/editar insumos, ajustar inventario, recibir compras o mover producción.
- Desactivar clientes (solo admin).
- Ver el módulo Marketing.

### 5.4 Rutina sugerida

1. Abrir **Solicitudes** y revisar las nuevas.
2. Responder al cliente o convertir la solicitud en cotización.
3. Ajustar partidas en el **Cotizador** y aprobar.
4. Registrar el anticipo y convertir a pedido.
5. Dar seguimiento en **Detalle de órdenes** y **Consultas**.
6. Consultar **Inventario** antes de prometer fechas de entrega.

---

## 6. Perfil Producción

**Cuenta demo:** `mariana@llamma.mx` · rol `produccion`

### 6.1 Qué ve

- Dashboard
- Solicitudes **en solo lectura**
- Detalle de órdenes
- Consultas
- Inventario
- Abastecimiento
- Producción

No ve **Cotizador**, **Clientes**, **Usuarios** ni **Marketing**.

### 6.2 Qué puede hacer

- **Producción:** ver el tablero por etapas, avanzar o regresar una orden, abrir el detalle,
  editar etapa/estado, registrar el checklist de calidad y exportar el reporte de turno.
- **Inventario:** crear/editar insumos, registrar movimientos, reponer y exportar.
- **Abastecimiento:** crear proveedores y órdenes de compra, generar la orden consolidada y
  recibir órdenes (suma stock).
- **Detalle de órdenes:** consultar partidas, timeline de producción, calidad, entrega y archivos.
- **Consultas:** buscar pedidos por filtros y exportar.
- **Solicitudes:** consultar la información del cliente, partidas, archivos y mockups. No puede
  cambiar el estado, convertir en cotización ni responder el chat.

### 6.3 Lo que no puede hacer

- Crear o modificar cotizaciones.
- Aprobar cotizaciones o registrar pagos.
- Editar clientes.
- Administrar usuarios.
- Mover una solicitud a cotizada/convertida.

### 6.4 Rutina sugerida

1. Revisar el **Dashboard** y el **tablero de Producción**.
2. Abrir las órdenes de la etapa actual.
3. Avanzar la etapa conforme termine el trabajo.
4. Registrar el checklist de calidad antes de entrega.
5. Ajustar inventario si falta material.
6. Crear o recibir órdenes de compra en **Abastecimiento**.

---

## 7. Perfil Inventario

**Cuenta demo:** `ivan@llamma.mx` · rol `inventario`

### 7.1 Qué ve

- Dashboard
- Inventario
- Abastecimiento
- Producción **en solo lectura**

No ve **Solicitudes**, **Cotizador**, **Detalle de órdenes**, **Consultas**, **Clientes**,
**Usuarios** ni **Marketing**.

### 7.2 Qué puede hacer

- **Inventario:** crear y editar insumos, registrar entradas, salidas y ajustes de conteo,
  reponer desde las tarjetas de producto, consultar movimientos recientes, ver sugerencias de
  compra y exportar a CSV.
- **Abastecimiento:** crear proveedores, crear órdenes de compra, generar una orden consolidada,
  revisar recepciones programadas y marcar órdenes como recibidas (suma stock y crea movimiento).
- **Producción:** consultar el tablero por etapas, la carga por etapa y los últimos controles de
  calidad. No puede mover órdenes ni editar producción.

### 7.3 Lo que no puede hacer

- Ver o modificar ventas, solicitudes o cotizaciones.
- Consultar clientes.
- Administrar usuarios.
- Avanzar etapas o registrar calidad.

### 7.4 Rutina sugerida

1. Revisar **Inventario** (insumos críticos y stock bajo).
2. Reponer o ajustar existencias.
3. Revisar **Sugerencias de compra**.
4. Crear una orden de compra o generar la consolidada.
5. Marcar como recibida la orden cuando llegue el material.
6. Verificar el impacto en **Producción** (solo lectura).

---

## 8. Referencia de módulos

### 8.1 Dashboard

Vista general para todos los perfiles autenticados:

- Ventas del periodo, ticket promedio y pedidos.
- Órdenes en producción y distribución por etapa.
- Alertas de inventario y materiales críticos.
- Gráfica de ventas por línea de negocio.
- Pedidos recientes con acceso al detalle.
- Botón **Actualizar**.

### 8.2 Solicitudes

Bandeja comercial del portal:

- Filtros por estado (**Nueva**, **En revisión**, **Cotizada**, **Convertida**, **Descartada**) y
  búsqueda por folio, cliente o correo.
- Detalle con datos de contacto, partidas, archivos, previsualización de mockups y chat.
- Cambio de estado y respuesta al cliente (admin/ventas).
- **Convertir en cotización** (admin/ventas).
- **Nueva cotización** (admin/ventas).
- En solo lectura (producción) se muestra el distintivo y no aparecen las acciones de escritura.

### 8.3 Cotizador (`/captura`)

Solo admin y ventas. Pasos: **Cliente → Productos → Condiciones → Confirmación**.

- Datos del cliente y método de entrega.
- Partidas con producto, cantidad, precio y especificaciones.
- Cálculo de subtotal, IVA 16 %, total y anticipo del 50 %.
- **Aprobar cotización:** descuenta inventario según receta y muestra el resumen.
- **Registrar anticipo como pagado** y **Convertir en pedido**.
- Si la cotización viene de una solicitud, los datos se precargan.

### 8.4 Detalle de órdenes

Vista de la orden seleccionada:

- Partidas, piezas, diseño adjunto y totales.
- **Seguimiento de producción** (timeline por etapa).
- **Control de calidad** (revisiones).
- **Datos de entrega**.
- **Archivos del pedido**.
- **Pagos:** el formulario de registro solo aparece para admin/ventas.
- Botón **Imprimir** para admin/ventas.

### 8.5 Consultas

Buscador avanzado de pedidos para admin, ventas y producción:

- Filtros combinables por fecha, estado, cliente, empresa, producto o texto.
- Guardar y recuperar consultas.
- Exportar resultados.
- Abrir el detalle de un pedido.

### 8.6 Inventario

- Tarjetas por producto o tabla general.
- Stock actual, mínimo, máximo y nivel visual.
- **Nuevo insumo**, **Registrar movimiento** (entrada, salida o ajuste) y **Reponer**.
- Movimientos recientes y sugerencias de compra.
- Exportar CSV.

### 8.7 Abastecimiento

- Órdenes de compra con folio, proveedor, fechas, estado y total.
- **Nuevo proveedor** y **Nueva orden de compra**.
- **Generar orden consolidada** a partir de las compras recomendadas.
- **Marcar como recibida:** suma stock y registra un movimiento de entrada.
- Exportar.

### 8.8 Producción

- Tablero kanban con 8 etapas: **Diseño, Impresión, Laminado, Corte, Confección, Armado,
  Acabado y Entrega**.
- Avanzar o regresar etapa; abrir la orden.
- Detalle con historial, etapa actual, estado, prioridad, checklist de calidad y botón
  **Guardar cambios**.
- **Reporte de turno** exportable.

### 8.9 Clientes

- Directorio con búsqueda por nombre, empresa o RFC y filtro por segmento.
- Alta y edición de ficha; notas de seguimiento; historial y pedidos.
- **Desactivar cliente** solo para admin.
- Exportar.

### 8.10 Usuarios

Solo admin:

- Listado de cuentas, rol, estado y último acceso.
- Alta de usuario: nombre, correo, contraseña y rol.
- Edición: lápiz en la fila, cambios de nombre/correo/rol y contraseña opcional
  («Deja en blanco para mantener la contraseña actual»).
- Correo duplicado: error y no se guarda.
- La contraseña debe tener al menos 8 caracteres.

### 8.11 Catálogo público

- Visible para todo el mundo en **Catálogo**.
- Admin y ventas ven **Gestionar catálogo** para crear/editar productos, precios, descripciones,
  imágenes y publicación.

### 8.12 Portal público

- **Inicio**, **Catálogo**, **Solicitar cotización**, **Seguimiento** y **Aviso de privacidad**.
- El cliente puede cotizar sin cuenta, adjuntar archivos y consultar su folio con correo.

---

## 9. Flujos paso a paso

### 9.1 Atender una solicitud y convertirla en pedido

1. **Solicitudes** → selecciona una solicitud **Nueva**.
2. Revisa partidas, archivos y mockups. Responde por chat si hace falta.
3. Pulsa **Convertir en cotización**.
4. En el **Cotizador**, revisa precios y condiciones.
5. **Aprobar cotización** (descuenta inventario).
6. Marca el anticipo como pagado si ya se recibió.
7. **Convertir en pedido**.
8. El pedido aparece en **Detalle de órdenes** y en **Producción**.

### 9.2 Crear una cotización manual

1. **Cotizador** → captura o selecciona el cliente.
2. Agrega partidas con producto, cantidad y precio.
3. Revisa subtotal, IVA, total y anticipo.
4. Guarda la cotización.
5. Apruébala y conviértela en pedido cuando el cliente confirme.

### 9.3 Recibir una compra

1. **Abastecimiento** → localiza la orden.
2. Pulsa el icono de **recibir**.
3. Confirma. El stock se suma y se crea el movimiento de entrada.
4. Verifica en **Inventario → Movimientos recientes**.

### 9.4 Avanzar producción y registrar calidad

1. **Producción** → localiza la orden en su etapa.
2. Usa **Avanzar etapa** o **Regresar etapa**.
3. Abre la orden para editar etapa, estado, prioridad y responsable.
4. Captura el checklist de calidad.
5. Completa la orden antes de la entrega.

### 9.5 Editar un usuario

1. **Usuarios** → pulsa el lápiz de la fila.
2. Cambia nombre, correo o rol.
3. Deja la contraseña vacía para conservarla, o escribe una nueva de 8+ caracteres.
4. **Guardar cambios**.
5. Si el correo ya existe, el sistema muestra el error y no guarda.

### 9.6 Crear o editar un cliente

1. **Clientes** → **Nuevo cliente** o **Editar ficha**.
2. Captura nombre, correo, teléfono, empresa, RFC, segmento y notas.
3. Guarda. El correo no puede repetirse.
4. Solo un admin puede **Desactivar cliente**.

---

## 10. Reglas de negocio y validaciones

- **IVA:** 16 % sobre el subtotal.
- **Anticipo:** 50 % del total.
- **Entrega mínima:** 2 días hábiles desde la aprobación. Se respetan fines de semana y días
  festivos configurados. El campo de fecha se bloquea si no cumple.
- **Archivos:** PDF, AI, PSD, PNG, JPG, JPEG, SVG o ZIP; máximo **25 MB** por archivo.
- **Precios:** los del portal son referenciales y están sujetos a revisión de diseño y materiales.
- **Inventario:** al aprobar una cotización o convertir a pedido se descuenta según la receta. Si
  falta stock, la operación se bloquea y se muestra el detalle.
- **Folios:**
  - `SOL-...` solicitud del portal.
  - `COT-...` cotización.
  - `LLM-...` pedido.
  - `OC-...` orden de compra.
- **Contraseñas:** mínimo 8 caracteres. El hash nunca se muestra en la interfaz ni en la API.
- **Correos:** únicos por usuario y por cliente.

---

## 11. Seguridad y permisos

- El sistema valida los permisos **en el frontend y en la API**. Ocultar un botón no es la única
  protección: si alguien intenta una petición fuera de su rol, la API responde **403**.
- Si escribes a mano la URL de un módulo sin acceso, el sistema te regresa al **Dashboard**.
- El modo **Solo lectura** muestra el distintivo y bloquea las acciones de escritura.
- No compartas tu sesión ni dejes el equipo abierto. Usa **Salir** al terminar.
- El administrador puede crear, editar y cambiar contraseñas; no puede ver las contraseñas
  existentes.
- El módulo **Marketing** está retirado del frontend. La cuenta de marketing solo accede al
  Dashboard; su rol y datos siguen en la base.

---

## 12. Problemas frecuentes

| Situación                                     | Causa / solución                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| No veo un módulo en el menú                   | Tu rol no tiene acceso. Consulta la matriz de permisos.                       |
| Un botón no aparece o está deshabilitado      | La pantalla está en modo **Solo lectura** para tu rol.                        |
| La sesión se cerró sola                       | Expiró (12 h) o la API respondió 401. Vuelve a iniciar sesión.                |
| «Ya existe un usuario con ese correo»         | Usa otro correo; el correo debe ser único.                                    |
| «La fecha de entrega no es válida»            | Deben pasar al menos 2 días hábiles; revisa fines de semana y festivos.       |
| No puedo convertir una cotización en pedido   | Falta stock de algún insumo de la receta. Revisa Inventario y Abastecimiento. |
| No puedo recibir una orden de compra          | Tu rol no tiene permiso de escritura en Abastecimiento.                       |
| El PDF del comprobante no descarga            | Revisa que el navegador permita descargas y vuelve a intentar.                |
| Un archivo no se adjunta                      | Formato no permitido o supera 25 MB.                                          |
| No veo el diseño del cliente en una solicitud | El cliente no adjuntó mockup o el archivo no es una imagen compatible.        |

---

## Anexo A. Acciones de escritura por módulo

| Módulo        | Admin | Ventas | Producción | Inventario |
| ------------- | :---: | :----: | :--------: | :--------: |
| Solicitudes   |  ✅   |   ✅   |     —      |     —      |
| Cotizaciones  |  ✅   |   ✅   |     —      |     —      |
| Pedidos/pagos |  ✅   |   ✅   |  Parcial   |     —      |
| Clientes      |  ✅   |   ✅   |     —      |     —      |
| Usuarios      |  ✅   |   —    |     —      |     —      |
| Inventario    |  ✅   |   —    |     ✅     |     ✅     |
| Compras       |  ✅   |   —    |     ✅     |     ✅     |
| Producción    |  ✅   |   —    |     ✅     |     —      |
| Catálogo      |  ✅   |   ✅   |     —      |     —      |

> «Parcial» en pedidos significa que Producción puede cambiar el estado operativo de la orden,
> pero no registrar pagos ni crear pedidos.

## Anexo B. Glosario de estados

- **Solicitud:** Nueva → En revisión → Cotizada → Convertida / Descartada.
- **Cotización:** Borrador → Enviada → Aprobada → Convertida / Rechazada / Vencida.
- **Pedido:** Confirmado → En producción → Listo → Entregado / Cancelado.
- **Producción:** Pendiente → En proceso → Pausada → Completada / Rechazada.
- **Compra:** Pendiente → Confirmada → En tránsito → Recibida / Cancelada.
- **Prioridad:** Baja, Media, Alta, Urgente.

---

**Soporte:** `soporte@llamma.mx`

**Nota:** este manual describe el estado del sistema al 25 de noviembre de 2026. Si se agrega un
módulo, un rol o un cambio en la matriz de permisos, actualiza este documento.

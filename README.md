# Llamma

Proyecto web de la imprenta y empresa de transformación de productos **Llamma**. Esta fase contiene
únicamente la estructura física de carpetas y los esqueletos base del backend y del frontend; la
lógica de negocio y los endpoints se implementarán en fases posteriores.

## Tecnologías

- **Frontend:** Angular 22+ (Standalone Components, Signals, Angular Router).
- **Backend:** Python + Flask, Flask-Cors, Flask-SQLAlchemy, PyMySQL.
- **Base de datos:** MySQL.
- **Estilos:** CSS.

## Estructura del proyecto

```text
Llamma/
├── Flask_Llamma_API/
│   ├── app.py
│   └── requirements.txt
├── public/
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── llamma/
│   │   │   ├── abastecimiento/
│   │   │   ├── captura/
│   │   │   ├── clientes/
│   │   │   ├── consultas/
│   │   │   ├── dashboard/
│   │   │   ├── detalle/
│   │   │   ├── home/
│   │   │   ├── inventario/
│   │   │   ├── login/
│   │   │   ├── marketing/
│   │   │   ├── produccion/
│   │   │   ├── productos/
│   │   │   ├── llamma.models.ts
│   │   │   └── llamma.service.ts
│   │   ├── app.config.ts
│   │   ├── app.css
│   │   ├── app.html
│   │   ├── app.routes.ts
│   │   └── app.ts
│   ├── index.html
│   ├── main.ts
│   └── styles.css
├── angular.json
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.spec.json
├── .editorconfig
├── .gitignore
├── .prettierrc
└── README.md
```

Cada módulo funcional contiene sus archivos `*.component.ts`, `*.component.html` y
`*.component.css` como esqueletos sin lógica implementada.

## Módulos funcionales

| Módulo            | Propósito                                                        |
| ----------------- | ---------------------------------------------------------------- |
| `home`            | Landing corporativa y propuesta de valor.                        |
| `login`           | Autenticación y roles de usuario.                                |
| `dashboard`       | KPIs, ventas, métricas y analítica.                              |
| `captura`         | Captura de pedidos y cotizador reactivo.                         |
| `detalle`         | Historial y desglose general de órdenes.                         |
| `consultas`       | Filtros dinámicos por día, mes y cliente.                        |
| `productos`       | CRUD del catálogo de productos terminados y recetas.             |
| `inventario`      | Control de existencias de materias primas.                       |
| `abastecimiento`  | Reglas de stock mínimo/máximo y compras.                         |
| `produccion`      | Seguimiento de etapas de transformación y calidad.               |
| `clientes`        | Directorio, segmentación e historial de clientes.                |
| `marketing`       | Estrategia promocional, ROI y calendario de actividades.         |

## Puesta en marcha (fase de estructura)

### Frontend

```bash
npm install
npm start
```

La aplicación estará disponible por defecto en `http://localhost:4200`.

### Backend

```bash
cd Flask_Llamma_API
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

La API se ejecutará por defecto en `http://127.0.0.1:5000`.

## Estado

Estructura y esqueletos creados. Sin lógica de negocio, modelos de base de datos ni endpoints
funcionales implementados.

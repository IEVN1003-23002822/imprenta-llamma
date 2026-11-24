# Reglas de entrega — Llamma

## Regla vigente

- La fecha mínima de entrega es **2 días hábiles** después de la fecha de la solicitud.
- No cuentan **sábados, domingos** ni los **días festivos/cierres** configurados.
- La fecha de la solicitud no se cuenta; el conteo empieza al día siguiente.
- Si el cliente pide una fecha menor, la API responde `400` con:
  `La fecha de entrega solicitada no es válida. El margen mínimo es de 2 días hábiles.`
- La UI muestra la cláusula y el atributo `min` del calendario; aun así el backend valida
  siempre, porque el navegador puede manipularse.

## Dónde se configuran los festivos

| Lado | Archivo | Constante |
|---|---|---|
| Backend | `Flask_Llamma_API/config.py` | `DIAS_FESTIVOS` |
| Frontend | `src/app/core/config/dias-festivos.ts` | `DIAS_FESTIVOS` |

Ambas listas deben contener las mismas fechas en formato `YYYY-MM-DD`. Al inicio de cada año,
Janet/Kevin deben agregar los cierres del año siguiente en **los dos archivos** y volver a
ejecutar la suite.

La lista actual incluye 2026 y 2027: Año Nuevo, primer lunes de febrero, tercer lunes de marzo,
Día del Trabajo, Independencia, tercer lunes de noviembre y los cierres de taller del 24 y 25 de
diciembre.

## Cálculo

Implementación canónica:

- Backend: `Flask_Llamma_API/utils.py -> calcular_fecha_minima_entrega()`.
- Frontend: `src/app/core/utils/fechas.ts -> calcularFechaMinimaEntrega()`.

Ambas usan fecha **local** del equipo (México). Si el frontend y el backend se despliegan en
zonas horarias distintas, la fecha mínima debe obtenerse del backend para evitar diferencias
alrededor de la medianoche.

## Ejemplos verificados (2026)

| Fecha solicitud | Día | Cálculo | Fecha mínima |
|---|---|---|---|
| 2026-11-23 | Lunes | Mar 24, Mié 25 | **2026-11-25** |
| 2026-11-27 | Viernes | Lun 30, Mar 1 | **2026-12-01** |
| 2026-12-23 | Miércoles | 24/25 festivos, 26/27 fin de semana, Lun 28, Mar 29 | **2026-12-29** |
| 2026-05-01 | Viernes (festivo) | Lun 4 | **2026-05-04** con 1 día hábil |

> El ejemplo del requerimiento original decía que el 23 de diciembre de 2026 daba 28 de
> diciembre. Con la regla formal de **dos** días hábiles el resultado es **29**: 24 y 25 son
> festivos, 26 y 27 son fin de semana, y los días hábiles son 28 y 29. Se implementó la regla
> formal; si el negocio decide que baste el primer día hábil, debe cambiarse `dias_habiles` a 1
> en ambos lados y actualizar los tests.

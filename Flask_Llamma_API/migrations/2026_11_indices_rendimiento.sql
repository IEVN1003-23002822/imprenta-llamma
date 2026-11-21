-- Índices de rendimiento del esquema Llamma (MySQL 8, InnoDB).
-- Ejecutar una sola vez sobre una base existente; `migrations/indices_rendimiento.py`
-- hace lo mismo de forma idempotente.

ALTER TABLE `clientes` ADD INDEX `ix_clientes_nombre` (`nombre`);
ALTER TABLE `clientes` ADD INDEX `ix_clientes_segmento` (`segmento`);

ALTER TABLE `productos` ADD INDEX `ix_productos_categoria` (`categoria`);
ALTER TABLE `productos` ADD INDEX `ix_productos_linea_produccion` (`linea_produccion`);
ALTER TABLE `productos` ADD INDEX `ix_productos_catalogo` (`activo`, `publicado`);

ALTER TABLE `solicitudes_cotizacion` ADD INDEX `ix_solicitudes_cotizacion_creado_en` (`creado_en`);

ALTER TABLE `cotizaciones` ADD INDEX `ix_cotizaciones_estado` (`estado`);
ALTER TABLE `cotizaciones` ADD INDEX `ix_cotizaciones_fecha_emision` (`fecha_emision`);
ALTER TABLE `cotizaciones` ADD INDEX `ix_cotizaciones_creado_en` (`creado_en`);

ALTER TABLE `pedidos` ADD INDEX `ix_pedidos_fecha_pedido` (`fecha_pedido`);
ALTER TABLE `pedidos` ADD INDEX `ix_pedidos_creado_en` (`creado_en`);
ALTER TABLE `pedidos` ADD INDEX `ix_pedidos_estado_fecha` (`estado`, `fecha_pedido`);

ALTER TABLE `pagos` ADD INDEX `ix_pagos_fecha_pago` (`fecha_pago`);

ALTER TABLE `ordenes_produccion` ADD INDEX `ix_ordenes_produccion_etapa` (`etapa`);
ALTER TABLE `ordenes_produccion` ADD INDEX `ix_ordenes_produccion_creado_en` (`creado_en`);

ALTER TABLE `ordenes_compra` ADD INDEX `ix_ordenes_compra_estado` (`estado`);
ALTER TABLE `ordenes_compra` ADD INDEX `ix_ordenes_compra_fecha_emision` (`fecha_emision`);
ALTER TABLE `ordenes_compra` ADD INDEX `ix_ordenes_compra_creado_en` (`creado_en`);

ALTER TABLE `materias_primas` ADD INDEX `ix_materias_primas_nombre` (`nombre`);
ALTER TABLE `materias_primas` ADD INDEX `ix_materias_primas_categoria` (`categoria`);
ALTER TABLE `materias_primas` ADD INDEX `ix_materias_primas_activo_categoria` (`activo`, `categoria`);

ALTER TABLE `movimientos_inventario` ADD INDEX `ix_movimientos_inventario_tipo` (`tipo`);
ALTER TABLE `movimientos_inventario` ADD INDEX `ix_movimientos_inventario_creado_en` (`creado_en`);

ALTER TABLE `actividades_marketing` ADD INDEX `ix_actividades_marketing_estado` (`estado`);
ALTER TABLE `actividades_marketing` ADD INDEX `ix_actividades_marketing_fecha_inicio` (`fecha_inicio`);

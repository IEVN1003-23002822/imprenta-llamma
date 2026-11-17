-- MySQL dump 10.13  Distrib 8.4.3, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: llamma_db
-- ------------------------------------------------------
-- Server version	8.4.3

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `llamma_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `llamma_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `llamma_db`;

--
-- Table structure for table `actividades_marketing`
--

DROP TABLE IF EXISTS `actividades_marketing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `actividades_marketing` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `canal` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date DEFAULT NULL,
  `presupuesto` decimal(12,2) NOT NULL,
  `inversion_real` decimal(12,2) NOT NULL,
  `ingresos_atribuidos` decimal(12,2) NOT NULL,
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` text COLLATE utf8mb4_unicode_ci,
  `creado_por` int DEFAULT NULL,
  `creado_en` datetime NOT NULL,
  `actualizado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `creado_por` (`creado_por`),
  CONSTRAINT `actividades_marketing_ibfk_1` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `actividades_marketing`
--

LOCK TABLES `actividades_marketing` WRITE;
/*!40000 ALTER TABLE `actividades_marketing` DISABLE KEYS */;
INSERT INTO `actividades_marketing` VALUES (1,'Color que transforma','redes-sociales','2026-11-01','2026-12-31',12400.00,9672.00,58900.00,'activa','Branding y gran formato en Instagram',5,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(2,'Textil para equipos','redes-sociales','2026-11-01','2026-12-31',9800.00,7644.00,41200.00,'activa','Campaña de playeras DTF para empresas',5,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(3,'Regalos corporativos','google-ads','2026-11-01','2026-12-31',11200.00,8736.00,49600.00,'activa','Promocionales de fin de año',5,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(4,'Papelería que se guarda','correo','2026-11-01','2026-12-31',3400.00,2652.00,18700.00,'finalizada','Catálogo Couché por email',5,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(5,'Expo Diseño CDMX','punto-de-venta','2026-11-01','2026-12-31',6000.00,4680.00,17900.00,'planeada','Stand y muestras en Centro Citibanamex',5,'2026-11-17 05:52:23','2026-11-17 05:52:23');
/*!40000 ALTER TABLE `actividades_marketing` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clientes`
--

DROP TABLE IF EXISTS `clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clientes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(140) COLLATE utf8mb4_unicode_ci NOT NULL,
  `empresa` varchar(140) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `correo` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telefono` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direccion` varchar(240) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rfc` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `segmento` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notas` text COLLATE utf8mb4_unicode_ci,
  `activo` tinyint(1) NOT NULL,
  `creado_en` datetime NOT NULL,
  `actualizado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_clientes_correo` (`correo`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clientes`
--

LOCK TABLES `clientes` WRITE;
/*!40000 ALTER TABLE `clientes` DISABLE KEYS */;
INSERT INTO `clientes` VALUES (1,'Alma Creativa','Alma Creativa','ana@almacreativa.mx','55 1234 5678','Av. Álvaro Obregón 120, Roma Norte, CDMX','ACM220114H23','corporativo','Contacto: Ana Torres',1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(2,'Estudio Nómada','Estudio Nómada','luis@estudionomada.mx','55 2345 6789','Colima 240, Roma Norte, CDMX','ENO240118P45','pyme','Contacto: Luis Barrera',1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(3,'Café Origen','Café Origen','renata@cafeorigen.mx','55 3456 7890','Orizaba 85, Roma Norte, CDMX','COR210503M12','eventos','Contacto: Renata Solís',1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(4,'Grupo Altura','Grupo Altura','sergio@grupodigital.mx','55 4567 8901','Paseo de la Reforma 505, Cuauhtémoc, CDMX','GAL190822K78','corporativo','Contacto: Sergio Nava',1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(5,'Papelería Lumen','Papelería Lumen','carla@papelerialumen.mx','55 5678 9012','Amsterdam 130, Condesa, CDMX','PLU200317Q34','escolar','Contacto: Carla Domínguez',1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(6,'Bistró Aurora','Bistró Aurora','mario@bistroaurora.mx','55 6789 0123','Mazatlán 45, Condesa, CDMX','BAU220506L90','eventos','Contacto: Mario Esquivel',1,'2026-11-17 05:52:23','2026-11-17 05:52:23');
/*!40000 ALTER TABLE `clientes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `controles_calidad`
--

DROP TABLE IF EXISTS `controles_calidad`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `controles_calidad` (
  `id` int NOT NULL AUTO_INCREMENT,
  `orden_produccion_id` int NOT NULL,
  `criterio` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `aprobado` tinyint(1) NOT NULL,
  `observaciones` varchar(240) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `revisado_por` int DEFAULT NULL,
  `fecha` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `orden_produccion_id` (`orden_produccion_id`),
  KEY `revisado_por` (`revisado_por`),
  CONSTRAINT `controles_calidad_ibfk_1` FOREIGN KEY (`orden_produccion_id`) REFERENCES `ordenes_produccion` (`id`) ON DELETE CASCADE,
  CONSTRAINT `controles_calidad_ibfk_2` FOREIGN KEY (`revisado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `controles_calidad`
--

LOCK TABLES `controles_calidad` WRITE;
/*!40000 ALTER TABLE `controles_calidad` DISABLE KEYS */;
INSERT INTO `controles_calidad` VALUES (1,1,'Color y perfil CMYK',1,NULL,3,'2026-11-17 05:52:23'),(2,1,'Medidas y sangrado',1,NULL,3,'2026-11-17 05:52:23'),(3,1,'Empaque y etiquetado',0,'Pendiente antes de la entrega',3,'2026-11-17 05:52:23'),(4,2,'Color y perfil CMYK',1,NULL,3,'2026-11-17 05:52:23'),(5,2,'Medidas y sangrado',1,NULL,3,'2026-11-17 05:52:23'),(6,2,'Empaque y etiquetado',0,'Pendiente antes de la entrega',3,'2026-11-17 05:52:23'),(7,3,'Color y perfil CMYK',1,NULL,3,'2026-11-17 05:52:23'),(8,3,'Medidas y sangrado',1,NULL,3,'2026-11-17 05:52:23'),(9,3,'Empaque y etiquetado',0,'Pendiente antes de la entrega',3,'2026-11-17 05:52:23');
/*!40000 ALTER TABLE `controles_calidad` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cotizacion_items`
--

DROP TABLE IF EXISTS `cotizacion_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cotizacion_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cotizacion_id` int NOT NULL,
  `producto_id` int DEFAULT NULL,
  `descripcion` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `especificaciones` varchar(240) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cantidad` decimal(12,2) NOT NULL,
  `precio_unitario` decimal(12,2) NOT NULL,
  `importe` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `cotizacion_id` (`cotizacion_id`),
  KEY `producto_id` (`producto_id`),
  CONSTRAINT `cotizacion_items_ibfk_1` FOREIGN KEY (`cotizacion_id`) REFERENCES `cotizaciones` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cotizacion_items_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cotizacion_items`
--

LOCK TABLES `cotizacion_items` WRITE;
/*!40000 ALTER TABLE `cotizacion_items` DISABLE KEYS */;
INSERT INTO `cotizacion_items` VALUES (1,1,NULL,'Roll-up premium 85 × 200 cm','Mate premium',1.00,3850.00,3850.00),(2,1,NULL,'Tote bag de manta','DTF full color',25.00,110.00,2750.00),(3,2,NULL,'Lona Frontlit impresa','20 m² brillante',20.00,320.00,6400.00),(4,2,NULL,'Roll-up premium 85 × 200 cm','Estructura',1.00,3850.00,3850.00),(5,3,NULL,'Tote bag de manta','Una cara',25.00,110.00,2750.00),(6,3,NULL,'Sticker troquelado','8 × 8 cm',100.00,35.00,3500.00);
/*!40000 ALTER TABLE `cotizacion_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cotizaciones`
--

DROP TABLE IF EXISTS `cotizaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cotizaciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `folio` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `solicitud_id` int DEFAULT NULL,
  `cliente_id` int NOT NULL,
  `usuario_id` int DEFAULT NULL,
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_emision` date NOT NULL,
  `vigencia_dias` int NOT NULL,
  `subtotal` decimal(12,2) NOT NULL,
  `impuestos` decimal(12,2) NOT NULL,
  `total` decimal(12,2) NOT NULL,
  `anticipo` decimal(12,2) NOT NULL,
  `saldo` decimal(12,2) NOT NULL,
  `notas` text COLLATE utf8mb4_unicode_ci,
  `creado_en` datetime NOT NULL,
  `actualizado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_cotizaciones_folio` (`folio`),
  KEY `solicitud_id` (`solicitud_id`),
  KEY `cliente_id` (`cliente_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `cotizaciones_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_cotizacion` (`id`),
  CONSTRAINT `cotizaciones_ibfk_2` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `cotizaciones_ibfk_3` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cotizaciones`
--

LOCK TABLES `cotizaciones` WRITE;
/*!40000 ALTER TABLE `cotizaciones` DISABLE KEYS */;
INSERT INTO `cotizaciones` VALUES (1,'COT-2026-001',4,1,2,'enviada','2026-11-17',15,6600.00,1056.00,7656.00,3828.00,3828.00,'Cotización generada desde la solicitud del portal.','2026-11-17 05:52:23','2026-11-17 05:52:23'),(2,'COT-2026-002',5,4,2,'convertida','2026-11-17',15,10250.00,1640.00,11890.00,5945.00,5945.00,'Cotización generada desde la solicitud del portal.','2026-11-17 05:52:23','2026-11-17 05:52:23'),(3,'COT-2026-003',6,6,2,'convertida','2026-11-17',15,6250.00,1000.00,7250.00,3625.00,3625.00,'Cotización generada desde la solicitud del portal.','2026-11-17 05:52:23','2026-11-17 05:52:23');
/*!40000 ALTER TABLE `cotizaciones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `materias_primas`
--

DROP TABLE IF EXISTS `materias_primas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `materias_primas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `categoria` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unidad_medida` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stock_actual` decimal(12,4) NOT NULL,
  `stock_minimo` decimal(12,4) NOT NULL,
  `stock_maximo` decimal(12,4) NOT NULL,
  `costo_unitario` decimal(12,4) NOT NULL,
  `proveedor_id` int DEFAULT NULL,
  `activo` tinyint(1) NOT NULL,
  `creado_en` datetime NOT NULL,
  `actualizado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `proveedor_id` (`proveedor_id`),
  CONSTRAINT `materias_primas_ibfk_1` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `materias_primas`
--

LOCK TABLES `materias_primas` WRITE;
/*!40000 ALTER TABLE `materias_primas` DISABLE KEYS */;
INSERT INTO `materias_primas` VALUES (1,'Lona Frontlit 510g','lona','m2',34.0000,60.0000,300.0000,118.0000,1,1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(2,'Tinta Eco-solvente CMYK','tinta','litro',0.4000,1.0000,12.0000,1180.0000,2,1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(3,'Papel Couché 300g','papel','hoja',180.0000,300.0000,2000.0000,4.2000,3,1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(4,'Laminado en frío','laminado','ml',8.0000,20.0000,80.0000,210.0000,4,1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(5,'Perfil de aluminio','perfil','pieza',120.0000,40.0000,300.0000,95.0000,1,1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(6,'Vinil adhesivo brillante','vinil','m2',90.0000,30.0000,200.0000,95.0000,1,1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(7,'Tela algodón peinado','textil','kg',45.0000,20.0000,120.0000,285.0000,1,1,'2026-11-17 05:52:23','2026-11-17 05:52:23');
/*!40000 ALTER TABLE `materias_primas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mensajes_chat`
--

DROP TABLE IF EXISTS `mensajes_chat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mensajes_chat` (
  `id` int NOT NULL AUTO_INCREMENT,
  `solicitud_id` int NOT NULL,
  `remitente_tipo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `usuario_id` int DEFAULT NULL,
  `mensaje` text COLLATE utf8mb4_unicode_ci,
  `adjunto_nombre` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adjunto_guardado` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adjunto_mime` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `adjunto_tamano` int NOT NULL,
  `creado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `ix_mensajes_chat_solicitud_id` (`solicitud_id`),
  KEY `ix_mensajes_chat_creado_en` (`creado_en`),
  CONSTRAINT `mensajes_chat_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_cotizacion` (`id`) ON DELETE CASCADE,
  CONSTRAINT `mensajes_chat_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mensajes_chat`
--

LOCK TABLES `mensajes_chat` WRITE;
/*!40000 ALTER TABLE `mensajes_chat` DISABLE KEYS */;
INSERT INTO `mensajes_chat` VALUES (5,1,'cliente',NULL,'Hola, ¿el precio incluye la playera y el estampado? Quisiéramos confirmar antes de aprobar.',NULL,NULL,NULL,0,'2026-11-17 00:48:20'),(6,1,'interno',2,'¡Claro! El precio incluye playera de algodón y estampado DTF a todo color. También podemos ajustar tallas si lo necesitas.',NULL,NULL,NULL,0,'2026-11-17 02:48:20'),(7,1,'cliente',NULL,'Perfecto, gracias. ¿Podemos agregar 5 piezas talla XL?',NULL,NULL,NULL,0,'2026-11-17 04:48:20');
/*!40000 ALTER TABLE `mensajes_chat` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `movimientos_inventario`
--

DROP TABLE IF EXISTS `movimientos_inventario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `movimientos_inventario` (
  `id` int NOT NULL AUTO_INCREMENT,
  `materia_prima_id` int NOT NULL,
  `tipo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cantidad` decimal(12,4) NOT NULL,
  `unidad_medida` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `costo_unitario` decimal(12,4) NOT NULL,
  `referencia` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `motivo` varchar(240) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `usuario_id` int DEFAULT NULL,
  `creado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `ix_movimientos_inventario_materia_prima_id` (`materia_prima_id`),
  CONSTRAINT `movimientos_inventario_ibfk_1` FOREIGN KEY (`materia_prima_id`) REFERENCES `materias_primas` (`id`),
  CONSTRAINT `movimientos_inventario_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `movimientos_inventario`
--

LOCK TABLES `movimientos_inventario` WRITE;
/*!40000 ALTER TABLE `movimientos_inventario` DISABLE KEYS */;
INSERT INTO `movimientos_inventario` VALUES (1,1,'salida',6.0000,'m2',118.0000,'LLM-1048','Consumo de producción',3,'2026-11-17 05:52:23'),(2,2,'salida',0.2000,'litro',1180.0000,'LLM-1048','Consumo de producción',3,'2026-11-17 05:52:23');
/*!40000 ALTER TABLE `movimientos_inventario` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orden_compra_items`
--

DROP TABLE IF EXISTS `orden_compra_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orden_compra_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `orden_compra_id` int NOT NULL,
  `materia_prima_id` int NOT NULL,
  `cantidad` decimal(12,4) NOT NULL,
  `unidad_medida` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `precio_unitario` decimal(12,4) NOT NULL,
  `importe` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `orden_compra_id` (`orden_compra_id`),
  KEY `materia_prima_id` (`materia_prima_id`),
  CONSTRAINT `orden_compra_items_ibfk_1` FOREIGN KEY (`orden_compra_id`) REFERENCES `ordenes_compra` (`id`) ON DELETE CASCADE,
  CONSTRAINT `orden_compra_items_ibfk_2` FOREIGN KEY (`materia_prima_id`) REFERENCES `materias_primas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orden_compra_items`
--

LOCK TABLES `orden_compra_items` WRITE;
/*!40000 ALTER TABLE `orden_compra_items` DISABLE KEYS */;
INSERT INTO `orden_compra_items` VALUES (1,1,1,120.0000,'m2',110.0000,13200.00),(2,2,2,4.0000,'litro',1180.0000,4720.00),(3,3,3,500.0000,'hoja',4.2000,2100.00);
/*!40000 ALTER TABLE `orden_compra_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ordenes_compra`
--

DROP TABLE IF EXISTS `ordenes_compra`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ordenes_compra` (
  `id` int NOT NULL AUTO_INCREMENT,
  `folio` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `proveedor_id` int NOT NULL,
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_emision` date NOT NULL,
  `fecha_entrega` date DEFAULT NULL,
  `subtotal` decimal(12,2) NOT NULL,
  `impuestos` decimal(12,2) NOT NULL,
  `total` decimal(12,2) NOT NULL,
  `notas` text COLLATE utf8mb4_unicode_ci,
  `creado_por` int DEFAULT NULL,
  `creado_en` datetime NOT NULL,
  `actualizado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_ordenes_compra_folio` (`folio`),
  KEY `proveedor_id` (`proveedor_id`),
  KEY `creado_por` (`creado_por`),
  CONSTRAINT `ordenes_compra_ibfk_1` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores` (`id`),
  CONSTRAINT `ordenes_compra_ibfk_2` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ordenes_compra`
--

LOCK TABLES `ordenes_compra` WRITE;
/*!40000 ALTER TABLE `ordenes_compra` DISABLE KEYS */;
INSERT INTO `ordenes_compra` VALUES (1,'OC-2026-001',1,'confirmada','2026-11-17','2026-11-20',13200.00,2112.00,15312.00,NULL,4,'2026-11-17 05:52:23','2026-11-17 06:36:35'),(2,'OC-2026-002',2,'confirmada','2026-11-17','2026-11-18',4720.00,755.20,5475.20,NULL,4,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(3,'OC-2026-003',3,'pendiente','2026-11-17','2026-11-17',2100.00,336.00,2436.00,NULL,4,'2026-11-17 05:52:23','2026-11-17 05:52:23');
/*!40000 ALTER TABLE `ordenes_compra` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ordenes_produccion`
--

DROP TABLE IF EXISTS `ordenes_produccion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ordenes_produccion` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pedido_id` int NOT NULL,
  `etapa` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `responsable_id` int DEFAULT NULL,
  `fecha_inicio` datetime DEFAULT NULL,
  `fecha_fin` datetime DEFAULT NULL,
  `observaciones` text COLLATE utf8mb4_unicode_ci,
  `creado_en` datetime NOT NULL,
  `actualizado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pedido_id` (`pedido_id`),
  KEY `responsable_id` (`responsable_id`),
  KEY `ix_ordenes_produccion_estado` (`estado`),
  CONSTRAINT `ordenes_produccion_ibfk_1` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ordenes_produccion_ibfk_2` FOREIGN KEY (`responsable_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ordenes_produccion`
--

LOCK TABLES `ordenes_produccion` WRITE;
/*!40000 ALTER TABLE `ordenes_produccion` DISABLE KEYS */;
INSERT INTO `ordenes_produccion` VALUES (1,1,'confeccion','en-proceso',3,'2026-11-17 05:52:23',NULL,'Producción en curso en el taller Roma.','2026-11-17 05:52:23','2026-11-17 06:37:10'),(2,2,'acabado','en-proceso',3,'2026-11-17 05:52:23',NULL,NULL,'2026-11-17 05:52:23','2026-11-17 06:22:41'),(3,3,'entrega','en-proceso',3,'2026-11-17 05:52:23',NULL,'Producción en curso en el taller Roma.','2026-11-17 05:52:23','2026-11-17 05:52:23');
/*!40000 ALTER TABLE `ordenes_produccion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pagos`
--

DROP TABLE IF EXISTS `pagos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pagos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pedido_id` int NOT NULL,
  `tipo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `metodo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `monto` decimal(12,2) NOT NULL,
  `referencia` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_pago` datetime NOT NULL,
  `confirmado` tinyint(1) NOT NULL,
  `registrado_por` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `registrado_por` (`registrado_por`),
  KEY `ix_pagos_pedido_id` (`pedido_id`),
  CONSTRAINT `pagos_ibfk_1` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pagos_ibfk_2` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pagos`
--

LOCK TABLES `pagos` WRITE;
/*!40000 ALTER TABLE `pagos` DISABLE KEYS */;
INSERT INTO `pagos` VALUES (1,1,'anticipo','transferencia',5945.00,'SPEI-LLM-1048','2026-11-17 05:52:23',1,2),(2,2,'anticipo','transferencia',3625.00,'SPEI-LLM-1047','2026-11-17 05:52:23',1,2),(3,3,'anticipo','transferencia',3306.00,'SPEI-LLM-1046','2026-11-17 05:52:23',1,2);
/*!40000 ALTER TABLE `pagos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pedido_items`
--

DROP TABLE IF EXISTS `pedido_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pedido_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pedido_id` int NOT NULL,
  `producto_id` int DEFAULT NULL,
  `descripcion` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `especificaciones` varchar(240) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cantidad` decimal(12,2) NOT NULL,
  `precio_unitario` decimal(12,2) NOT NULL,
  `importe` decimal(12,2) NOT NULL,
  `archivo_diseno` varchar(240) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `pedido_id` (`pedido_id`),
  KEY `producto_id` (`producto_id`),
  CONSTRAINT `pedido_items_ibfk_1` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pedido_items_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pedido_items`
--

LOCK TABLES `pedido_items` WRITE;
/*!40000 ALTER TABLE `pedido_items` DISABLE KEYS */;
INSERT INTO `pedido_items` VALUES (1,1,NULL,'Lona Frontlit impresa','20 m² brillante',20.00,320.00,6400.00,NULL),(2,1,NULL,'Roll-up premium 85 × 200 cm','Estructura',1.00,3850.00,3850.00,NULL),(3,2,NULL,'Tote bag de manta','Una cara',25.00,110.00,2750.00,NULL),(4,2,NULL,'Sticker troquelado','8 × 8 cm',100.00,35.00,3500.00,NULL),(5,3,NULL,'Taza cerámica sublimada','Logo a dos tintas',60.00,95.00,5700.00,NULL);
/*!40000 ALTER TABLE `pedido_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pedidos`
--

DROP TABLE IF EXISTS `pedidos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pedidos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `folio` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cotizacion_id` int DEFAULT NULL,
  `cliente_id` int NOT NULL,
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prioridad` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_pedido` date NOT NULL,
  `fecha_entrega` date DEFAULT NULL,
  `subtotal` decimal(12,2) NOT NULL,
  `impuestos` decimal(12,2) NOT NULL,
  `total` decimal(12,2) NOT NULL,
  `anticipo` decimal(12,2) NOT NULL,
  `saldo` decimal(12,2) NOT NULL,
  `notas` text COLLATE utf8mb4_unicode_ci,
  `creado_por` int DEFAULT NULL,
  `creado_en` datetime NOT NULL,
  `actualizado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_pedidos_folio` (`folio`),
  KEY `cotizacion_id` (`cotizacion_id`),
  KEY `cliente_id` (`cliente_id`),
  KEY `creado_por` (`creado_por`),
  KEY `ix_pedidos_estado` (`estado`),
  CONSTRAINT `pedidos_ibfk_1` FOREIGN KEY (`cotizacion_id`) REFERENCES `cotizaciones` (`id`),
  CONSTRAINT `pedidos_ibfk_2` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `pedidos_ibfk_3` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pedidos`
--

LOCK TABLES `pedidos` WRITE;
/*!40000 ALTER TABLE `pedidos` DISABLE KEYS */;
INSERT INTO `pedidos` VALUES (1,'LLM-1048',2,4,'en-produccion','alta','2026-11-17','2026-11-23',10250.00,1640.00,11890.00,5945.00,5945.00,'Pedido de demostración generado desde una cotización aprobada.',2,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(2,'LLM-1047',3,6,'en-produccion','media','2026-11-17','2026-11-20',6250.00,1000.00,7250.00,3625.00,3625.00,'Pedido de demostración generado desde una cotización aprobada.',2,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(3,'LLM-1046',NULL,3,'listo','media','2026-11-17','2026-11-17',5700.00,912.00,6612.00,3306.00,3306.00,'Pedido de demostración generado desde una cotización aprobada.',2,'2026-11-17 05:52:23','2026-11-17 05:52:23');
/*!40000 ALTER TABLE `pedidos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permisos`
--

DROP TABLE IF EXISTS `permisos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permisos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clave` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `modulo` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `clave` (`clave`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permisos`
--

LOCK TABLES `permisos` WRITE;
/*!40000 ALTER TABLE `permisos` DISABLE KEYS */;
INSERT INTO `permisos` VALUES (1,'ventas.ver','ventas','Ver cotizaciones y pedidos'),(2,'ventas.gestionar','ventas','Crear y editar cotizaciones y pedidos'),(3,'solicitudes.ver','solicitudes','Ver la bandeja de solicitudes'),(4,'solicitudes.gestionar','solicitudes','Atender y convertir solicitudes'),(5,'produccion.ver','produccion','Ver el tablero de producción'),(6,'produccion.gestionar','produccion','Actualizar etapas y calidad'),(7,'inventario.ver','inventario','Ver inventario y compras'),(8,'inventario.gestionar','inventario','Ajustar stock y órdenes de compra'),(9,'clientes.ver','clientes','Ver el directorio de clientes'),(10,'clientes.gestionar','clientes','Crear y editar clientes'),(11,'marketing.ver','marketing','Ver campañas'),(12,'marketing.gestionar','marketing','Crear y editar campañas'),(13,'config.ver','configuracion','Ver usuarios y roles'),(14,'config.gestionar','configuracion','Administrar usuarios y roles');
/*!40000 ALTER TABLE `permisos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `produccion_etapas`
--

DROP TABLE IF EXISTS `produccion_etapas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `produccion_etapas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `orden_produccion_id` int NOT NULL,
  `etapa` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `responsable_id` int DEFAULT NULL,
  `inicio` datetime DEFAULT NULL,
  `fin` datetime DEFAULT NULL,
  `notas` varchar(240) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `orden_produccion_id` (`orden_produccion_id`),
  KEY `responsable_id` (`responsable_id`),
  CONSTRAINT `produccion_etapas_ibfk_1` FOREIGN KEY (`orden_produccion_id`) REFERENCES `ordenes_produccion` (`id`) ON DELETE CASCADE,
  CONSTRAINT `produccion_etapas_ibfk_2` FOREIGN KEY (`responsable_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `produccion_etapas`
--

LOCK TABLES `produccion_etapas` WRITE;
/*!40000 ALTER TABLE `produccion_etapas` DISABLE KEYS */;
INSERT INTO `produccion_etapas` VALUES (1,1,'diseno','completada',3,'2026-11-17 05:52:23','2026-11-17 05:52:23',NULL,'2026-11-17 05:52:23'),(2,1,'impresion','en-proceso',3,'2026-11-17 05:52:23',NULL,NULL,'2026-11-17 05:52:23'),(3,1,'acabado','pendiente',3,NULL,NULL,NULL,'2026-11-17 05:52:23'),(4,1,'entrega','pendiente',3,NULL,NULL,NULL,'2026-11-17 05:52:23'),(5,2,'diseno','completada',3,'2026-11-17 05:52:23','2026-11-17 05:52:23',NULL,'2026-11-17 05:52:23'),(6,2,'impresion','completada',3,'2026-11-17 05:52:23','2026-11-17 05:52:23',NULL,'2026-11-17 05:52:23'),(7,2,'acabado','en-proceso',3,'2026-11-17 05:52:23',NULL,NULL,'2026-11-17 05:52:23'),(8,2,'entrega','pendiente',3,NULL,NULL,NULL,'2026-11-17 05:52:23'),(9,3,'diseno','completada',3,'2026-11-17 05:52:23','2026-11-17 05:52:23',NULL,'2026-11-17 05:52:23'),(10,3,'impresion','completada',3,'2026-11-17 05:52:23','2026-11-17 05:52:23',NULL,'2026-11-17 05:52:23'),(11,3,'acabado','completada',3,'2026-11-17 05:52:23','2026-11-17 05:52:23',NULL,'2026-11-17 05:52:23'),(12,3,'entrega','en-proceso',3,'2026-11-17 05:52:23',NULL,NULL,'2026-11-17 05:52:23'),(13,1,'laminado','en-proceso',3,'2026-11-17 06:37:04',NULL,NULL,'2026-11-17 06:37:04'),(14,1,'corte','en-proceso',3,'2026-11-17 06:37:08',NULL,NULL,'2026-11-17 06:37:08'),(15,1,'confeccion','en-proceso',3,'2026-11-17 06:37:10',NULL,NULL,'2026-11-17 06:37:10');
/*!40000 ALTER TABLE `produccion_etapas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productos`
--

DROP TABLE IF EXISTS `productos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` text COLLATE utf8mb4_unicode_ci,
  `categoria` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `linea_produccion` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `precio_base` decimal(12,2) NOT NULL,
  `unidad_venta` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `icono` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `publicado` tinyint(1) NOT NULL,
  `activo` tinyint(1) NOT NULL,
  `creado_en` datetime NOT NULL,
  `actualizado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productos`
--

LOCK TABLES `productos` WRITE;
/*!40000 ALTER TABLE `productos` DISABLE KEYS */;
INSERT INTO `productos` VALUES (1,'Roll-up premium 85 × 200 cm','Display enrollable con lona Frontlit, estructura de aluminio y estuche.','display','gran-formato',3850.00,'pieza','bi-easel2',1,1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(2,'Lona Frontlit impresa','Impresión gran formato CMYK con acabado mate o brillante por m².','display','gran-formato',320.00,'m2','bi-bounding-box',1,1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(3,'Playera DTF unisex','Camiseta de algodón con estampado DTF a todo color, frente y espalda.','textil','textil',210.00,'pieza','bi-person-standing-dress',1,1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(4,'Tote bag de manta','Bolsa de manta 35 × 40 cm con asa reforzada y estampado DTF.','promocional','promocionales',110.00,'pieza','bi-bag-heart',1,1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(5,'Taza cerámica sublimada','Taza de 11 oz con sublimación full color y caja individual.','promocional','promocionales',95.00,'pieza','bi-cup-hot',1,1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(6,'Sticker troquelado','Vinil adhesivo brillante con corte de precisión, 8 × 8 cm.','promocional','promocionales',35.00,'pieza','bi-stickies',1,1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(7,'Tarjetas Couché 300g','Paquete de 100 tarjetas de presentación en Couché 300g con laminado mate.','papeleria','papeleria',850.00,'pieza','bi-postcard',1,1,'2026-11-17 05:52:23','2026-11-17 05:52:23');
/*!40000 ALTER TABLE `productos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `proveedores`
--

DROP TABLE IF EXISTS `proveedores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `proveedores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contacto` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefono` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `correo` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `condiciones_pago` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `activo` tinyint(1) NOT NULL,
  `creado_en` datetime NOT NULL,
  `actualizado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `proveedores`
--

LOCK TABLES `proveedores` WRITE;
/*!40000 ALTER TABLE `proveedores` DISABLE KEYS */;
INSERT INTO `proveedores` VALUES (1,'Gran Formato SA','Laura Vega','55 1111 2222','ventas@granformato.mx','Crédito 30 días',1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(2,'ColorLab MX','Hugo Pineda','55 3333 4444','hola@colorlab.mx','Contado',1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(3,'Papelera Central','Nadia Ríos','55 5555 6666','pedidos@papeleracentral.mx','Crédito 15 días',1,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(4,'Acabados Pro','Omar Lira','55 7777 8888','contacto@acabadospro.mx','Contado',1,'2026-11-17 05:52:23','2026-11-17 05:52:23');
/*!40000 ALTER TABLE `proveedores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `receta_componentes`
--

DROP TABLE IF EXISTS `receta_componentes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `receta_componentes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `receta_id` int NOT NULL,
  `materia_prima_id` int NOT NULL,
  `cantidad` decimal(12,4) NOT NULL,
  `unidad_medida` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `desperdicio_porcentaje` decimal(5,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `materia_prima_id` (`materia_prima_id`),
  KEY `ix_receta_componentes_receta_id` (`receta_id`),
  CONSTRAINT `receta_componentes_ibfk_1` FOREIGN KEY (`receta_id`) REFERENCES `recetas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `receta_componentes_ibfk_2` FOREIGN KEY (`materia_prima_id`) REFERENCES `materias_primas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `receta_componentes`
--

LOCK TABLES `receta_componentes` WRITE;
/*!40000 ALTER TABLE `receta_componentes` DISABLE KEYS */;
INSERT INTO `receta_componentes` VALUES (1,1,1,2.2000,'m2',5.00),(2,1,5,2.0000,'pieza',0.00),(3,2,1,1.0500,'m2',5.00),(4,2,2,0.0200,'litro',3.00),(5,3,7,0.2500,'kg',8.00),(6,3,2,0.0150,'litro',5.00),(7,4,7,0.3000,'kg',6.00),(8,4,2,0.0100,'litro',4.00),(9,5,2,0.0080,'litro',4.00),(10,6,6,0.0200,'m2',10.00),(11,6,4,0.0500,'ml',5.00),(12,7,3,100.0000,'hoja',6.00),(13,7,4,0.5000,'ml',5.00),(14,7,2,0.0200,'litro',3.00);
/*!40000 ALTER TABLE `receta_componentes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recetas`
--

DROP TABLE IF EXISTS `recetas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recetas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `producto_id` int NOT NULL,
  `nombre` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rendimiento` decimal(12,4) NOT NULL,
  `unidad_rendimiento` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `costo_estimado` decimal(12,2) NOT NULL,
  `tiempo_produccion_min` int NOT NULL,
  `creado_en` datetime NOT NULL,
  `actualizado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `producto_id` (`producto_id`),
  CONSTRAINT `recetas_ibfk_1` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recetas`
--

LOCK TABLES `recetas` WRITE;
/*!40000 ALTER TABLE `recetas` DISABLE KEYS */;
INSERT INTO `recetas` VALUES (1,1,'Receta Roll-up premium 85 × 200 cm',1.0000,'pieza',1750.00,90,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(2,2,'Receta Lona Frontlit impresa',1.0000,'m2',140.00,25,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(3,3,'Receta Playera DTF unisex',1.0000,'pieza',95.00,12,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(4,4,'Receta Tote bag de manta',1.0000,'pieza',48.00,10,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(5,5,'Receta Taza cerámica sublimada',1.0000,'pieza',42.00,6,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(6,6,'Receta Sticker troquelado',1.0000,'pieza',12.00,3,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(7,7,'Receta Tarjetas Couché 300g',1.0000,'pieza',320.00,45,'2026-11-17 05:52:23','2026-11-17 05:52:23');
/*!40000 ALTER TABLE `recetas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rol_permisos`
--

DROP TABLE IF EXISTS `rol_permisos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rol_permisos` (
  `rol_id` int NOT NULL,
  `permiso_id` int NOT NULL,
  PRIMARY KEY (`rol_id`,`permiso_id`),
  KEY `permiso_id` (`permiso_id`),
  CONSTRAINT `rol_permisos_ibfk_1` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rol_permisos_ibfk_2` FOREIGN KEY (`permiso_id`) REFERENCES `permisos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rol_permisos`
--

LOCK TABLES `rol_permisos` WRITE;
/*!40000 ALTER TABLE `rol_permisos` DISABLE KEYS */;
INSERT INTO `rol_permisos` VALUES (1,1),(2,1),(3,1),(4,1),(5,1),(1,2),(2,2),(1,3),(2,3),(1,4),(2,4),(1,5),(2,5),(3,5),(4,5),(1,6),(3,6),(1,7),(2,7),(3,7),(4,7),(1,8),(4,8),(1,9),(2,9),(5,9),(1,10),(2,10),(1,11),(5,11),(1,12),(5,12),(1,13),(1,14);
/*!40000 ALTER TABLE `rol_permisos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin','Admin','2026-11-17 05:52:22'),(2,'ventas','Ventas','2026-11-17 05:52:22'),(3,'produccion','Produccion','2026-11-17 05:52:22'),(4,'inventario','Inventario','2026-11-17 05:52:22'),(5,'marketing','Marketing','2026-11-17 05:52:22');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sesiones_usuario`
--

DROP TABLE IF EXISTS `sesiones_usuario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sesiones_usuario` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `token_hash` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creado_en` datetime NOT NULL,
  `ultimo_uso` datetime NOT NULL,
  `expira_en` datetime NOT NULL,
  `revocado` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_sesiones_usuario_token_hash` (`token_hash`),
  KEY `ix_sesiones_usuario_usuario_id` (`usuario_id`),
  CONSTRAINT `sesiones_usuario_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sesiones_usuario`
--

LOCK TABLES `sesiones_usuario` WRITE;
/*!40000 ALTER TABLE `sesiones_usuario` DISABLE KEYS */;
INSERT INTO `sesiones_usuario` VALUES (1,1,'9aca2fa50566b32dbae3f08640a9052c61f78faa6d9ca8c5dc2817c9026fdbe9','127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; es-MX) WindowsPowerShell/5.1.26100.9818','2026-11-17 05:53:10','2026-11-17 05:53:10','2026-11-17 17:53:10',0),(2,1,'c31f0c8c3199f647c595186f2d920205bac6efd4ba2f330d91a0063e8cf3fe95','127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; es-MX) WindowsPowerShell/5.1.26100.9818','2026-11-17 05:53:33','2026-11-17 05:53:33','2026-11-17 17:53:33',0),(3,1,'830e2c61df236fe13133914d9d6e67b962ce601d6df464503b9914c8d8d08bfb','127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; es-MX) WindowsPowerShell/5.1.26100.9818','2026-11-17 05:53:37','2026-11-17 05:53:37','2026-11-17 17:53:37',0),(4,1,'00ffce3d1f5aab0d7fb8161301eeff3c719904938bf07ecaf775297cfbc95705','127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; es-MX) WindowsPowerShell/5.1.26100.9818','2026-11-17 06:03:10','2026-11-17 06:03:10','2026-11-17 18:03:10',0),(5,1,'e713c869f4d3e2b8fc915efb889353eed63c4a4c159c387311fd9971e9cb9a47','127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; es-MX) WindowsPowerShell/5.1.26100.9818','2026-11-17 06:09:50','2026-11-17 06:09:50','2026-11-17 18:09:50',0),(6,1,'434f0628aa112cafa9edd41e060c198c0025e1d53f0bc32860452444aca8885d','127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; es-MX) WindowsPowerShell/5.1.26100.9818','2026-11-17 06:13:38','2026-11-17 06:13:38','2026-11-17 18:13:38',0),(7,1,'e8bdbaa38fdaaf55a7e69604d77f4f85de1b1244b00ea0a01f463c0d4ca592dd','127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; es-MX) WindowsPowerShell/5.1.26100.9818','2026-11-17 06:18:38','2026-11-17 06:18:38','2026-11-17 18:18:38',0),(8,1,'2b346441d4e8671523356481d0b452106ceb10e6d6f6e5b2c3dbd6161cdc9311','127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; es-MX) WindowsPowerShell/5.1.26100.9818','2026-11-17 06:22:25','2026-11-17 06:22:25','2026-11-17 18:22:25',0),(9,5,'c859abd22e1f60d9359fef920f99623ac0dbb5528feda31ddbd970fff81e106e','127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; es-MX) WindowsPowerShell/5.1.26100.9818','2026-11-17 06:22:35','2026-11-17 06:22:35','2026-11-17 18:22:35',0),(10,3,'185fb15160e33ed7d5a002804faa558450cb7b16aa4d8af43ecfc465a11bf1fa','127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; es-MX) WindowsPowerShell/5.1.26100.9818','2026-11-17 06:22:41','2026-11-17 06:22:41','2026-11-17 18:22:41',0),(11,3,'6f269b14dfe13dc1f45f5d580754ac2d51ba405540a16005247a19c033f93076','127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; es-MX) WindowsPowerShell/5.1.26100.9818','2026-11-17 06:22:47','2026-11-17 06:22:47','2026-11-17 18:22:47',0),(12,1,'dad1527559c6d8788e38c9412915dc3b5a6ca6eb69d95d342d462b69a2d71f09','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:23:13','2026-11-17 06:23:13','2026-11-17 18:23:13',0),(13,1,'dbe4dba7468d9c3568de2b2e81b34d34fc11c4465114441461c8fd40d23bde6c','127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; es-MX) WindowsPowerShell/5.1.26100.9818','2026-11-17 06:23:30','2026-11-17 06:23:30','2026-11-17 18:23:30',0),(14,1,'9eb085b7abf24874375c8805ed2f3c17d11a69cfae83ef99c9af3788a00a6d47','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:24:23','2026-11-17 06:24:23','2026-11-17 18:24:23',0),(15,1,'39d99bd1c18aa85f074e50aecbabb8b2184e84e6aad17571b0c46c2d59688db7','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:25:41','2026-11-17 06:25:41','2026-11-17 18:25:41',0),(16,1,'2ed2892677437c476f349896515c84ee95f8e8ce2cba0a9d63a5dd7df36932cc','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:26:03','2026-11-17 06:26:03','2026-11-17 18:26:03',0),(17,1,'19b6d0a51e4c5dbcff6c0f6f12a0000bda7c9328be7ad965a332d95ae28bafe1','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:26:39','2026-11-17 06:26:39','2026-11-17 18:26:39',0),(18,1,'295d7db8aa39b50dd4bc616ea307bca85f9bae7dd7869ed9de5b876b27704fd6','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:27:22','2026-11-17 06:27:22','2026-11-17 18:27:22',0),(19,1,'46981750624e3dc7da44cea9a67e6490ff65e6c4d0742dac1b3f4733451fa07b','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:27:35','2026-11-17 06:27:35','2026-11-17 18:27:35',0),(20,1,'4163d4c9370aae1b1d1b9e5c645190dcd4b04beea8f97156e47172ae4f7aba30','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:28:16','2026-11-17 06:28:16','2026-11-17 18:28:16',0),(21,1,'908cfcbf3aee8d45e929d855af41e01086c3e0b5b1509c1dff05773d6cbef483','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:28:31','2026-11-17 06:28:31','2026-11-17 18:28:31',0),(22,1,'7d5af5e62031d25d255abab9d887f24280d0099eb93f22feaab0e8d51916df64','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:29:27','2026-11-17 06:29:27','2026-11-17 18:29:27',0),(23,1,'b773bd56c5d98b386b51d4fb86e18d02568ee430e6816c6bfa3328ead31f09a8','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:29:38','2026-11-17 06:29:38','2026-11-17 18:29:38',0),(24,1,'2e52ab6f601c1d89b58e6675fe3ec96aa09b35530d294109d17fc5814ebc48b0','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:29:52','2026-11-17 06:29:52','2026-11-17 18:29:52',0),(25,4,'cd4788711f5c07883e91b4104d419af0ca5cadabaece2fa5a30bcd18ccac0d31','127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; es-MX) WindowsPowerShell/5.1.26100.9818','2026-11-17 06:30:27','2026-11-17 06:30:27','2026-11-17 18:30:27',0),(26,1,'71cfaba7f9b5f0e1a1ef7d3cb9c243f7b0a5d70fc289096d19fb9bc8a9113c87','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:31:43','2026-11-17 06:31:43','2026-11-17 18:31:43',0),(27,1,'b7f560cb8befae19d65f9cf280a7ab502795db5b1444a30f32530fcdd28d9e78','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:32:34','2026-11-17 06:32:34','2026-11-17 18:32:34',0),(28,1,'09f1901e30e72085271e399fef892dc1d67fe75ab954351e5e7a476f23ae2212','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:32:48','2026-11-17 06:32:48','2026-11-17 18:32:48',0),(29,1,'07f3183eb309721998074cb5b4d3f579ec6bd7acbf00b22d12dff121779dd13e','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:32:48','2026-11-17 06:32:48','2026-11-17 18:32:48',0),(30,1,'a86b6152eca570054352f9d814b354f308b41a4cbf2745eee414d93429bf1395','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:33:02','2026-11-17 06:33:02','2026-11-17 18:33:02',0),(31,1,'aa273bdffb69e1250c820f31137f9d5657c85da5687cca2a8c7abb035957d4b7','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 06:33:25','2026-11-17 06:54:06','2026-11-17 18:33:25',0),(32,1,'644adf06031766e81c491639f95298db3a18ee4d36b965fd38d69dfd7eb44e08','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:160.0) Gecko/20100101 Firefox/160.0','2026-11-17 06:35:49','2026-11-17 06:35:49','2026-11-17 18:35:49',1),(33,1,'3ca9b160c3d144f82c7044eecad06fdead84b6b099f4b378af53ff2aeca8cca1','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:160.0) Gecko/20100101 Firefox/160.0','2026-11-17 07:00:41','2026-11-17 07:00:41','2026-11-17 19:00:41',1),(34,1,'abd7bbe87c9dbc79527c23e26fbf7551fc95270217da934e05be55db3a787ae6','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:160.0) Gecko/20100101 Firefox/160.0','2026-11-17 07:06:08','2026-11-17 07:06:08','2026-11-17 19:06:08',1),(35,1,'538b20ae44ca62d6b6d574e6c54899722afd6869a03ad876da34f71428a482e4','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:160.0) Gecko/20100101 Firefox/160.0','2026-11-17 07:10:35','2026-11-17 07:10:35','2026-11-17 19:10:35',1),(36,1,'d9cf4f3dd73b66ff5b13ed113dbf0b81c6a2e1d6bfb9d0c6cbe1e70929b5b6a6','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:160.0) Gecko/20100101 Firefox/160.0','2026-11-17 07:12:01','2026-11-17 07:47:43','2026-11-17 19:12:01',0),(37,2,'53c1a2d9b29d7e199454040aa9dd32f08b1f69da51191d5bdc5002677e8aa6df','127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; es-MX) WindowsPowerShell/5.1.26100.9818','2026-11-17 07:42:47','2026-11-17 07:42:47','2026-11-17 19:42:47',0),(38,3,'a1e5b6b41598674474820e9f9d3a460689ef5183f922344cbc50dbf60caa763f','127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; es-MX) WindowsPowerShell/5.1.26100.9818','2026-11-17 07:42:55','2026-11-17 07:42:55','2026-11-17 19:42:55',0),(39,2,'449f6b67f3b28a6d1da767226e8ebdfe670919d15afb7e491c532c24a3d1d7b6','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0','2026-11-17 07:47:52','2026-11-17 07:47:52','2026-11-17 19:47:52',0);
/*!40000 ALTER TABLE `sesiones_usuario` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `solicitud_archivos`
--

DROP TABLE IF EXISTS `solicitud_archivos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `solicitud_archivos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `solicitud_id` int NOT NULL,
  `nombre_original` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre_guardado` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ruta_relativa` varchar(300) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tamano_bytes` int NOT NULL,
  `creado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_solicitud_archivos_solicitud_id` (`solicitud_id`),
  CONSTRAINT `solicitud_archivos_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_cotizacion` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `solicitud_archivos`
--

LOCK TABLES `solicitud_archivos` WRITE;
/*!40000 ALTER TABLE `solicitud_archivos` DISABLE KEYS */;
INSERT INTO `solicitud_archivos` VALUES (1,1,'brief-playeras.pdf','demo-brief-playeras.pdf','demo-brief-playeras.pdf','application/pdf',192,'2026-11-17 05:52:23');
/*!40000 ALTER TABLE `solicitud_archivos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `solicitud_items`
--

DROP TABLE IF EXISTS `solicitud_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `solicitud_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `solicitud_id` int NOT NULL,
  `producto_id` int DEFAULT NULL,
  `nombre_producto` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `especificaciones` varchar(240) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cantidad` decimal(12,2) NOT NULL,
  `precio_estimado` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `producto_id` (`producto_id`),
  KEY `ix_solicitud_items_solicitud_id` (`solicitud_id`),
  CONSTRAINT `solicitud_items_ibfk_1` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_cotizacion` (`id`) ON DELETE CASCADE,
  CONSTRAINT `solicitud_items_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `solicitud_items`
--

LOCK TABLES `solicitud_items` WRITE;
/*!40000 ALTER TABLE `solicitud_items` DISABLE KEYS */;
INSERT INTO `solicitud_items` VALUES (1,1,3,'Playera DTF unisex','Talla M y G · estampado frente y espalda',40.00,8400.00),(2,2,5,'Taza cerámica sublimada','Logo a dos tintas · caja individual',60.00,5700.00),(3,3,7,'Tarjetas Couché 300g','100 piezas por paquete · laminado mate',10.00,8500.00),(4,4,1,'Roll-up premium 85 × 200 cm','Acabado mate premium · estuche rígido',1.00,3850.00),(5,4,4,'Tote bag de manta','DTF full color · asa reforzada',25.00,2750.00),(6,5,2,'Lona Frontlit impresa','20 m² · acabado brillante',20.00,6400.00),(7,5,1,'Roll-up premium 85 × 200 cm','Estructura y estuche',1.00,3850.00),(8,6,4,'Tote bag de manta','Una cara · tinta magenta',25.00,2750.00),(9,6,6,'Sticker troquelado','8 × 8 cm · vinil brillante',100.00,3500.00);
/*!40000 ALTER TABLE `solicitud_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `solicitudes_cotizacion`
--

DROP TABLE IF EXISTS `solicitudes_cotizacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `solicitudes_cotizacion` (
  `id` int NOT NULL AUTO_INCREMENT,
  `folio` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre_cliente` varchar(140) COLLATE utf8mb4_unicode_ci NOT NULL,
  `empresa` varchar(140) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `correo` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telefono` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `segmento` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mensaje` text COLLATE utf8mb4_unicode_ci,
  `fecha_deseada` date DEFAULT NULL,
  `metodo_entrega` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `origen` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `atendido_por` int DEFAULT NULL,
  `creado_en` datetime NOT NULL,
  `actualizado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_solicitudes_cotizacion_folio` (`folio`),
  KEY `atendido_por` (`atendido_por`),
  KEY `ix_solicitudes_cotizacion_correo` (`correo`),
  KEY `ix_solicitudes_cotizacion_estado` (`estado`),
  CONSTRAINT `solicitudes_cotizacion_ibfk_1` FOREIGN KEY (`atendido_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `solicitudes_cotizacion`
--

LOCK TABLES `solicitudes_cotizacion` WRITE;
/*!40000 ALTER TABLE `solicitudes_cotizacion` DISABLE KEYS */;
INSERT INTO `solicitudes_cotizacion` VALUES (1,'SOL-2026-001','Luis Barrera','Estudio Nómada','luis@estudionomada.mx','55 2345 6789','pyme','Hola, me llegaron a recomendar su imprenta. Quiero cotizar 40 playeras negras estampadas al frente y espalda para el 25 de este mes. ¿Incluyen la playera?','2026-11-27','domicilio','nueva','web',NULL,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(2,'SOL-2026-002','Renata Solís','Café Origen','renata@cafeorigen.mx','55 3456 7890','eventos','Necesitamos 60 tazas sublimadas con nuestro logotipo para la apertura de sucursal. Adjunto el manual de marca.','2026-11-25','taller','nueva','web',NULL,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(3,'SOL-2026-003','Carla Domínguez','Papelería Lumen','carla@papelerialumen.mx','55 5678 9012','escolar','Cotizar 10 paquetes de tarjetas Couché 300g con laminado mate para el regreso a clases.','2026-12-04','domicilio','en-revision','web',NULL,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(4,'SOL-2026-004','Ana Torres','Alma Creativa','ana@almacreativa.mx','55 1234 5678','corporativo','Queremos un roll-up premium para el lobby y 25 tote bags para el equipo de marca.','2026-11-23','domicilio','cotizada','web',NULL,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(5,'SOL-2026-005','Sergio Nava','Grupo Altura','sergio@grupodigital.mx','55 4567 8901','corporativo','Lona Frontlit para fachada de 20 m² y un roll-up para el stand. Entrega en instalación.','2026-11-28','domicilio','convertida','web',NULL,'2026-11-17 05:52:23','2026-11-17 05:52:23'),(6,'SOL-2026-006','Mario Esquivel','Bistró Aurora','mario@bistroaurora.mx','55 6789 0123','eventos','25 tote bags y 100 stickers troquelados para nuestro aniversario.','2026-11-30','taller','convertida','web',NULL,'2026-11-17 05:52:23','2026-11-17 05:52:23');
/*!40000 ALTER TABLE `solicitudes_cotizacion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `correo` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telefono` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rol_id` int NOT NULL,
  `activo` tinyint(1) NOT NULL,
  `ultimo_acceso` datetime DEFAULT NULL,
  `creado_en` datetime NOT NULL,
  `actualizado_en` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_usuarios_correo` (`correo`),
  KEY `rol_id` (`rol_id`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (1,'Ana Torres','ana@llamma.mx','scrypt:32768:8:1$8JEpR9C1AGLcElEX$2b92a0302d5ff4ecf8f8432c877c8ea0a240cd7439bba51634919fb68cdaf6ac3dbaceeafc18d3979d8a86ac6515773b06747d64f6e4bb7c907de01746860d0e','55 1234 5678',1,1,'2026-11-17 07:12:01','2026-11-17 05:52:23','2026-11-17 07:12:01'),(2,'Diego Salas','diego@llamma.mx','scrypt:32768:8:1$gKUUXD6E1nof1Bd1$fb2d1ba82124ddf369229935d46907f31516ef6ca16b25f1a693bbcbf5f7fcb7c3031f65d97e42896ee4a4a6416e2fe2df94f37e81f13c84ce8a82910e1f176e','55 2345 6789',2,1,'2026-11-17 07:47:52','2026-11-17 05:52:23','2026-11-17 07:47:52'),(3,'Mariana Ruiz','mariana@llamma.mx','scrypt:32768:8:1$jTAHF3BUn1trCE1Y$dec8428c4eae529fff088a771c19eed78a9cee7e654f59a5eddf30db718a52f9fe5f6318336e6f29c1cfedf37b0717bd1cf03ba425f96a7ebdf7d93b2ca714c9','55 3456 7890',3,1,'2026-11-17 07:42:55','2026-11-17 05:52:23','2026-11-17 07:42:55'),(4,'Iván Córdoba','ivan@llamma.mx','scrypt:32768:8:1$C0IbDjg5UaZsaEpN$98113248e333dbd99c2d4787e87caa4d959f5031f6f46f37f2dc61c32d9542ec414c473d2c3a36e13a6c7d3bd3d7a25503234b75b6459e4a8c0664f0673523e4','55 4567 8901',4,1,'2026-11-17 06:30:27','2026-11-17 05:52:23','2026-11-17 06:30:27'),(5,'Paola Méndez','paola@llamma.mx','scrypt:32768:8:1$PiSLUgp3YUSMUKdN$bdf8da2d05e982c755d5f1bea37e5fb477a818487fd2b90b455ae0f17e9ea147b9000950f018c54d1474b327390425f1b381c4e0f2bb473ef30ba6738e906fdc','55 5678 9012',5,1,'2026-11-17 06:22:35','2026-11-17 05:52:23','2026-11-17 06:22:35');
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'llamma_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-17  1:49:17

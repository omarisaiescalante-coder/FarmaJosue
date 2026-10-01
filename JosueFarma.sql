-- ======================================================================
-- FARMACIA JOSUE - INSTALACION COMPLETA
-- ======================================================================
-- ATENCION: este archivo elimina todos los datos actuales de JosueFarma.

-- ======================================================================
-- 1. CREACION DE LA BASE DE DATOS
-- ======================================================================
DROP DATABASE IF EXISTS JosueFarma;
CREATE DATABASE JosueFarma CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE JosueFarma;

-- ======================================================================
-- 2. USUARIOS Y CATALOGOS
-- ======================================================================

-- USUARIOS
CREATE TABLE usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  identidad VARCHAR(20) UNIQUE,
  telefono VARCHAR(20),
  correo VARCHAR(150) UNIQUE,
  direccion VARCHAR(255),
  nombre_usuario VARCHAR(50) UNIQUE NOT NULL,
  contrasena VARCHAR(255) NOT NULL,
  rol ENUM('Administrador', 'Cajero') NOT NULL,
  estado ENUM('Activo', 'Inactivo') DEFAULT 'Activo',
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- DISTRIBUIDORES
CREATE TABLE distribuidores (
  id_distribuidor INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) UNIQUE NOT NULL,
  telefono VARCHAR(20),
  correo VARCHAR(150)
) ENGINE=InnoDB;

-- CLIENTES
CREATE TABLE clientes (
  id_cliente INT AUTO_INCREMENT PRIMARY KEY,
  dni VARCHAR(20) UNIQUE
) ENGINE=InnoDB;

-- MEDICAMENTOS
CREATE TABLE medicamentos (
  id_medicamento INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  nombre VARCHAR(150) UNIQUE NOT NULL,
  categoria VARCHAR(100),
  restriccion ENUM('Sin Receta Medica', 'Con Receta Medica') NOT NULL,
  laboratorio VARCHAR(150),
  stock_total INT DEFAULT 0,
  estado ENUM('Disponible', 'Agotado', 'Inactivo') DEFAULT 'Agotado',
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- MEDICAMENTO_PRESENTACIONES
CREATE TABLE medicamento_presentaciones (
  id_presentacion INT AUTO_INCREMENT PRIMARY KEY,
  id_medicamento INT NOT NULL,
  nombre_presentacion VARCHAR(150) NOT NULL,
  precio_venta DECIMAL(10, 2) NOT NULL,
  unidades_stock INT NOT NULL DEFAULT 1,
  UNIQUE (id_medicamento, nombre_presentacion),
  FOREIGN KEY (id_medicamento) REFERENCES medicamentos (id_medicamento)
) ENGINE=InnoDB;

-- ======================================================================
-- 3. COMPRAS E INVENTARIO
-- ======================================================================

-- COMPRAS
CREATE TABLE compras (
  id_compra INT AUTO_INCREMENT PRIMARY KEY,
  laboratorio VARCHAR(150),
  numero_factura VARCHAR(50) UNIQUE NOT NULL,
  id_usuario INT NOT NULL,
  id_distribuidor INT NOT NULL,
  fecha_compra DATE NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  metodo_pago ENUM('Efectivo', 'Tarjeta', 'Transferencia', 'Credito') NOT NULL,
  estado ENUM('A Credito', 'Cancelado') NOT NULL DEFAULT 'A Credito',
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  FOREIGN KEY (id_distribuidor) REFERENCES distribuidores (id_distribuidor)
) ENGINE=InnoDB;

-- LOTE
CREATE TABLE lote (
  id_lote INT AUTO_INCREMENT PRIMARY KEY,
  id_compra INT NULL,
  laboratorio VARCHAR(150),
  id_medicamento INT NOT NULL,
  numero_lote VARCHAR(50) UNIQUE NOT NULL,
  cantidad_inicial INT NOT NULL,
  cantidad_disponible INT NOT NULL,
  fecha_fabricacion DATE,
  fecha_vencimiento DATE NOT NULL,
  presentacion_ingreso VARCHAR(20) NOT NULL DEFAULT 'Unidad',
  contenido_caja VARCHAR(20),
  paquetes_por_caja INT,
  unidades_por_blister INT,
  cantidad_empaques INT,
  precio_empaque DECIMAL(10, 2),
  precio_venta DECIMAL(10, 2),
  precio_venta_contenido DECIMAL(10, 2),
  precio_venta_unidad DECIMAL(10, 2),
  costo_total DECIMAL(12, 2),
  estado ENUM('Disponible', 'Agotado', 'Vencido', 'Retirado') DEFAULT 'Disponible',
  fecha_ingreso DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_compra) REFERENCES compras (id_compra),
  FOREIGN KEY (id_medicamento) REFERENCES medicamentos (id_medicamento)
) ENGINE=InnoDB;

-- ======================================================================
-- 4. VENTAS Y DETALLES
-- ======================================================================

-- VENTAS
CREATE TABLE ventas (
  id_venta INT AUTO_INCREMENT PRIMARY KEY,
  numero_factura VARCHAR(50) UNIQUE NOT NULL,
  id_usuario INT NOT NULL,
  id_cliente INT NULL,
  fecha_venta DATETIME DEFAULT CURRENT_TIMESTAMP,
  subtotal DECIMAL(10, 2) NOT NULL,
  descuento DECIMAL(10, 2) DEFAULT 0,
  impuesto DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  metodo_pago ENUM('Efectivo', 'Tarjeta', 'Transferencia', 'Mixto') NOT NULL,
  monto_recibido DECIMAL(10, 2),
  cambio DECIMAL(10, 2) DEFAULT 0,
  estado ENUM('Completada', 'Anulada') DEFAULT 'Completada',
  requiere_receta BOOLEAN NOT NULL DEFAULT 0,
  FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente)
) ENGINE=InnoDB;

-- DETALLES_VENTA
CREATE TABLE detalles_venta (
  id_detalle_venta INT AUTO_INCREMENT PRIMARY KEY,
  id_venta INT NOT NULL,
  id_medicamento INT NOT NULL,
  id_presentacion INT NULL,
  presentacion VARCHAR(150) NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10, 2) NOT NULL,
  descuento DECIMAL(10, 2) DEFAULT 0,
  subtotal DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (id_venta) REFERENCES ventas (id_venta),
  FOREIGN KEY (id_medicamento) REFERENCES medicamentos (id_medicamento),
  FOREIGN KEY (id_presentacion) REFERENCES medicamento_presentaciones (id_presentacion)
) ENGINE=InnoDB;

-- DETALLE_VENTA_LOTES
CREATE TABLE detalle_venta_lotes (
  id_asignacion INT AUTO_INCREMENT PRIMARY KEY,
  id_detalle_venta INT NOT NULL,
  id_lote INT NOT NULL,
  cantidad_unidades INT NOT NULL,
  UNIQUE (id_detalle_venta, id_lote),
  FOREIGN KEY (id_detalle_venta) REFERENCES detalles_venta (id_detalle_venta) ON DELETE CASCADE,
  FOREIGN KEY (id_lote) REFERENCES lote (id_lote)
) ENGINE=InnoDB;

-- ======================================================================
-- 5. DATOS INICIALES
-- ======================================================================
-- Cuentas iniciales y una compra de ejemplo.
-- Las contrasenas se conservan como sal:hash.

-- USUARIOS
INSERT INTO usuarios (
    id_usuario,
    nombre,
    apellido,
    identidad,
    telefono,
    correo,
    direccion,
    nombre_usuario,
    contrasena,
    rol,
    estado
  )
VALUES
  (
    1,
    'Administrador',
    'Sistema',
    '0000-0000-00000',
    '0000-0000',
    'admin@farmacia.com',
    'Oficina Principal',
    'admin',
    '7621dd5f4ae9435fb7650536a20a211a:f07afc5c6d3b420ad123dfb0dce034a5769570e3891198d549424e7b11421df8b4480a536b17116acff70d12b66a9a5327cd803fb13148add140b3ded20e1bb1',
    'Administrador',
    'Activo'
  ),
  (
    2,
    'Omar',
    'Escalante',
    '0706-2007-00085',
    '8886-7344',
    'omar@farmacia.com',
    'Dirección de Omar',
    'Omar_Adm',
    '029031aa1dafbd79dd7ba82078dbea4d:c9d36064acbe7a7c2eb2f24bfc8bd6c9ed68f3484a671498101da2e04e630e13075dfe6ee7317677dfa589f20879ac036224a574a5bd7926ef70fe7dead44c2a',
    'Administrador',
    'Activo'
  );

-- DISTRIBUIDORES
INSERT INTO distribuidores (id_distribuidor, nombre, telefono, correo)
VALUES (1, 'Laboratorio de ejemplo', '9999-0001', 'compras@example.com');

-- MEDICAMENTOS
INSERT INTO medicamentos
  (id_medicamento, codigo, nombre, categoria, restriccion, laboratorio, stock_total, estado)
VALUES (1, 'MED-001', 'Paracetamol 500 mg', 'Analgésicos', 'Sin Receta Medica',
  'Laboratorio de ejemplo', 100, 'Disponible');

-- MEDICAMENTO_PRESENTACIONES
INSERT INTO medicamento_presentaciones
  (id_medicamento, nombre_presentacion, precio_venta, unidades_stock)
VALUES (1, 'Caja', 250.00, 100), (1, 'Blister', 28.00, 10), (1, 'Unidad', 3.00, 1);

-- COMPRAS
INSERT INTO compras
  (id_compra, laboratorio, numero_factura, id_usuario, id_distribuidor, fecha_compra, total, metodo_pago, estado)
VALUES (1, 'Laboratorio de ejemplo', 'COM-0001', 1, 1, '2026-09-25', 200.00, 'Efectivo', 'Cancelado');

-- LOTE
INSERT INTO lote
  (id_lote, laboratorio, id_medicamento, numero_lote, cantidad_inicial, cantidad_disponible,
   fecha_fabricacion, fecha_vencimiento, presentacion_ingreso, contenido_caja,
   paquetes_por_caja, unidades_por_blister, cantidad_empaques, precio_empaque,
   precio_venta, precio_venta_contenido, precio_venta_unidad, costo_total, estado, id_compra)
VALUES (1, 'Laboratorio de ejemplo', 1, 'LOT-000001', 100, 100, '2026-01-01', '2028-01-01',
  'Caja', 'Blister', 10, 10, 1, 200.00, 250.00, 28.00, 3.00, 200.00, 'Disponible', 1);


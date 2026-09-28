-- Esquema actual: usuarios, medicamentos, presentaciones, distribuidores, compras y lotes.
-- Ejecutar todo el archivo después de eliminar la base anterior.
-- Si aún no la eliminaste, esta línea permite hacerlo al quitar los dos guiones.
-- ATENCIÓN: DROP DATABASE elimina todos los datos actuales.
-- DROP DATABASE IF EXISTS JosueFarma;
-- Crea la base utilizada por database.js; USE selecciona la base de trabajo.
CREATE DATABASE JosueFarma;

use JosueFarma;

-- ----------------------------------------------------------------------
-- AUTO_INCREMENT genera IDs; UNIQUE evita duplicados; ENUM limita rol y estado.
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
);

-- ----------------------------------------------------------------------
-- --------------------------------------------------------------------
-- Catálogo general de medicamentos y sus existencias principales.
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
);

-- --------------------------------------------------------------------
-- Presentaciones de venta asociadas a cada medicamento.
CREATE TABLE Medicamento_presentaciones (
  id_presentacion INT AUTO_INCREMENT PRIMARY KEY,
  id_medicamento INT NOT NULL,
  nombre_presentacion VARCHAR(150) NOT NULL,
  precio_venta DECIMAL(10, 2) NOT NULL,
  unidades_stock INT NOT NULL DEFAULT 1,
  UNIQUE (id_medicamento, nombre_presentacion),
  FOREIGN KEY (id_medicamento) REFERENCES medicamentos (id_medicamento)
);

-- --------------------------------------------------------------------
-- Lotes recibidos: vencimiento, cantidades y costos de inventario.
CREATE TABLE Lote (
  id_lote INT AUTO_INCREMENT PRIMARY KEY,
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
  FOREIGN KEY (id_medicamento) REFERENCES medicamentos (id_medicamento)
);

-- -------------------------------------------------------------------
-- Proveedores o laboratorios que suministran los medicamentos.
CREATE TABLE Distribuidores (
  id_distribuidor INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) UNIQUE NOT NULL,
  telefono VARCHAR(20),
  correo VARCHAR(150)
);

-- Encabezado de las compras realizadas a distribuidores.
CREATE TABLE Compras (
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
);

-- -------------------------------------------------------------------
-- Relación entre los lotes y la compra que los originó.
ALTER TABLE Lote
ADD COLUMN id_compra INT NULL,
ADD FOREIGN KEY (id_compra) REFERENCES compras (id_compra);

USE JosueFarma;

-- Inserción de un usuario Administrador por defecto
-- Cuentas iniciales: las claves se guardan como sal:hash para verificarlas al iniciar sesión.
INSERT INTO
  usuarios (
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

-- Ejemplo consistente con el flujo actual: compra de una caja de 100 pastillas.
INSERT INTO medicamentos
  (id_medicamento, codigo, nombre, categoria, restriccion, laboratorio, stock_total, estado)
VALUES (1, 'MED-001', 'Paracetamol 500 mg', 'Analgésicos', 'Sin Receta Medica',
  'Laboratorio de ejemplo', 100, 'Disponible');

-- Los precios por caja, blíster y pastilla se registran desde el ingreso del lote.
INSERT INTO Medicamento_presentaciones
  (id_medicamento, nombre_presentacion, precio_venta, unidades_stock)
VALUES (1, 'Caja', 250.00, 100), (1, 'Blister', 28.00, 10), (1, 'Unidad', 3.00, 1);

INSERT INTO Distribuidores (id_distribuidor, nombre, telefono, correo)
VALUES (1, 'Laboratorio de ejemplo', '9999-0001', 'compras@example.com');

INSERT INTO Compras
  (id_compra, laboratorio, numero_factura, id_usuario, id_distribuidor, fecha_compra, total, metodo_pago, estado)
VALUES (1, 'Laboratorio de ejemplo', 'COM-0001', 1, 1, '2026-09-25', 200.00, 'Efectivo', 'Cancelado');

INSERT INTO Lote
  (id_lote, laboratorio, id_medicamento, numero_lote, cantidad_inicial, cantidad_disponible,
   fecha_fabricacion, fecha_vencimiento, presentacion_ingreso, contenido_caja,
   paquetes_por_caja, unidades_por_blister, cantidad_empaques, precio_empaque,
   precio_venta, precio_venta_contenido, precio_venta_unidad, costo_total, estado, id_compra)
VALUES (1, 'Laboratorio de ejemplo', 1, 'LOT-000001', 100, 100, '2026-01-01', '2028-01-01',
  'Caja', 'Blister', 10, 10, 1, 200.00, 250.00, 28.00, 3.00, 200.00, 'Disponible', 1);

-- Base completa: 9 tablas, relaciones, 2 usuarios y 1 ejemplo por tabla restante.
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
  descripcion VARCHAR(255),
  categoria VARCHAR(100),
  presentacion VARCHAR(150),
  precio_compra DECIMAL(10, 2) NOT NULL,
  precio_venta DECIMAL(10, 2) NOT NULL,
  stock_total INT DEFAULT 0,
  stock_minimo INT DEFAULT 5,
  restriccion ENUM('Sin Receta Medica', 'Con Receta Medica') NOT NULL,
  laboratorio VARCHAR(150),
  forma_venta ENUM(
    'Caja',
    'Unidad',
    'Frasco',
    'Blister',
    'Sobre',
    'Ampolla',
    'Suero'
  ) NOT NULL,
  estado ENUM('Disponible', 'Agotado', 'Inactivo') DEFAULT 'Disponible',
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
  estado ENUM('Activa', 'Inactiva') DEFAULT 'Activa',
  UNIQUE (id_medicamento, nombre_presentacion),
  FOREIGN KEY (id_medicamento) REFERENCES medicamentos (id_medicamento)
);

-- --------------------------------------------------------------------
-- Lotes recibidos: vencimiento, cantidades y costos de inventario.
CREATE TABLE Lote (
  id_lote INT AUTO_INCREMENT PRIMARY KEY,
  id_medicamento INT NOT NULL,
  numero_lote VARCHAR(50) UNIQUE NOT NULL,
  cantidad_inicial INT NOT NULL,
  cantidad_disponible INT NOT NULL,
  fecha_fabricacion DATE,
  fecha_vencimiento DATE NOT NULL,
  precio_compra DECIMAL(10, 2),
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
  correo VARCHAR(150),
  direccion VARCHAR(255)
);

-- Encabezado de las compras realizadas a distribuidores.
CREATE TABLE Compras (
  id_compra INT AUTO_INCREMENT PRIMARY KEY,
  numero_factura VARCHAR(50) UNIQUE NOT NULL,
  id_usuario INT NOT NULL,
  id_medicamento INT NULL,
  id_distribuidor INT NOT NULL,
  fecha_compra DATE NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  metodo_pago ENUM('Efectivo', 'Tarjeta', 'Transferencia', 'Credito') NOT NULL,
  estado ENUM('A Credito', 'Cancelado') NOT NULL DEFAULT 'A Credito',
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  FOREIGN KEY (id_medicamento) REFERENCES medicamentos (id_medicamento),
  FOREIGN KEY (id_distribuidor) REFERENCES distribuidores (id_distribuidor)
);

-- -------------------------------------------------------------------
-- Relación entre los lotes y la compra que los originó.
ALTER TABLE Lote
ADD COLUMN id_compra INT NULL,
ADD FOREIGN KEY (id_compra) REFERENCES compras (id_compra);

-- -------------------------------------------------------------------
-- Encabezado de cada venta, sus montos y el cliente atendido.
CREATE TABLE Ventas (
  id_venta INT AUTO_INCREMENT PRIMARY KEY,
  numero_factura VARCHAR(30) UNIQUE NOT NULL,
  id_usuario INT NOT NULL,
  fecha_venta DATETIME DEFAULT CURRENT_TIMESTAMP,
  subtotal DECIMAL(10, 2) NOT NULL,
  descuento DECIMAL(10, 2) DEFAULT 0.00,
  impuesto DECIMAL(10, 2) DEFAULT 0.00,
  total DECIMAL(10, 2) NOT NULL,
  metodo_pago ENUM('Efectivo', 'Tarjeta', 'Transferencia', 'Mixto') NOT NULL,
  monto_recibido DECIMAL(10, 2),
  cambio DECIMAL(10, 2) DEFAULT 0.00,
  estado ENUM('Completada', 'Anulada') DEFAULT 'Completada',
  FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
);

-- --------------------------------------------------------------------
-- Productos y cantidades que componen cada venta.
CREATE TABLE Detalles_venta (
  id_detalle_venta INT AUTO_INCREMENT PRIMARY KEY,
  id_venta INT NOT NULL,
  id_medicamento INT NOT NULL,
  id_presentacion INT,
  presentacion VARCHAR(150) NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10, 2) NOT NULL,
  descuento DECIMAL(10, 2) DEFAULT 0.00,
  subtotal DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (id_venta) REFERENCES ventas (id_venta),
  FOREIGN KEY (id_medicamento) REFERENCES medicamentos (id_medicamento),
  FOREIGN KEY (id_presentacion) REFERENCES medicamento_presentaciones (id_presentacion)
);

-- Lotes utilizados por cada detalle de venta. Permite salida FEFO y devoluciones.
CREATE TABLE Detalle_Venta_Lotes (
  id_asignacion INT AUTO_INCREMENT PRIMARY KEY,
  id_detalle_venta INT NOT NULL,
  id_lote INT NOT NULL,
  cantidad_unidades INT NOT NULL,
  UNIQUE (id_detalle_venta, id_lote),
  FOREIGN KEY (id_detalle_venta) REFERENCES detalles_venta (id_detalle_venta) ON DELETE CASCADE,
  FOREIGN KEY (id_lote) REFERENCES lote (id_lote)
);

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

-- Medicamento con 98 unidades restantes: compra de 100 y venta de 2.
INSERT INTO
  medicamentos (
    id_medicamento,
    codigo,
    nombre,
    descripcion,
    categoria,
    presentacion,
    precio_compra,
    precio_venta,
    stock_total,
    stock_minimo,
    restriccion,
    laboratorio,
    forma_venta,
    estado
  )
VALUES
  (
    1,
    'MED-001',
    'Paracetamol 500 mg',
    'Medicamento de ejemplo para el inventario',
    'Analgésicos',
    'Tableta individual',
    2.00,
    3.00,
    98,
    10,
    'Sin Receta Medica',
    'Laboratorio de ejemplo',
    'Unidad',
    'Disponible'
  );

-- Presentación del medicamento 1: una tableta equivale a una unidad de stock.
INSERT INTO
  Medicamento_presentaciones (
    id_presentacion,
    id_medicamento,
    nombre_presentacion,
    precio_venta,
    unidades_stock,
    estado
  )
VALUES
  (1, 1, 'Tableta individual', 3.00, 1, 'Activa');

-- Proveedor de ejemplo que se relaciona con la compra 1.
INSERT INTO
  Distribuidores (
    id_distribuidor,
    nombre,
    telefono,
    correo,
    direccion
  )
VALUES
  (
    1,
    'Distribuidora de ejemplo',
    '9999-0001',
    'ventas@example.com',
    'Danlí, El Paraíso'
  );

-- Compra pagada de 100 unidades a 2.00: total 200.00.
INSERT INTO
  Compras (
    id_compra,
    numero_factura,
    id_usuario,
    id_medicamento,
    id_distribuidor,
    fecha_compra,
    total,
    metodo_pago,
    estado
  )
VALUES
  (
    1,
    'COMP-001',
    1,
    1,
    1,
    '2026-09-25',
    200.00,
    'Efectivo',
    'Cancelado'
  );

-- Lote de la compra 1 con sus fechas y las 98 unidades restantes.
INSERT INTO
  Lote (
    id_lote,
    id_medicamento,
    numero_lote,
    cantidad_inicial,
    cantidad_disponible,
    fecha_fabricacion,
    fecha_vencimiento,
    precio_compra,
    costo_total,
    estado,
    id_compra
  )
VALUES
  (
    1,
    1,
    'LOT-001',
    100,
    98,
    '2026-01-01',
    '2028-01-01',
    2.00,
    200.00,
    'Disponible',
    1
  );

-- Venta por 6.00: se reciben 10.00 y se devuelven 4.00 de cambio.
INSERT INTO
  Ventas (
    id_venta,
    numero_factura,
    id_usuario,
    fecha_venta,
    subtotal,
    descuento,
    impuesto,
    total,
    metodo_pago,
    monto_recibido,
    cambio,
    estado
  )
VALUES
  (
    1,
    'VENT-001',
    1,
    '2026-09-26 10:00:00',
    6.00,
    0.00,
    0.00,
    6.00,
    'Efectivo',
    10.00,
    4.00,
    'Completada'
  );

-- Producto y presentación de la venta 1: dos unidades a 3.00.
INSERT INTO
  Detalles_venta (
    id_detalle_venta,
    id_venta,
    id_medicamento,
    id_presentacion,
    presentacion,
    cantidad,
    precio_unitario,
    descuento,
    subtotal
  )
VALUES
  (
    1,
    1,
    1,
    1,
    'Tableta individual',
    2,
    3.00,
    0.00,
    6.00
  );

-- Relaciona el detalle 1 con el lote 1 del que salieron dos unidades.
INSERT INTO
  Detalle_Venta_Lotes (
    id_asignacion,
    id_detalle_venta,
    id_lote,
    cantidad_unidades
  )
VALUES
  (1, 1, 1, 2);

;

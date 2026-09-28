# Base de datos del flujo actual

El sistema conserva seis tablas:

| Tabla | Datos que conserva |
| --- | --- |
| usuarios | Acceso y administración de usuarios existentes. |
| medicamentos | Código, nombre, categoría, restricción, laboratorio, existencias, estado y fecha de registro. |
| medicamento_presentaciones | Precios ingresados por caja, blíster, pastilla, sobre, frasco, ampolla o suero; equivalencia en unidades. |
| distribuidores | Nombre del laboratorio/proveedor, teléfono y correo. |
| compras | Factura, usuario, proveedor, laboratorio, fecha, total, método de pago y condición. |
| lote | Compra y medicamento asociados, número, laboratorio, cantidades, fechas, empaque, contenido de caja y precios registrados. |

Los identificadores y fechas automáticas son controles internos; no requieren campos de entrada.
El laboratorio se captura en Compras y se copia a medicamentos y lotes.
Una compra admite varios medicamentos mediante sus lotes: no guarda un medicamento único en su encabezado.

Los precios de venta por presentación se conservan porque ya se ingresan en Compras, aunque todavía no exista un módulo de ventas.
Los precios del lote documentan ese ingreso; medicamento_presentaciones conserva los últimos precios registrados por presentación.
El costo de compra por unidad se calcula al consultar el lote, dividiendo su costo total entre su cantidad inicial.
La cantidad disponible y el stock se conservan para no alterar las existencias actuales.

Se retiraron las tres tablas de ventas y los campos heredados de descripción, stock mínimo,
precios y presentación generales del medicamento, estado de presentación, medicamento único de compra,
costo unitario duplicado de lote y dirección del proveedor.

Para una instalación nueva, usar JosueFarma.sql. Sus ejemplos solo representan compras.
Para actualizar la base existente, cerrar la aplicación y ejecutar `node limpiar-esquema.js`.
La limpieza genera previamente un respaldo SQL en `respaldos/`, incluyendo las tablas y columnas que retira.
El respaldo se puede importar en una base vacía seleccionada con `USE` para recuperar los datos anteriores.

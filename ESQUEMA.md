# Base de datos del sistema

El sistema utiliza once tablas: usuarios, medicamentos, medicamento_presentaciones,
distribuidores, compras, lote, lote_ediciones, clientes, ventas, detalles_venta y detalle_venta_lotes.

Para una base existente, cerrar la aplicacion y ejecutar npm run migrar.
El comando guarda primero un respaldo SQL en respaldos/ y agrega los campos y tablas
faltantes sin eliminar registros ni columnas historicas. Se puede ejecutar nuevamente.
El respaldo se restaura en una base vacia seleccionada previamente con USE.
limpiar-esquema.js redirige a esta misma actualizacion y ya no elimina ventas.

Para reiniciar la base, ejecutar JosueFarma.sql completo: elimina los datos actuales,
crea las once tablas e inserta los datos iniciales. Es el unico archivo de instalacion.
La migracion lee de ese archivo solo las definiciones necesarias de tablas;
no ejecuta la eliminacion de la base ni las inserciones iniciales.

Compras convierte cajas y empaques a unidades de inventario y registra los precios
por presentacion. Ventas valida la sesion activa, la receta y las existencias dentro
de una transaccion; descuenta primero los lotes vigentes de menor vencimiento y
conserva la relacion entre cada detalle y sus lotes. Facturas consulta las ventas
registradas, incluidas las historicas sin cliente, y permite imprimirlas.
Los detalles conservan la presentacion y el precio cobrado al vender.

Los lotes nuevos guardan tipo_medicamento y modalidad_venta (Caja o Caja y unidad).
cantidad_empaques indica las cajas recibidas; cantidad_disponible conserva unidades
internas según paquetes_por_caja y unidades_por_blister. Los precios de compra
adicionales se guardan en precio_compra_contenido y precio_compra_unidad.
medicamento_presentaciones.id_lote relaciona cada precio y equivalencia con su lote;
Ventas solo ofrece las presentaciones registradas de lotes vigentes y descuenta
el lote seleccionado. Los registros anteriores conservan id_lote nulo y su flujo
de descuento por vencimiento, sin consumir los lotes de la modalidad nueva.
La restriccion de receta medica sigue siendo independiente de modalidad_venta.
Ejecutar npm run test:modalidades verifica los ocho escenarios contra MySQL en
transacciones que se revierten, sin conservar compras ni ventas de prueba.

El detalle del Inventario de Lotes permite editar cada lote dentro de su tarjeta.
nombre_medicamento es un nombre local del lote y no renombra los demás lotes.
razon_edicion y fecha_edicion conservan el motivo y la fecha de la última edición;
lote_ediciones conserva cada nueva edición y permite elegir su fecha para consultar
el motivo. La migración incorpora la última edición de los registros anteriores;
las ediciones previas que no fueron almacenadas no pueden recuperarse.
revision evita sobrescribir una edición que otra ventana haya guardado.
Los cambios recalculan el total de la compra y el stock, conservando las unidades
ya vendidas. Las presentaciones que dejan de estar habilitadas se marcan Inactiva
para conservar las referencias de ventas anteriores.

La pantalla de ventas utiliza venta-pantallas.js. ventas.js es un archivo de
compatibilidad sin logica duplicada. Las operaciones IPC se registran en main.js.

Pruebas:
- npm test: servicios y conexion entre HTML, puente y controladores.
- npm run test:db: flujo completo en una base temporal aislada de MySQL.
- npm run test:ui: pantallas en ventanas ocultas de Electron.

No ejecutar compras-ui.test.cjs directamente con Node: requiere Electron.

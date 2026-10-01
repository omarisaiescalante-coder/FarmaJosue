# Base de datos del sistema

El sistema utiliza diez tablas: usuarios, medicamentos, medicamento_presentaciones,
distribuidores, compras, lote, clientes, ventas, detalles_venta y detalle_venta_lotes.

Para una base existente, cerrar la aplicacion y ejecutar npm run migrar.
El comando guarda primero un respaldo SQL en respaldos/ y agrega los campos y tablas
faltantes sin eliminar registros ni columnas historicas. Se puede ejecutar nuevamente.
El respaldo se restaura en una base vacia seleccionada previamente con USE.
limpiar-esquema.js redirige a esta misma actualizacion y ya no elimina ventas.

Para reiniciar la base, ejecutar JosueFarma.sql completo: elimina los datos actuales,
crea las diez tablas e inserta los datos iniciales. Es el unico archivo de instalacion.
La migracion lee de ese archivo solo las definiciones necesarias de tablas;
no ejecuta la eliminacion de la base ni las inserciones iniciales.

Compras convierte cajas y empaques a unidades de inventario y registra los precios
por presentacion. Ventas valida la sesion activa, la receta y las existencias dentro
de una transaccion; descuenta primero los lotes vigentes de menor vencimiento y
conserva la relacion entre cada detalle y sus lotes. Facturas consulta las ventas
registradas, incluidas las historicas sin cliente, y permite imprimirlas.
Los detalles conservan la presentacion y el precio cobrado al vender.

La pantalla de ventas utiliza venta-pantallas.js. ventas.js es un archivo de
compatibilidad sin logica duplicada. Las operaciones IPC se registran en main.js.

Pruebas:
- npm test: servicios y conexion entre HTML, puente y controladores.
- npm run test:db: flujo completo en una base temporal aislada de MySQL.
- npm run test:ui: pantallas en ventanas ocultas de Electron.

No ejecutar compras-ui.test.cjs directamente con Node: requiere Electron.

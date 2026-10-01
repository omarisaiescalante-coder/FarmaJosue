// Verifica el SQL y el servicio en una base temporal aislada; nunca modifica JosueFarma.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const configurada = require('./database');
const servicio = require('./compras-servicio');
async function probar() {
    const origen = configurada.pool.config.connectionConfig;
    const opciones = { host: origen.host, port: origen.port, user: origen.user, password: origen.password };
    const nombre = `farma_prueba_esquema_${Date.now()}`;
    const admin = await mysql.createConnection({ ...opciones, multipleStatements: true });
    let temporal;
    let creada = false;
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'JosueFarma.sql'), 'utf8').replace(/JosueFarma/g, nombre);
        await admin.query(sql);
        creada = true;
        temporal = mysql.createPool({ ...opciones, database: nombre });
        const [tablas] = await temporal.query('SHOW TABLES');
        assert.equal(tablas.length, 10);
        assert(tablas.some(t => Object.values(t)[0].toLowerCase() === 'ventas'));
        const sesion = { id_usuario: 1 };
        const nuevo = await servicio.registrarMedicamento(temporal, sesion, {
            nombre: 'Medicamento de prueba', laboratorio: 'Laboratorio prueba', categoria: 'Prueba', restriccion: 'Sin Receta Medica',
        });
        await servicio.guardar(temporal, sesion, {
            id_distribuidor: 'Laboratorio prueba', telefono_distribuidor: '9999-9999', correo_distribuidor: 'prueba@example.com',
            fecha_compra: '2026-01-01', metodo_pago: 'Efectivo', estado: 'Cancelado',
            lotes: [{ id_medicamento: nuevo.id_medicamento, numero_lote: 'PRUEBA-CAJA', cantidad: 2,
                presentacion_ingreso: 'Caja', contenido_caja: 'Blister', paquetes_por_caja: 3, unidades_por_blister: 10,
                precio: 60, precio_venta: 90, precio_venta_contenido: 35, precio_venta_unidad: 4,
                fecha_fabricacion: '2025-01-01', fecha_vencimiento: '2099-01-01' }],
        });
        const datos = await servicio.cargar(temporal, sesion);
        const medicamento = datos.medicamentos.find(m => m.id_medicamento === nuevo.id_medicamento);
        assert.equal(medicamento.stock_total, 60);
        assert.equal(medicamento.forma_venta, 'Caja');
        assert.equal(Number(medicamento.precio_venta), 90);
        const lotes = await servicio.lotes(temporal, sesion, datos.compras[0].id_compra);
        assert.equal(Number(lotes[0].precio_compra), 2);
        assert.equal(Number(lotes[0].costo_total), 120);
        assert.equal(lotes[0].laboratorio, 'Laboratorio prueba');
        const [precios] = await temporal.execute('SELECT * FROM medicamento_presentaciones WHERE id_medicamento = ?', [nuevo.id_medicamento]);
        assert.equal(precios.length, 3);
        const ventas = require('./ventas-servicios');
        const meds = require('./medicamentos-servicio');
        const presentacion = precios.find(p => p.nombre_presentacion === 'Unidad');
        const caja = precios.find(p => p.nombre_presentacion === 'Caja');
        const vender = items => ventas.guardar(temporal, sesion, { dni: 'PRUEBA-DNI', metodo_pago: 'Efectivo', items });
        await assert.rejects(vender([{ id_presentacion: caja.id_presentacion, cantidad: 2 }, { id_presentacion: presentacion.id_presentacion, cantidad: 1 }]), /Stock insuficiente/);
        const altaVenta = await vender([{ id_presentacion: presentacion.id_presentacion, cantidad: 5 }]);
        const factura = await ventas.factura(temporal, sesion, altaVenta.id_venta);
        assert.equal(factura.venta.numero_factura, altaVenta.numero_factura);
        assert.equal(Number(factura.venta.total), 20);
        assert.equal(factura.venta.dni_cliente, 'PRUEBA-DNI');
        assert.equal(factura.detalle[0].cantidad, 5);
        assert.equal(factura.detalle[0].nombre_presentacion, 'Unidad');
        const [[stock]] = await temporal.query('SELECT stock_total FROM medicamentos WHERE id_medicamento = ?', [nuevo.id_medicamento]);
        assert.equal(stock.stock_total, 55);
        const [[asignacion]] = await temporal.query('SELECT SUM(cantidad_unidades) AS unidades FROM detalle_venta_lotes');
        assert.equal(Number(asignacion.unidades), 5);
        await meds.actualizar(temporal, sesion, { id: nuevo.id_medicamento, nombre: 'Prueba editada', categoria: 'Prueba', restriccion: 'Con Receta Medica' });
        assert((await meds.listar(temporal, sesion)).some(m => m.nombre === 'Prueba editada' && m.precios.includes('Unidad')));
        assert.equal((await meds.lotes(temporal, sesion, nuevo.id_medicamento))[0].cantidad_disponible, 55);
        await assert.rejects(ventas.guardar(temporal, sesion, { metodo_pago: 'Efectivo', items: [{ id_presentacion: presentacion.id_presentacion, cantidad: 1 }] }), /DNI/);
        await temporal.query("UPDATE lote SET fecha_vencimiento = '2000-01-01' WHERE id_medicamento = ?", [nuevo.id_medicamento]);
        await assert.rejects(vender([{ id_presentacion: presentacion.id_presentacion, cantidad: 1 }]), /lotes vigentes/);
        assert.equal((await ventas.listar(temporal, sesion)).length, 1);
        assert.equal((await meds.lotes(temporal, sesion, nuevo.id_medicamento))[0].cantidad_disponible, 55);
        // Reproduce una base instalada anterior y comprueba que migrar conserva su venta.
        const [fk] = await temporal.query("SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ventas' AND COLUMN_NAME = 'id_cliente' AND REFERENCED_TABLE_NAME IS NOT NULL");
        await temporal.query('ALTER TABLE ventas DROP FOREIGN KEY ' + temporal.escapeId(fk[0].CONSTRAINT_NAME));
        await temporal.query('ALTER TABLE ventas DROP COLUMN id_cliente, DROP COLUMN requiere_receta');
        await temporal.query('ALTER TABLE lote DROP COLUMN precio_venta, DROP COLUMN presentacion_ingreso');
        const { actualizar } = require('./actualizar-esquema');
        await temporal.query("ALTER TABLE medicamentos ADD COLUMN precio_compra DECIMAL(10,2) NOT NULL DEFAULT 0, ADD COLUMN precio_venta DECIMAL(10,2) NOT NULL DEFAULT 0, ADD COLUMN forma_venta ENUM('Caja','Unidad') NOT NULL DEFAULT 'Unidad'");
        await temporal.query('ALTER TABLE medicamentos ALTER COLUMN precio_compra DROP DEFAULT, ALTER COLUMN precio_venta DROP DEFAULT, ALTER COLUMN forma_venta DROP DEFAULT');
        await actualizar(temporal, { respaldo: false });
        await actualizar(temporal, { respaldo: false });
        const altaMigrada = await servicio.registrarMedicamento(temporal, sesion, {
            nombre: 'Alta posterior a migracion', laboratorio: 'Laboratorio prueba', categoria: 'Prueba', restriccion: 'Sin Receta Medica',
        });
        assert(altaMigrada.id_medicamento > 0);
        const [[heredados]] = await temporal.query('SELECT precio_compra, precio_venta, forma_venta FROM medicamentos WHERE id_medicamento = ?', [nuevo.id_medicamento]);
        assert.equal(Number(heredados.precio_compra), 0);
        assert.equal(Number(heredados.precio_venta), 0);
        assert.equal(heredados.forma_venta, 'Unidad');
        const historica = await ventas.factura(temporal, sesion, altaVenta.id_venta);
        assert.equal(Number(historica.venta.total), 20);
        assert.equal(historica.venta.dni_cliente, null);
        console.log('Ventas verificadas: factura, stock, lotes, receta, rollback y migración repetible con conservación de ventas.');
        console.log('SQL y servicio verificados en MySQL aislado: diez tablas, alta de medicamento, compra, precios, stock y consulta de lotes.');
    } finally {
        if (temporal) await temporal.end();
        if (creada && /^farma_prueba_esquema_\d+$/.test(nombre)) await admin.query(`DROP DATABASE ${admin.escapeId(nombre)}`);
        await admin.end();
    }
}
probar().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => configurada.end());

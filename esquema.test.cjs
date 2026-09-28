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
        assert.equal(tablas.length, 6);
        assert(!tablas.some(t => Object.values(t)[0].toLowerCase().includes('venta')));
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
        console.log('SQL y servicio verificados en MySQL aislado: seis tablas, alta de medicamento, compra, precios, stock y consulta de lotes.');
    } finally {
        if (temporal) await temporal.end();
        if (creada && /^farma_prueba_esquema_\d+$/.test(nombre)) await admin.query(`DROP DATABASE ${admin.escapeId(nombre)}`);
        await admin.end();
    }
}
probar().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => configurada.end());

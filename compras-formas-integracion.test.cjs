// Prueba real de compra, venta y edición. Todos los datos se revierten.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const db = require('./database');
const compras = require('./compras-servicio');
const ventas = require('./ventas-servicios');
const { textoStockEmpaque } = require('./stock-empaques');
(async () => {
    const conn = await db.getConnection();
    try {
        const [[usuario]] = await conn.query("SELECT id_usuario FROM usuarios WHERE rol = 'Administrador' AND estado = 'Activo' LIMIT 1");
        assert(usuario);
        const proxy = { execute: (...a) => conn.execute(...a), query: (...a) => conn.query(...a),
            getConnection: async () => ({ execute: (...a) => conn.execute(...a), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {} }) };
        for (const formas of [['Caja'], ['Unidad'], ['Blister'], ['Caja', 'Unidad'], ['Blister', 'Unidad'], ['Caja', 'Blister', 'Unidad']]) {
            await conn.beginTransaction();
            const token = randomUUID();
            const [med] = await conn.execute("INSERT INTO medicamentos (codigo,nombre,laboratorio,restriccion,estado,stock_total) VALUES (?,?,'Prueba','Sin Receta Medica','Agotado',0)", [token.slice(0, 20), token]);
            const hoy = new Date().toLocaleDateString('en-CA');
            const datos = { tipo_medicamento: 'Pastilla', presentacion_ingreso: 'Caja', paquetes_por_caja: 5, unidades_por_blister: 10,
                cajas_por_paquete: 2, blisteres_por_paquete: 10, unidades_por_paquete: 100, cantidad: 2, precio: 100, formas_venta: formas.map(nombre => ({ nombre, cantidad: { Caja: 2, Blister: 5, Unidad: 10 }[nombre], precio: { Caja: 200, Blister: 40, Unidad: 4 }[nombre] })) };
            await compras.guardar(proxy, usuario, { id_distribuidor: token, telefono_distribuidor: '9999-9999', correo_distribuidor: 'test@example.com', fecha_compra: hoy,
                metodo_pago: 'Transferencia', estado: 'Cancelado', lotes: [{ ...datos, id_medicamento: med.insertId, numero_lote: token, fecha_fabricacion: '2020-01-01', fecha_vencimiento: '2099-01-01' }] });
            let catalogo = await ventas.cargar(proxy, usuario);
            const pres = catalogo.presentaciones.filter(p => p.id_medicamento === med.insertId);
            assert.deepEqual(pres.map(p => p.nombre_presentacion).sort(), [...formas].sort());
            const id = pres[0].id_lote;
            assert.equal(textoStockEmpaque(pres[0]), 'Caja = 4 · Blíster = 20 · Unidad = 200');
            await ventas.guardar(proxy, usuario, { metodo_pago: 'Transferencia', items: [{ id_presentacion: pres[0].id_presentacion, cantidad: 1 }] });
            const reporte = await compras.reporte(proxy, usuario, { desde: hoy, hasta: hoy });
            const bloque = reporte.bloques.find(b => b.lotes.some(l => l.id_lote === id));
            assert(bloque, 'El reporte incluye la compra de ambos extremos del rango');
            assert.equal(bloque.subtotalCentavos, 20000);
            const linea = bloque.lotes.find(l => l.id_lote === id);
            assert.equal(linea.costoCentavos, 20000);
            const inicial = 200;
            assert.equal(linea.cantidad, inicial / (linea.forma === 'Caja' ? 50 : linea.forma === 'Blíster' ? 10 : 1), 'El reporte mantiene el stock adquirido después de vender');
            const [[creacion]] = await conn.execute("SELECT DATE_FORMAT(fecha_ingreso, '%Y-%m-%d') AS fecha FROM lote WHERE id_lote = ?", [id]);
            const reporteLotes = await compras.reporteLotes(proxy, usuario, {desde: creacion.fecha, hasta: creacion.fecha});
            const vendido = reporteLotes.medicamentos.find(m => m.id_medicamento === med.insertId);
            assert.equal(vendido.unidades_vendidas, Number(pres[0].unidades_stock));
            const stockLote = reporteLotes.lotes.find(l => l.id_lote === id);
            assert(stockLote);
            assert.equal(stockLote.unidades, formas.includes('Unidad') ? 200 - Number(pres[0].unidades_stock) : null);
            const cambios = { ...datos, id_lote: id, revision: 0, nombre: token, razon_edicion: 'Cambiar las formas de venta', formas_venta: [{ nombre: 'Unidad', precio: 5, cantidad: 10 }] };
            await compras.editarLote(proxy, usuario, cambios);
            const [[lote]] = await conn.execute('SELECT * FROM lote WHERE id_lote = ?', [id]);
            assert.equal(lote.cantidad_disponible, 200 - pres[0].unidades_stock);
            assert.equal(lote.precio_venta, null);
            assert.equal(lote.precio_venta_contenido, null);
            assert.equal(lote.precio_compra_contenido, null);
            assert.equal(lote.precio_compra_unidad, null);
            assert.equal(Number(lote.precio_venta_unidad), 5);
            catalogo = await ventas.cargar(proxy, usuario);
            assert.deepEqual(catalogo.presentaciones.filter(p => p.id_medicamento === med.insertId).map(p => p.nombre_presentacion), ['Unidad']);
            const [[stock]] = await conn.execute('SELECT stock_total FROM medicamentos WHERE id_medicamento = ?', [med.insertId]);
            assert.equal(stock.stock_total, lote.cantidad_disponible);
            await conn.rollback();
            console.log(formas.join(' + ') + ': compra, venta, edición y limpieza OK');
        }
    } finally { await conn.rollback(); conn.release(); await db.end(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

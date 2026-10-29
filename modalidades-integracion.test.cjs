// Verificación con MySQL: todos los datos de prueba se revierten al terminar.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const db = require('./database');
const compras = require('./compras-servicio');
const ventas = require('./ventas-servicios');

(async () => {
    const conn = await db.getConnection();
    try {
        const [[usuario]] = await conn.query("SELECT id_usuario FROM usuarios WHERE rol = 'Administrador' AND estado = 'Activo' LIMIT 1");
        assert(usuario, 'Se necesita un administrador activo para la prueba.');
        const proxy = {
            execute: (...args) => conn.execute(...args), query: (...args) => conn.query(...args),
            getConnection: async () => ({
                execute: (...args) => conn.execute(...args), beginTransaction: async () => {},
                commit: async () => {}, rollback: async () => {}, release() {},
            }),
        };
        for (const tipo of ['Pastilla', 'Frasco', 'Ampolla', 'Suero']) {
            for (const modalidad of ['Caja', 'Caja y unidad']) {
                await conn.beginTransaction();
                const token = randomUUID();
                const [med] = await conn.execute(`INSERT INTO medicamentos
                    (codigo, nombre, laboratorio, categoria, restriccion, estado, stock_total)
                    VALUES (?, ?, 'Prueba', 'Prueba', 'Sin Receta Medica', 'Agotado', 0)`,
                [token.slice(0, 20), token]);
                const fecha = new Date();
                const hoy = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
                await compras.guardar(proxy, usuario, {
                    id_distribuidor: token, telefono_distribuidor: '9999-9999', correo_distribuidor: 'test@example.com',
                    fecha_compra: hoy, metodo_pago: 'Transferencia', estado: 'Cancelado',
                    lotes: [{ id_medicamento: med.insertId, numero_lote: token, cantidad: 2,
                        tipo_medicamento: tipo, modalidad_venta: modalidad, presentacion_ingreso: 'Caja',
                        paquetes_por_caja: tipo === 'Pastilla' && modalidad === 'Caja' ? undefined : 10,
                        unidades_por_blister: tipo === 'Pastilla' && modalidad === 'Caja y unidad' ? 10 : undefined, precio: 100,
                        precio_compra_contenido: 10, precio_compra_unidad: 1,
                        precio_venta: 200, precio_venta_contenido: 20, precio_venta_unidad: 2,
                        fecha_fabricacion: '2020-01-01', fecha_vencimiento: '2099-01-01' }],
                });
                const catalogo = await ventas.cargar(proxy, usuario);
                const pres = catalogo.presentaciones.filter(p => p.id_medicamento === med.insertId);
                assert.deepEqual(pres.map(p => p.nombre_presentacion).sort(),
                    (modalidad === 'Caja' ? ['Caja'] : tipo === 'Pastilla' ? ['Caja', 'Blister', 'Pastilla'] : ['Caja', 'Unidad']).sort());
                const factor = tipo === 'Pastilla' ? (modalidad === 'Caja' ? 1 : 100) : 10;
                let disponible = factor * 2;
                for (const p of pres) {
                    const venta = await ventas.guardar(proxy, usuario, {
                        metodo_pago: 'Transferencia', items: [{ id_presentacion: p.id_presentacion, cantidad: 1 }],
                    });
                    disponible -= Number(p.unidades_stock);
                    const [[lote]] = await conn.execute('SELECT cantidad_disponible FROM lote WHERE id_lote = ?', [p.id_lote]);
                    const [[stock]] = await conn.execute('SELECT stock_total FROM medicamentos WHERE id_medicamento = ?', [med.insertId]);
                    assert.equal(lote.cantidad_disponible, disponible);
                    assert.equal(stock.stock_total, disponible);
                    const [[detalle]] = await conn.execute('SELECT precio_unitario FROM detalles_venta WHERE id_venta = ?', [venta.id_venta]);
                    assert.equal(Number(detalle.precio_unitario), Number(p.precio_venta));
                }
                await assert.rejects(ventas.guardar(proxy, usuario, {
                    metodo_pago: 'Transferencia', items: [{ id_presentacion: pres[0].id_presentacion, cantidad: 9999 }],
                }), /Stock insuficiente/);
                const cambios = {
                    id_lote: pres[0].id_lote, revision: 0, nombre: 'Nombre corregido de este lote', razon_edicion: 'Correccion del registro',
                    tipo_medicamento: tipo, modalidad_venta: modalidad, presentacion_ingreso: 'Caja', cantidad: 3,
                    paquetes_por_caja: tipo === 'Pastilla' && modalidad === 'Caja' ? undefined : 10,
                    unidades_por_blister: tipo === 'Pastilla' && modalidad === 'Caja y unidad' ? 10 : undefined,
                    precio: 110, precio_venta: 220, precio_compra_contenido: 11, precio_compra_unidad: 1.1,
                    precio_venta_contenido: 22, precio_venta_unidad: 2.2,
                };
                await assert.rejects(compras.editarLote(proxy, usuario, {...cambios, razon_edicion: ''}), /razón de edición/);
                await compras.editarLote(proxy, usuario, cambios);
                const [[editado]] = await conn.execute('SELECT * FROM lote WHERE id_lote = ?', [cambios.id_lote]);
                assert.equal(editado.nombre_medicamento, cambios.nombre);
                assert.equal(editado.razon_edicion, cambios.razon_edicion);
                assert(editado.fecha_edicion);
                assert.equal(editado.revision, 1);
                assert.equal(editado.cantidad_disponible, disponible + factor);
                const [[compraEditada]] = await conn.execute('SELECT total FROM compras WHERE id_compra = ?', [editado.id_compra]);
                assert.equal(Number(compraEditada.total), 330);
                const [[stockEditado]] = await conn.execute('SELECT stock_total, nombre FROM medicamentos WHERE id_medicamento = ?', [med.insertId]);
                assert.equal(stockEditado.stock_total, disponible + factor);
                assert.equal(stockEditado.nombre, token, 'El cambio de nombre no debe modificar otros lotes');
                await assert.rejects(compras.editarLote(proxy, usuario, cambios), /El lote cambió/);
                if (modalidad === 'Caja y unidad') await assert.rejects(compras.editarLote(proxy, usuario, {...cambios, revision: 1, cantidad: 1}), /cantidad ingresada/);
                await assert.rejects(compras.editarLote(proxy, usuario, {...cambios, revision: 1, tipo_medicamento: tipo === 'Pastilla' ? 'Suero' : 'Pastilla'}), /salidas|contenido|blíster/);
                const consulta = await compras.lotes(proxy, usuario, editado.id_compra);
                assert.equal(consulta[0].medicamento, cambios.nombre);
                assert.equal(consulta[0].revision, 1);
                assert.equal(consulta[0].historial_ediciones.length, 1);
                await compras.editarLote(proxy, usuario, {...cambios, revision: 1, razon_edicion: 'Segunda correccion', precio: 111});
                const conHistorial = await compras.lotes(proxy, usuario, editado.id_compra);
                assert.deepEqual(conHistorial[0].historial_ediciones.map(e => e.razon_edicion), ['Segunda correccion', 'Correccion del registro']);
                assert.deepEqual(conHistorial[0].historial_ediciones.map(e => e.revision), [2, 1]);
                await conn.rollback();
                console.log(`${tipo} / ${modalidad}: precios y descuentos de stock correctos`);
            }
        }
    } finally { await conn.rollback(); conn.release(); await db.end(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

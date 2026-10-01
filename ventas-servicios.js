const { randomBytes } = require('node:crypto');
const { autorizar } = require('./sesion-servicio');

async function cargar(db, usuario) {
    await autorizar(db, usuario);
    const [medicamentos] = await db.execute("SELECT id_medicamento, codigo, nombre, restriccion, stock_total, estado FROM medicamentos WHERE estado = 'Disponible' ORDER BY nombre");
    const [presentaciones] = await db.execute('SELECT * FROM medicamento_presentaciones');
    return { medicamentos, presentaciones: presentaciones.filter(p => p.estado !== 'Inactiva') };
}
async function listar(db, usuario) {
    await autorizar(db, usuario);
    const [filas] = await db.execute(`SELECT v.id_venta, v.numero_factura, v.id_cliente, c.dni AS dni_cliente,
        DATE_FORMAT(v.fecha_venta, '%Y-%m-%d %H:%i:%s') AS fecha_venta, v.total, v.metodo_pago, v.estado
        FROM ventas v LEFT JOIN clientes c ON c.id_cliente = v.id_cliente ORDER BY v.id_venta DESC`);
    return filas;
}
async function guardar(db, usuario, datos) {
    await autorizar(db, usuario);
    if (!datos || !Array.isArray(datos.items) || !datos.items.length) throw new Error('Agrega al menos un medicamento.');
    const dni = String(datos.dni || '').trim() || null;
    if (dni && dni.length > 20) throw new Error('El DNI admite hasta 20 caracteres.');
    if (!['Efectivo', 'Tarjeta', 'Transferencia'].includes(datos.metodo_pago)) throw new Error('Método de pago inválido.');
    const items = datos.items.map(it => {
        const id = Number(it?.id_presentacion), cantidad = Number(it?.cantidad);
        if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > 2147483647) throw new Error('Presentación o cantidad inválida.');
        return { id, cantidad };
    }).sort((a,b) => a.id-b.id);
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const lineas = [], acumuladas = new Map();
        let totalCentavos = 0, requiereReceta = false;
        for (const it of items) {
            const [[p]] = await conn.execute(`SELECT p.*, m.nombre, m.restriccion, m.stock_total, m.estado AS estado_medicamento
                FROM medicamento_presentaciones p JOIN medicamentos m USING (id_medicamento)
                WHERE p.id_presentacion = ? FOR UPDATE`, [it.id]);
            if (!p || p.estado_medicamento !== 'Disponible' || p.estado === 'Inactiva') throw new Error('La presentación no está disponible.');
            const unidades = it.cantidad * Number(p.unidades_stock);
            const acumulado = (acumuladas.get(p.id_medicamento) || 0) + unidades;
            if (!Number.isSafeInteger(unidades) || unidades < 1 || acumulado > Number(p.stock_total)) throw new Error('Stock insuficiente de ' + p.nombre + '.');
            acumuladas.set(p.id_medicamento, acumulado);
            const centavos = Math.round(Number(p.precio_venta) * 100);
            if (!Number.isSafeInteger(centavos) || centavos <= 0) throw new Error('Precio de venta inválido.');
            const subtotal = centavos * it.cantidad;
            totalCentavos += subtotal;
            if (!Number.isSafeInteger(totalCentavos) || totalCentavos > 9999999999) throw new Error('El total excede el máximo permitido.');
            requiereReceta ||= p.restriccion === 'Con Receta Medica';
            lineas.push({ ...p, cantidad: it.cantidad, unidades, subtotal });
        }
        if (requiereReceta && !dni) throw new Error('El DNI es obligatorio para medicamentos con receta médica.');
        let idCliente;
        if (dni) {
            const [r] = await conn.execute('INSERT INTO clientes (dni) VALUES (?) ON DUPLICATE KEY UPDATE id_cliente = LAST_INSERT_ID(id_cliente)', [dni]);
            idCliente = r.insertId;
        } else {
            const [r] = await conn.execute('INSERT INTO clientes (dni) VALUES (NULL)');
            idCliente = r.insertId;
        }
        const total = (totalCentavos / 100).toFixed(2);
        const [v] = await conn.execute(`INSERT INTO ventas (numero_factura, id_usuario, id_cliente, subtotal, total, metodo_pago, requiere_receta)
            VALUES (?, ?, ?, ?, ?, ?, ?)`, [randomBytes(12).toString('hex'), usuario.id_usuario, idCliente, total, total, datos.metodo_pago, requiereReceta ? 1 : 0]);
        const numeroFactura = 'FAC-' + String(v.insertId).padStart(6, '0');
        await conn.execute('UPDATE ventas SET numero_factura = ? WHERE id_venta = ?', [numeroFactura, v.insertId]);
        for (const l of lineas) {
            const [detalle] = await conn.execute(`INSERT INTO detalles_venta (id_venta, id_medicamento, id_presentacion, presentacion, cantidad, precio_unitario, subtotal)
                VALUES (?, ?, ?, ?, ?, ?, ?)`, [v.insertId, l.id_medicamento, l.id_presentacion, l.nombre_presentacion, l.cantidad, l.precio_venta, (l.subtotal / 100).toFixed(2)]);
            let falta = l.unidades;
            const [lotes] = await conn.execute(`SELECT id_lote, cantidad_disponible FROM lote WHERE id_medicamento = ?
                AND estado = 'Disponible' AND cantidad_disponible > 0 AND fecha_vencimiento >= CURDATE()
                ORDER BY fecha_vencimiento, id_lote FOR UPDATE`, [l.id_medicamento]);
            for (const lote of lotes) {
                if (!falta) break;
                const toma = Math.min(falta, lote.cantidad_disponible), quedan = lote.cantidad_disponible - toma;
                await conn.execute('UPDATE lote SET cantidad_disponible = ?, estado = ? WHERE id_lote = ?', [quedan, quedan ? 'Disponible' : 'Agotado', lote.id_lote]);
                await conn.execute('INSERT INTO detalle_venta_lotes (id_detalle_venta, id_lote, cantidad_unidades) VALUES (?, ?, ?)', [detalle.insertId, lote.id_lote, toma]);
                falta -= toma;
            }
            if (falta) throw new Error('No hay lotes vigentes suficientes de ' + l.nombre + '.');
            await conn.execute(`UPDATE medicamentos SET estado = CASE WHEN stock_total - ? = 0 THEN 'Agotado' ELSE estado END,
                stock_total = stock_total - ? WHERE id_medicamento = ?`, [l.unidades, l.unidades, l.id_medicamento]);
        }
        await conn.commit();
        return { id_venta: v.insertId, numero_factura: numeroFactura };
    } catch (error) { await conn.rollback(); throw error; }
    finally { conn.release(); }
}
async function factura(db, usuario, id) {
    await autorizar(db, usuario);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Venta inválida.');
    const [[venta]] = await db.execute(`SELECT v.*, DATE_FORMAT(v.fecha_venta, '%Y-%m-%d %H:%i:%s') AS fecha_venta,
        c.dni AS dni_cliente, CONCAT(u.nombre, ' ', u.apellido) AS vendedor FROM ventas v
        LEFT JOIN clientes c USING (id_cliente) JOIN usuarios u USING (id_usuario) WHERE v.id_venta = ?`, [id]);
    if (!venta) throw new Error('Venta no encontrada.');
    const [detalle] = await db.execute(`SELECT m.nombre, d.presentacion AS nombre_presentacion, d.cantidad, d.precio_unitario, d.subtotal
        FROM detalles_venta d JOIN medicamentos m USING (id_medicamento) WHERE d.id_venta = ? ORDER BY d.id_detalle_venta`, [id]);
    return { venta, detalle };
}
module.exports = { cargar, listar, guardar, factura };

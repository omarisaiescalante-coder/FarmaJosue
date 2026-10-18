const { randomBytes } = require('node:crypto');
const { autorizar } = require('./sesion-servicio');
const C = require('./calculos-venta');

async function cargar(db, usuario) {
    await autorizar(db, usuario, 'ventas');
    const [medicamentos] = await db.execute("SELECT id_medicamento, codigo, nombre, restriccion, stock_total, estado, aplica_isv FROM medicamentos WHERE estado = 'Disponible' ORDER BY nombre");
    const [presentaciones] = await db.execute('SELECT * FROM medicamento_presentaciones');
    return { medicamentos, presentaciones: presentaciones.filter(p => p.estado !== 'Inactiva') };
}
async function listar(db, usuario) {
    await autorizar(db, usuario, 'ventas');
    const [filas] = await db.execute(`SELECT v.id_venta, v.numero_factura, v.id_cliente, c.dni AS dni_cliente,
        DATE_FORMAT(v.fecha_venta, '%Y-%m-%d %H:%i:%s') AS fecha_venta, v.total, v.metodo_pago, v.estado
        FROM ventas v LEFT JOIN clientes c ON c.id_cliente = v.id_cliente ORDER BY v.id_venta DESC`);
    return filas;
}
async function resumen(db, usuario) {
    await autorizar(db, usuario, 'ventas');
    const [[resultado]] = await db.execute("SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS cantidad FROM ventas WHERE estado = 'Completada'");
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tegucigalpa', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const fin = new Date(hoy + 'T00:00:00Z');
    const dias = Array.from({ length: 7 }, (_, i) => {
        const fecha = new Date(fin);
        fecha.setUTCDate(fecha.getUTCDate() - 6 + i);
        return fecha.toISOString().slice(0, 10);
    });
    const manana = new Date(fin);
    manana.setUTCDate(manana.getUTCDate() + 1);
    const [semanales] = await db.execute(`SELECT DATE_FORMAT(fecha_venta, '%Y-%m-%d') AS fecha,
        SUM(total) AS total, COUNT(*) AS cantidad FROM ventas
        WHERE estado = 'Completada' AND fecha_venta >= ? AND fecha_venta < ?
        GROUP BY DATE_FORMAT(fecha_venta, '%Y-%m-%d') ORDER BY fecha`, [dias[0], manana.toISOString().slice(0, 10)]);
    return { ...resultado, semana: dias.map(fecha => {
        const dia = semanales.find(fila => fila.fecha === fecha);
        return { fecha, total: Number(dia?.total || 0), cantidad: Number(dia?.cantidad || 0) };
    }) };
}
async function guardar(db, usuario, datos) {
    await autorizar(db, usuario, 'ventas');
    if (!datos || !Array.isArray(datos.items) || !datos.items.length) throw new Error('Agrega al menos un medicamento.');
    const dni = String(datos.dni || '').trim() || null;
    if (dni && dni.length > 20) throw new Error('El DNI admite hasta 20 caracteres.');
    if (dni && !C.dniValido(dni)) throw new Error('Ingresa un DNI válido (0000-0000-00000).');
    const edad = datos.edad == null || datos.edad === '' ? C.edadDesdeDni(dni) : Number(datos.edad);
    if (edad !== null && (!Number.isInteger(edad) || edad < 0 || edad > 120)) throw new Error('La edad del cliente no es válida.');
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
            const [[p]] = await conn.execute(`SELECT p.*, m.nombre, m.restriccion, m.stock_total, m.aplica_isv, m.estado AS estado_medicamento
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
            lineas.push({ ...p, cantidad: it.cantidad, unidades, subtotal, precioCentavos: centavos });
        }
        const calculo = C.calcularVenta(lineas.map(l => ({ precio: l.precioCentavos, cantidad: l.cantidad, aplicaIsv: Number(l.aplica_isv) === 1 })), edad);
        if (calculo.total > 9999999999) throw new Error('El total excede el máximo permitido.');
        let recibido = null, cambio = 0;
        if (datos.metodo_pago === 'Efectivo') {
            if (datos.monto_recibido == null || datos.monto_recibido === '' || !Number.isFinite(Number(datos.monto_recibido)) || Number(datos.monto_recibido) < 0) throw new Error('Ingresa el dinero recibido del cliente.');
            recibido = Math.round(Number(datos.monto_recibido) * 100);
            const pago = C.calcularCambio(calculo.total, recibido);
            if (recibido > 9999999999) throw new Error('El pago excede el máximo permitido.');
            if (!pago.suficiente) throw new Error('Pago insuficiente.');
            cambio = pago.cambio;
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
        const dinero = centavos => (centavos / 100).toFixed(2);
        const [v] = await conn.execute(`INSERT INTO ventas (numero_factura, id_usuario, id_cliente, subtotal, descuento, impuesto, total, metodo_pago, requiere_receta, monto_recibido, cambio)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [randomBytes(12).toString('hex'), usuario.id_usuario, idCliente,
            dinero(calculo.subtotal), dinero(calculo.descuento), dinero(calculo.isv), dinero(calculo.total), datos.metodo_pago,
            requiereReceta ? 1 : 0, recibido === null ? null : dinero(recibido), dinero(cambio)]);
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
        return { id_venta: v.insertId, numero_factura: numeroFactura, total: dinero(calculo.total), cambio: dinero(cambio) };
    } catch (error) { await conn.rollback(); throw error; }
    finally { conn.release(); }
}
async function factura(db, usuario, id) {
    await autorizar(db, usuario, 'ventas');
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Venta inválida.');
    const [[venta]] = await db.execute(`SELECT v.*, DATE_FORMAT(v.fecha_venta, '%Y-%m-%d %H:%i:%s') AS fecha_venta,
        c.dni AS dni_cliente, CONCAT(u.nombre, ' ', u.apellido) AS vendedor FROM ventas v
        LEFT JOIN clientes c USING (id_cliente) JOIN usuarios u USING (id_usuario) WHERE v.id_venta = ?`, [id]);
    if (!venta) throw new Error('Venta no encontrada.');
    const [detalle] = await db.execute(`SELECT m.nombre, d.presentacion AS nombre_presentacion, d.cantidad, d.precio_unitario, d.subtotal
        FROM detalles_venta d JOIN medicamentos m USING (id_medicamento) WHERE d.id_venta = ? ORDER BY d.id_detalle_venta`, [id]);
    return { venta, detalle };
}
module.exports = { cargar, listar, guardar, factura, resumen };

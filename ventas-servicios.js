// Lógica del módulo de ventas: catálogo, registro de ventas y facturas.

// Medicamentos con sus presentaciones, para armar la venta.
async function cargar(db) {
    const [medicamentos] = await db.execute(
        "SELECT id_medicamento, nombre, restriccion, stock_total FROM medicamentos WHERE estado = 'Disponible' ORDER BY nombre"
    );
    const [presentaciones] = await db.execute(
        'SELECT id_presentacion, id_medicamento, nombre_presentacion, precio_venta, unidades_stock FROM Medicamento_presentaciones'
    );
    return { medicamentos, presentaciones };
}

// Lista para la tabla de registro de ventas.
async function listar(db) {
    const [filas] = await db.execute(
        `SELECT v.id_venta, v.id_cliente,
                COALESCE(c.dni, 'xxxxxxx') AS dni_cliente,
                v.fecha_venta, v.total, v.metodo_pago
           FROM Ventas v
           JOIN Clientes c ON c.id_cliente = v.id_cliente
          ORDER BY v.id_venta DESC`
    );
    return filas;
}

async function guardar(db, usuario, datos) {
    if (!usuario) throw new Error('Sesión no válida.');
    const items = Array.isArray(datos.items) ? datos.items : [];
    if (!items.length) throw new Error('Agregá al menos un medicamento.');
    const dni = String(datos.dni || '').trim() || null;
    if (!['Efectivo', 'Tarjeta', 'Transferencia'].includes(datos.metodo_pago))
        throw new Error('Seleccioná un método de pago válido.');

    // Si db es un pool se usa una conexión; si es una conexión simple se usa directamente.
    const conn = db.getConnection ? await db.getConnection() : db;
    try {
        await conn.beginTransaction();
        let total = 0;
        let requiereReceta = false;
        const lineas = [];

        for (const it of items) {
            const cantidad = Number(it.cantidad);
            if (!Number.isInteger(cantidad) || cantidad <= 0)
                throw new Error('La cantidad debe ser un entero mayor que cero.');
            const [[p]] = await conn.execute(
                `SELECT p.id_presentacion, p.id_medicamento, p.precio_venta, p.unidades_stock,
                        m.nombre, m.restriccion, m.stock_total
                   FROM Medicamento_presentaciones p
                   JOIN medicamentos m ON m.id_medicamento = p.id_medicamento
                  WHERE p.id_presentacion = ? FOR UPDATE`,
                [it.id_presentacion]
            );
            if (!p) throw new Error('Presentación no encontrada.');
            const unidades = cantidad * p.unidades_stock;
            if (unidades > p.stock_total)
                throw new Error('Stock insuficiente de ' + p.nombre + '.');
            if (p.restriccion === 'Con Receta Medica') requiereReceta = true;
            const subtotal = Number(p.precio_venta) * cantidad;
            total += subtotal;
            lineas.push({ ...p, cantidad, unidades, subtotal });
        }

        // Regla de receta: se valida aquí, aunque la pantalla también la revise.
        if (requiereReceta && !dni)
            throw new Error('La venta incluye medicamentos con receta médica: el DNI del cliente es obligatorio.');

        // Cliente: reutiliza el DNI si existe; si no hay DNI se crea un cliente con DNI NULL.
        let idCliente = null;
        if (dni) {
            const [f] = await conn.execute('SELECT id_cliente FROM Clientes WHERE dni = ?', [dni]);
            if (f.length) idCliente = f[0].id_cliente;
        }
        if (!idCliente) {
            const [r] = await conn.execute('INSERT INTO Clientes (dni) VALUES (?)', [dni]);
            idCliente = r.insertId;
        }

        const [v] = await conn.execute(
            'INSERT INTO Ventas (id_usuario, id_cliente, total, metodo_pago, requiere_receta) VALUES (?, ?, ?, ?, ?)',
            [usuario.id_usuario, idCliente, total.toFixed(2), datos.metodo_pago, requiereReceta ? 1 : 0]
        );

        for (const l of lineas) {
            await conn.execute(
                `INSERT INTO Detalle_venta (id_venta, id_medicamento, id_presentacion, cantidad, precio_unitario, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [v.insertId, l.id_medicamento, l.id_presentacion, l.cantidad, l.precio_venta, l.subtotal.toFixed(2)]
            );

            // Descuenta de los lotes vigentes, primero los que vencen antes.
            let falta = l.unidades;
            const [lotes] = await conn.execute(
                `SELECT id_lote, cantidad_disponible FROM Lote
                  WHERE id_medicamento = ? AND estado = 'Disponible'
                    AND cantidad_disponible > 0 AND fecha_vencimiento >= CURDATE()
                  ORDER BY fecha_vencimiento FOR UPDATE`,
                [l.id_medicamento]
            );
            for (const lote of lotes) {
                if (falta <= 0) break;
                const toma = Math.min(falta, lote.cantidad_disponible);
                const quedan = lote.cantidad_disponible - toma;
                await conn.execute(
                    'UPDATE Lote SET cantidad_disponible = ?, estado = ? WHERE id_lote = ?',
                    [quedan, quedan === 0 ? 'Agotado' : 'Disponible', lote.id_lote]
                );
                falta -= toma;
            }
            if (falta > 0) throw new Error('No hay lotes vigentes suficientes de ' + l.nombre + '.');

            await conn.execute(
                `UPDATE medicamentos
                    SET estado = CASE WHEN stock_total - ? <= 0 THEN 'Agotado' ELSE estado END,
                        stock_total = stock_total - ?
                  WHERE id_medicamento = ?`,
                [l.unidades, l.unidades, l.id_medicamento]
            );
        }

        await conn.commit();
        return { id_venta: v.insertId };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        if (conn.release) conn.release();
    }
}

// Datos completos de una venta para imprimir su factura.
async function factura(db, usuario, id) {
    const [[venta]] = await db.execute(
        `SELECT v.id_venta, CONCAT('FAC-', LPAD(v.id_venta, 6, '0')) AS numero_factura,
                v.fecha_venta, v.total, v.metodo_pago, v.id_cliente,
                COALESCE(c.dni, 'xxxxxxx') AS dni_cliente,
                CONCAT(u.nombre, ' ', u.apellido) AS vendedor
           FROM Ventas v
           JOIN Clientes c ON c.id_cliente = v.id_cliente
           JOIN usuarios u ON u.id_usuario = v.id_usuario
          WHERE v.id_venta = ?`,
        [id]
    );
    if (!venta) throw new Error('Venta no encontrada.');
    const [detalle] = await db.execute(
        `SELECT m.nombre, p.nombre_presentacion, d.cantidad, d.precio_unitario, d.subtotal
           FROM Detalle_venta d
           JOIN medicamentos m ON m.id_medicamento = d.id_medicamento
           JOIN Medicamento_presentaciones p ON p.id_presentacion = d.id_presentacion
          WHERE d.id_venta = ?`,
        [id]
    );
    return { venta, detalle };
}

module.exports = { cargar, listar, guardar, factura };
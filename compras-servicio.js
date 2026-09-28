// Consultas exclusivas de Compras. La pantalla nunca ejecuta SQL directamente.
const config = require('./compras');
const { randomUUID } = require('node:crypto');
const { validarEmpaque } = require('./empaques');

async function autorizar(db, sesion) {
    if (!sesion) throw new Error('Iniciá sesión para continuar.');
    const [usuarios] = await db.execute(
        "SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND rol = 'Administrador' AND estado = 'Activo'",
        [sesion.id_usuario],
    );
    if (!usuarios.length) throw new Error('Compras requiere un administrador activo.');
}

async function cargar(db, sesion) {
    await autorizar(db, sesion);
    const [compras] = await db.query(`SELECT c.*, d.nombre AS nombre_distribuidor,
        DATE_FORMAT(c.fecha_compra, '%Y-%m-%d') AS fecha_compra
        FROM compras c JOIN distribuidores d USING (id_distribuidor)
        ORDER BY c.id_compra DESC`);
    const [proveedores] = await db.query('SELECT id_distribuidor, nombre, telefono, correo FROM distribuidores ORDER BY nombre');
    const [medicamentos] = await db.query(`SELECT m.id_medicamento, m.codigo, m.nombre, m.laboratorio,
        m.categoria, m.restriccion, m.stock_total,
        l.presentacion_ingreso AS forma_venta, l.precio_venta
        FROM medicamentos m LEFT JOIN lote l ON l.id_lote =
            (SELECT MAX(ultimo.id_lote) FROM lote ultimo WHERE ultimo.id_medicamento = m.id_medicamento)
        WHERE m.estado <> 'Inactivo' ORDER BY m.nombre`);
    return { config, compras, proveedores, medicamentos };
}

async function lotes(db, sesion, id) {
    await autorizar(db, sesion);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Compra inválida.');
    const [filas] = await db.execute(`SELECT l.numero_lote, m.nombre AS medicamento,
        l.cantidad_inicial, l.cantidad_disponible,
        DATE_FORMAT(l.fecha_fabricacion, '%Y-%m-%d') AS fecha_fabricacion,
        DATE_FORMAT(l.fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento,
        ROUND(l.costo_total / NULLIF(l.cantidad_inicial, 0), 6) AS precio_compra,
        l.costo_total, l.estado, l.laboratorio,
        l.presentacion_ingreso, l.contenido_caja, l.paquetes_por_caja, l.unidades_por_blister,
        l.cantidad_empaques, l.precio_empaque, l.precio_venta, l.precio_venta_contenido, l.precio_venta_unidad
        FROM lote l JOIN medicamentos m USING (id_medicamento)
        WHERE l.id_compra = ? ORDER BY l.id_lote`, [id]);
    return filas;
}

async function guardar(db, sesion, datos) {
    await autorizar(db, sesion);
    if (!datos || typeof datos !== 'object') throw new Error('Compra inválida.');
    const nombre = String(datos.id_distribuidor || '').trim();
    const telefono = String(datos.telefono_distribuidor || '').trim();
    const correo = String(datos.correo_distribuidor || '').trim();
    if (!nombre || nombre.length > 150) throw new Error('Revisá el nombre del proveedor.');
    if (!/^\d{4}-\d{4}$/.test(telefono)) throw new Error('Usá el formato de teléfono 9999-9999.');
    if (correo.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error('Correo inválido.');
    const fecha = String(datos.fecha_compra || '');
    const hoy = new Date();
    const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    const fechaParseada = new Date(`${fecha}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(fechaParseada.getTime()) ||
        fechaParseada.toISOString().slice(0, 10) !== fecha || fecha > fechaHoy)
        throw new Error('Revisá la fecha de compra.');
    if (!Array.isArray(datos.lotes) || !datos.lotes.length) throw new Error('Agregá al menos un lote a la compra.');
    const numeros = new Set();
    let totalCentavos = 0;
    const nuevosLotes = datos.lotes.map((lote) => {
        if (!lote || typeof lote !== 'object') throw new Error('Lote inválido.');
        const medicamento = Number(lote.id_medicamento);
        const cantidad = Number(lote.cantidad);
        const numero = lote.numero_automatico === true ? randomUUID() : String(lote.numero_lote || '').trim();
        const empaque = validarEmpaque(lote);
        const cantidadStock = cantidad * empaque.factor;
        if (!Number.isSafeInteger(cantidadStock) || cantidadStock < 1 || cantidadStock > 2147483647)
            throw new Error('La cantidad excede el inventario permitido.');
        const fabricacion = String(lote.fecha_fabricacion || '');
        const fechaFabricacion = new Date(`${fabricacion}T12:00:00Z`);
        if ((lote.presentacion_ingreso || fabricacion) &&
            (!/^\d{4}-\d{2}-\d{2}$/.test(fabricacion) || !Number.isFinite(fechaFabricacion.getTime()) ||
             fechaFabricacion.toISOString().slice(0, 10) !== fabricacion || fabricacion > fecha || fabricacion >= String(lote.fecha_vencimiento)))
            throw new Error('Revisá la fecha de fabricación: debe ser anterior al vencimiento y no posterior a la compra.');
        const vencimiento = String(lote.fecha_vencimiento || '');
        const fechaVencimiento = new Date(`${vencimiento}T12:00:00Z`);
        if (!Number.isSafeInteger(medicamento) || medicamento < 1) throw new Error('Seleccioná el medicamento de cada lote.');
        if (!Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > 2147483647) throw new Error('La cantidad debe ser un número entero positivo.');
        if (!numero || numero.length > 50 || numeros.has(numero.toLowerCase())) throw new Error('Revisá los números de lote: no pueden estar vacíos ni repetidos.');
        numeros.add(numero.toLowerCase());
        if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimiento) || !Number.isFinite(fechaVencimiento.getTime()) ||
            fechaVencimiento.toISOString().slice(0, 10) !== vencimiento || vencimiento <= fechaHoy)
            throw new Error('El vencimiento de cada lote debe ser posterior a hoy.');
        if (!/^\d+(\.\d{1,2})?$/.test(String(lote.precio)) || Number(lote.precio) > 99999999.99)
            throw new Error('Revisá el precio unitario de cada lote.');
        const precioCentavos = Math.round(Number(lote.precio) * 100);
        const subtotal = precioCentavos * cantidad;
        totalCentavos += subtotal;
        if (!Number.isSafeInteger(totalCentavos) || totalCentavos > 9999999999)
            throw new Error('El total excede el monto máximo de la compra.');
        return { medicamento, cantidad: cantidadStock, cantidadEmpaques: cantidad, numero,
            automatico: lote.numero_automatico === true, vencimiento, fabricacion: fabricacion || null, empaque,
            precioEmpaque: (precioCentavos / 100).toFixed(2),
            total: (subtotal / 100).toFixed(2) };
    });
    if (!['Efectivo', 'Tarjeta', 'Transferencia', 'Credito'].includes(datos.metodo_pago) ||
        !['A Credito', 'Cancelado'].includes(datos.estado)) throw new Error('Pago o condición inválidos.');
    const conexion = await db.getConnection();
    try {
        await conexion.beginTransaction();
        // Bloquea el inventario en orden estable para guardar todos los lotes de forma atómica.
        for (const id of [...new Set(nuevosLotes.map(l => l.medicamento))].sort((a, b) => a - b)) {
            const [medicamentos] = await conexion.execute('SELECT stock_total, estado, laboratorio FROM medicamentos WHERE id_medicamento = ? FOR UPDATE', [id]);
            if (!medicamentos.length || medicamentos[0].estado === 'Inactivo') throw new Error('Uno de los medicamentos ya no está disponible.');
            const ingreso = nuevosLotes.filter(l => l.medicamento === id).reduce((suma, l) => suma + l.cantidad, 0);
            if (Number(medicamentos[0].stock_total || 0) + ingreso > 2147483647) throw new Error('La cantidad excede el inventario permitido.');
            for (const lote of nuevosLotes.filter(l => l.medicamento === id)) lote.laboratorio = nombre;
        }
        const [proveedores] = await conexion.execute('SELECT id_distribuidor FROM distribuidores WHERE nombre = ?', [nombre]);
        let proveedor = proveedores[0]?.id_distribuidor;
        if (!proveedor) {
            const [alta] = await conexion.execute('INSERT INTO distribuidores (nombre, telefono, correo) VALUES (?, ?, ?)', [nombre, telefono, correo]);
            proveedor = alta.insertId;
        }
        // El identificador temporal evita colisiones mientras se obtiene el ID autoincremental.
        const [alta] = await conexion.execute(`INSERT INTO compras
            (numero_factura, id_usuario, id_distribuidor, fecha_compra, total, metodo_pago, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), sesion.id_usuario, proveedor, fecha, (totalCentavos / 100).toFixed(2), datos.metodo_pago, datos.estado]);
        const factura = `COM-${String(alta.insertId).padStart(4, '0')}`;
        await conexion.execute('UPDATE compras SET numero_factura = ?, laboratorio = ? WHERE id_compra = ?', [factura, nombre, alta.insertId]);
        for (const lote of nuevosLotes) {
            try {
                const [registro] = await conexion.execute(`INSERT INTO lote
                    (id_compra, id_medicamento, numero_lote, cantidad_inicial, cantidad_disponible,
                     fecha_vencimiento, costo_total, estado)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'Disponible')`,
                [alta.insertId, lote.medicamento, lote.numero, lote.cantidad, lote.cantidad, lote.vencimiento, lote.total]);
                await conexion.execute(`UPDATE lote SET numero_lote = ?, fecha_fabricacion = ?,
                    presentacion_ingreso = ?, contenido_caja = ?, paquetes_por_caja = ?, unidades_por_blister = ?,
                    cantidad_empaques = ?, precio_empaque = ?, precio_venta = ?, precio_venta_contenido = ?, precio_venta_unidad = ?, laboratorio = ?
                    WHERE id_lote = ?`,
                [lote.automatico ? `LOT-${String(registro.insertId).padStart(6, '0')}` : lote.numero,
                    lote.fabricacion, lote.empaque.forma, lote.empaque.contenido, lote.empaque.paquetes,
                    lote.empaque.contenido === 'Blister' ? lote.empaque.unidades : null,
                    lote.cantidadEmpaques, lote.precioEmpaque,
                    lote.empaque.precios.find(p => p.nombre === lote.empaque.forma)?.precio || null,
                    lote.empaque.precios.find(p => p.nombre === lote.empaque.contenido)?.precio || null,
                    lote.empaque.precios.find(p => p.nombre === 'Unidad')?.precio || null, lote.laboratorio, registro.insertId]);
                for (const presentacion of lote.empaque.precios) {
                    await conexion.execute(`INSERT INTO medicamento_presentaciones
                        (id_medicamento, nombre_presentacion, precio_venta, unidades_stock)
                        VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE precio_venta = VALUES(precio_venta),
                        unidades_stock = VALUES(unidades_stock)`,
                    [lote.medicamento, presentacion.nombre, presentacion.precio, presentacion.unidades]);
                }
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY') throw new Error(`El número de lote ${lote.numero} ya está registrado.`);
                throw error;
            }
            await conexion.execute(`UPDATE medicamentos SET stock_total = COALESCE(stock_total, 0) + ?,
                laboratorio = ?, estado = 'Disponible' WHERE id_medicamento = ?`,
            [lote.cantidad, lote.laboratorio, lote.medicamento]);
        }
        await conexion.commit();
        return { numero_factura: factura };
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

async function registrarMedicamento(db, sesion, datos) {
    await autorizar(db, sesion);
    const nombre = String(datos?.nombre || '').trim();
    const laboratorio = String(datos?.laboratorio || '').trim();
    const categoria = String(datos?.categoria || '').trim();
    const restriccion = datos?.restriccion;
    if (!nombre || nombre.length > 150 || !laboratorio || laboratorio.length > 150 || categoria.length > 100)
        throw new Error('Revisá nombre, laboratorio y categoría del medicamento.');
    if (!['Sin Receta Medica', 'Con Receta Medica'].includes(restriccion)) throw new Error('Seleccioná la restricción.');
    const conexion = await db.getConnection();
    try {
        await conexion.beginTransaction();
        const [alta] = await conexion.execute(`INSERT INTO medicamentos
            (codigo, nombre, laboratorio, categoria, restriccion, estado)
            VALUES (?, ?, ?, ?, ?, 'Agotado')`,
        [randomUUID().replace(/-/g, '').slice(0, 20), nombre, laboratorio, categoria, restriccion]);
        const codigo = `MED-${String(alta.insertId).padStart(6, '0')}`;
        await conexion.execute('UPDATE medicamentos SET codigo = ? WHERE id_medicamento = ?', [codigo, alta.insertId]);
        await conexion.commit();
        return { id_medicamento: alta.insertId, codigo, nombre, laboratorio, categoria, restriccion, stock_total: 0 };
    } catch (error) {
        await conexion.rollback();
        if (error.code === 'ER_DUP_ENTRY') throw new Error('Ya existe un medicamento con ese nombre o código.');
        throw error;
    } finally { conexion.release(); }
}
module.exports = { cargar, guardar, lotes, registrarMedicamento };

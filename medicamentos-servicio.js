const { autorizar } = require('./sesion-servicio');
async function listar(db, sesion) {
    await autorizar(db, sesion);
    const [filas] = await db.query(`SELECT m.id_medicamento, m.nombre, m.categoria, m.restriccion, m.stock_total, m.estado,
        GROUP_CONCAT(CONCAT(mp.nombre_presentacion, ': L. ', mp.precio_venta) ORDER BY mp.id_presentacion SEPARATOR ', ') AS precios
        FROM medicamentos m LEFT JOIN medicamento_presentaciones mp USING (id_medicamento)
        GROUP BY m.id_medicamento ORDER BY m.nombre`);
    return filas;
}
async function lotes(db, sesion, id) {
    await autorizar(db, sesion);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Medicamento inválido.');
    const [filas] = await db.execute(`SELECT numero_lote, DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento,
        cantidad_disponible, precio_venta FROM lote WHERE id_medicamento = ? ORDER BY fecha_vencimiento, id_lote`, [id]);
    return filas;
}
async function actualizar(db, sesion, datos) {
    await autorizar(db, sesion);
    const id = Number(datos?.id), nombre = String(datos?.nombre || '').trim(), categoria = String(datos?.categoria || '').trim();
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Medicamento inválido.');
    if (!nombre || nombre.length > 150 || categoria.length > 100) throw new Error('Revisa el nombre y la categoría.');
    if (!['Sin Receta Medica', 'Con Receta Medica'].includes(datos?.restriccion)) throw new Error('Restricción inválida.');
    try {
        const [r] = await db.execute('UPDATE medicamentos SET nombre = ?, categoria = ?, restriccion = ? WHERE id_medicamento = ?', [nombre, categoria, datos.restriccion, id]);
        if (!r.affectedRows) throw new Error('El medicamento ya no existe.');
        return true;
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') throw new Error('Ya existe un medicamento con ese nombre.');
        throw error;
    }
}
module.exports = { listar, lotes, actualizar };

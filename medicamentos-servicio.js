const { autorizar } = require('./sesion-servicio');

// Equivalencia de cada presentación en las unidades internas del inventario.
const CAMPO_EQUIVALENCIA = 'unidades_stock';

// Devuelve cada medicamento con sus presentaciones (precios) y sus lotes, en una sola llamada.
async function listar(db, sesion) {
    await autorizar(db, sesion, 'medicamentos');
    const [meds] = await db.query(`SELECT id_medicamento, nombre, categoria, restriccion, stock_total, estado
        FROM medicamentos ORDER BY nombre`);
    const [pres] = await db.query('SELECT * FROM medicamento_presentaciones ORDER BY id_presentacion');
    const [lotes] = await db.query(`SELECT id_lote, id_medicamento, numero_lote, tipo_medicamento, contenido_caja, paquetes_por_caja, unidades_por_blister,
        DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento, cantidad_disponible
        FROM lote ORDER BY fecha_vencimiento, id_lote`);

    const presPorMed = new Map(), lotesPorMed = new Map();
    const medicamentosConLotesAnteriores = new Set(lotes.filter(l => !l.tipo_medicamento).map(l => l.id_medicamento));
    for (const p of pres.filter(p => p.estado !== 'Inactiva' && (p.id_lote != null || medicamentosConLotesAnteriores.has(p.id_medicamento)))) {
        if (!presPorMed.has(p.id_medicamento)) presPorMed.set(p.id_medicamento, []);
        presPorMed.get(p.id_medicamento).push({
            id_lote: p.id_lote,
            nombre: String(p.nombre_presentacion),
            precio: p.precio_venta == null ? null : Number(p.precio_venta),
            unidades: Number(p[CAMPO_EQUIVALENCIA]) || null
        });
    }
    for (const l of lotes) {
        if (!lotesPorMed.has(l.id_medicamento)) lotesPorMed.set(l.id_medicamento, []);
        lotesPorMed.get(l.id_medicamento).push({
            id_lote: l.id_lote,
            numero_lote: String(l.numero_lote),
            tipo_medicamento: l.tipo_medicamento, contenido_caja: l.contenido_caja,
            paquetes_por_caja: l.paquetes_por_caja, unidades_por_blister: l.unidades_por_blister,
            fecha_vencimiento: l.fecha_vencimiento,
            cantidad: Number(l.cantidad_disponible) || 0
        });
    }
    return meds.map(m => ({
        id_medicamento: m.id_medicamento,
        nombre: m.nombre,
        categoria: m.categoria,
        restriccion: m.restriccion,
        stock_total: Number(m.stock_total) || 0,
        estado: m.estado,
        presentaciones: presPorMed.get(m.id_medicamento) || [],
        lotes: lotesPorMed.get(m.id_medicamento) || []
    }));
}

async function lotes(db, sesion, id) {
    await autorizar(db, sesion, 'medicamentos');
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Medicamento inválido.');
    const [filas] = await db.execute(`SELECT numero_lote, DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento,
        cantidad_disponible, precio_venta FROM lote WHERE id_medicamento = ? ORDER BY fecha_vencimiento, id_lote`, [id]);
    return filas;
}

async function actualizar(db, sesion, datos) {
    await autorizar(db, sesion, 'medicamentos');
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

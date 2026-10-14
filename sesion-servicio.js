const { autorizar } = require('./sesion-servicio');

// Si en medicamento_presentaciones tienes una columna con las unidades que trae cada empaque
// (ej. Caja = 100, Blister = 10, Unidad = 1), escribe aquí su nombre. Si no existe, déjalo así.
const CAMPO_EQUIVALENCIA = 'unidades_por_presentacion';

// Devuelve cada medicamento con sus presentaciones (precios) y sus lotes, en una sola llamada.
async function listar(db, sesion) {
    await autorizar(db, sesion, 'medicamentos');
    const [meds] = await db.query(`SELECT id_medicamento, nombre, categoria, restriccion, stock_total, estado
        FROM medicamentos ORDER BY nombre`);
    const [pres] = await db.query('SELECT * FROM medicamento_presentaciones ORDER BY id_presentacion');
    const [lotes] = await db.query(`SELECT id_medicamento, numero_lote,
        DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento, cantidad_disponible
        FROM lote ORDER BY fecha_vencimiento, id_lote`);

    const presPorMed = new Map(), lotesPorMed = new Map();
    for (const p of pres) {
        if (!presPorMed.has(p.id_medicamento)) presPorMed.set(p.id_medicamento, []);
        presPorMed.get(p.id_medicamento).push({
            nombre: String(p.nombre_presentacion),
            precio: p.precio_venta == null ? null : Number(p.precio_venta),
            unidades: Number(p[CAMPO_EQUIVALENCIA]) || null
        });
    }
    for (const l of lotes) {
        if (!lotesPorMed.has(l.id_medicamento)) lotesPorMed.set(l.id_medicamento, []);
        lotesPorMed.get(l.id_medicamento).push({
            numero_lote: String(l.numero_lote),
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
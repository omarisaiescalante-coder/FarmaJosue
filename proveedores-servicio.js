async function autorizar(db, sesion) {
    if (!sesion) throw new Error('Iniciá sesión para continuar.');
    const [filas] = await db.execute("SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND estado = 'Activo' AND rol IN ('Administrador', 'Dispensador')", [sesion.id_usuario]);
    if (!filas.length) throw new Error('Se requiere un administrador o dispensador activo.');
}
async function listar(db, sesion) {
    await autorizar(db, sesion);
    const [filas] = await db.query('SELECT id_distribuidor, nombre, telefono, correo FROM distribuidores ORDER BY nombre');
    return filas;
}
async function guardar(db, sesion, datos) {
    await autorizar(db, sesion);
    const id = datos?.id_distribuidor == null || datos.id_distribuidor === '' ? null : Number(datos.id_distribuidor);
    const nombre = String(datos?.nombre || '').trim();
    const telefono = String(datos?.telefono || '').trim();
    const correo = String(datos?.correo || '').trim();
    if (id !== null && (!Number.isSafeInteger(id) || id < 1)) throw new Error('Proveedor inválido.');
    if (!nombre || nombre.length > 150) throw new Error('Ingresá un nombre de hasta 150 caracteres.');
    if (!/^\d{4}-\d{4}$/.test(telefono)) throw new Error('Usá el formato de teléfono 9999-9999.');
    if (correo.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error('Ingresá un correo válido.');
    const valores = [nombre, telefono, correo];
    try {
        if (id) {
            const [existentes] = await db.execute('SELECT id_distribuidor FROM distribuidores WHERE id_distribuidor = ?', [id]);
            if (!existentes.length) throw new Error('El proveedor ya no existe.');
            await db.execute('UPDATE distribuidores SET nombre = ?, telefono = ?, correo = ? WHERE id_distribuidor = ?', [...valores, id]);
        } else {
            const [alta] = await db.execute('INSERT INTO distribuidores (nombre, telefono, correo) VALUES (?, ?, ?)', valores);
            return { id_distribuidor: alta.insertId, nombre, telefono, correo };
        }
        return { id_distribuidor: id, nombre, telefono, correo };
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') throw new Error('Ya existe un proveedor con ese nombre.');
        throw error;
    }
}
async function eliminar(db, sesion, dato) {
    await autorizar(db, sesion);
    const id = Number(dato);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Proveedor inválido.');
    try {
        const [resultado] = await db.execute('DELETE FROM distribuidores WHERE id_distribuidor = ?', [id]);
        if (!resultado.affectedRows) throw new Error('El proveedor ya no existe.');
        return { id_distribuidor: id };
    } catch (error) {
        if (error.code === 'ER_ROW_IS_REFERENCED_2') throw new Error('Este proveedor tiene compras asociadas y no puede eliminarse.');
        throw error;
    }
}
module.exports = { listar, guardar, eliminar };

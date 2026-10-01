async function autorizar(db, sesion) {
    if (!sesion) throw new Error('Inicia sesión para continuar.');
    const [filas] = await db.execute("SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND estado = 'Activo'", [sesion.id_usuario]);
    if (!filas.length) throw new Error('La sesión ya no está activa.');
}
module.exports = { autorizar };

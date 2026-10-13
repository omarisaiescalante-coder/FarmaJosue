const permisos = {
    medicamentos: ['Administrador', 'Cajero', 'Dispensador'],
    ventas: ['Administrador', 'Cajero'],
    compras: ['Administrador', 'Dispensador'],
};
async function autorizar(db, sesion, modulo) {
    if (!sesion) throw new Error('Inicia sesión para continuar.');
    const roles = permisos[modulo];
    if (!roles) throw new Error('Módulo inválido.');
    const [filas] = await db.execute(`SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND estado = 'Activo' AND rol IN (${roles.map(() => '?').join(', ')})`, [sesion.id_usuario, ...roles]);
    if (!filas.length) throw new Error('La sesión ya no está activa.');
}
module.exports = { autorizar };

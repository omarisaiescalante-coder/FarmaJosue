const permisos = {
    medicamentos: ['Administrador', 'Cajero', 'Dispensador'],
    ventas: ['Administrador', 'Cajero'],
    compras: ['Administrador', 'Dispensador'],
};

// Consulta el rol vigente en MySQL antes de permitir el acceso al módulo.
async function autorizar(db, sesion, modulo) {
    if (!sesion) throw new Error('Iniciá sesión para continuar.');
    const roles = Object.hasOwn(permisos, modulo) ? permisos[modulo] : null;
    if (!roles) throw new Error('Módulo no autorizado.');
    const marcadores = roles.map(() => '?').join(', ');
    const [usuarios] = await db.execute(
        `SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND rol IN (${marcadores}) AND estado = 'Activo'`,
        [sesion.id_usuario, ...roles],
    );
    if (!usuarios.length) throw new Error('Se requiere una sesión activa con permisos para este módulo.');
}

module.exports = { autorizar };

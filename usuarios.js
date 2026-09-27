// Importa las herramientas para generar una sal y calcular el hash de la clave.
const { randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const derivar = promisify(scrypt);
// Campos visibles de la tabla; se excluye la contraseña.
const columnas =
    'id_usuario, nombre, apellido, identidad, telefono, correo, direccion, nombre_usuario, rol, estado';

// Verifica los permisos antes de consultar o modificar usuarios.
async function comprobarAdministrador(db, sesion) {
    if (!sesion) throw new Error('Iniciá sesión para continuar.');
    const [filas] = await db.execute(
        "SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND rol = 'Administrador' AND estado = 'Activo'",
        [sesion.id_usuario],
    );
    if (!filas.length)
        throw new Error('Solo un administrador activo puede administrar usuarios.');
}

// Devuelve los datos de los usuarios sin incluir sus contraseñas.
async function listar(db, sesion) {
    await comprobarAdministrador(db, sesion);
    const [filas] = await db.execute(
        `SELECT ${columnas} FROM usuarios ORDER BY id_usuario`,
    );
    return filas;
}

// Valida los datos y decide si debe insertar un usuario o actualizar uno existente.
async function guardar(db, sesion, datos) {
    await comprobarAdministrador(db, sesion);
    if (!datos || typeof datos !== 'object') throw new Error('Datos inválidos.');
    // El ID identifica una edición; si no se recibe, se creará una cuenta.
    const id = datos.id_usuario;
    if (id != null && (!Number.isSafeInteger(id) || id < 1))
        throw new Error('Usuario inválido.');
    // Valida los campos según el tamaño permitido en la base de datos.
    const limites = {
        nombre: 100,
        apellido: 100,
        identidad: 20,
        telefono: 20,
        correo: 150,
        direccion: 255,
        nombre_usuario: 50,
    };
    const valores = {};
    for (const [campo, limite] of Object.entries(limites)) {
        if (typeof datos[campo] !== 'string' || datos[campo].trim().length > limite)
            throw new Error(`Revisá el campo ${campo}.`);
        valores[campo] = datos[campo].trim() || null;
    }
    // Comprueba los campos obligatorios, el correo y los valores permitidos.
    if (!valores.nombre || !valores.apellido || !valores.nombre_usuario)
        throw new Error('Nombre, apellido y usuario son obligatorios.');
    if (valores.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.correo))
        throw new Error('El correo no es válido.');
    if (
        !['Administrador', 'Cajero'].includes(datos.rol) ||
        !['Activo', 'Inactivo'].includes(datos.estado)
    )
        throw new Error('Rol o estado inválidos.');
    if (
        // Protege el acceso del administrador a su propia cuenta.
        id === sesion.id_usuario &&
        (datos.rol !== 'Administrador' || datos.estado !== 'Activo')
    )
        throw new Error(
            'No podés desactivar tu cuenta ni quitarte el rol de administrador.',
        );
    if (
        // Exige una clave de 8 a 1024 caracteres al crear o cambiar la contraseña.
        typeof datos.contrasena !== 'string' ||
        datos.contrasena.length > 1024 ||
        ((!id || datos.contrasena) && datos.contrasena.length < 8)
    )
        throw new Error('La contraseña debe tener entre 8 y 1024 caracteres.');
    valores.rol = datos.rol;
    valores.estado = datos.estado;
    // Una contraseña vacía al editar conserva el hash existente.
    if (datos.contrasena) {
        const sal = randomBytes(16).toString('hex');
        valores.contrasena = `${sal}:${(await derivar(datos.contrasena, sal, 64)).toString('hex')}`;
    }
    // Comprueba que el registro que se intenta editar todavía exista.
    if (id) {
        const [existentes] = await db.execute(
            'SELECT id_usuario FROM usuarios WHERE id_usuario = ?',
            [id],
        );
        if (!existentes.length) throw new Error('El usuario ya no existe.');
    }
    // Actualiza el usuario seleccionado o registra uno nuevo.
    const campos = Object.keys(valores);
    try {
        if (id) {
            await db.execute(
                `UPDATE usuarios SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE id_usuario = ?`,
                [...Object.values(valores), id],
            );
        } else {
            await db.execute(
                `INSERT INTO usuarios (${campos.join(', ')}) VALUES (${campos.map(() => '?').join(', ')})`,
                Object.values(valores),
            );
        }
    // Traduce los duplicados de campos únicos a un mensaje para el usuario.
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY')
            throw new Error('El usuario, la identidad o el correo ya están registrados.');
        throw error;
    }
}

// Publica las operaciones que atiende main.js.
module.exports = { listar, guardar };

// Importa las herramientas para calcular y comparar hashes.
const { scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
// Convierte scrypt en una función que se puede esperar con await.
const derivar = promisify(scrypt);

// Comprueba el formato sal:hash y compara el hash calculado con el guardado.
async function verificarContrasena(contrasena, almacenada) {
    if (
        typeof almacenada !== 'string' ||
        !/^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(almacenada)
    )
        return false;
    // Separa la sal y deriva una clave de 64 bytes con los mismos parámetros.
    const [sal, hash] = almacenada.split(':');
    const calculado = await derivar(contrasena, sal, 64);
    return timingSafeEqual(calculado, Buffer.from(hash, 'hex'));
}

// Valida las credenciales recibidas antes de consultar la base de datos.
async function autenticar(db, usuario, contrasena) {
    if (
        typeof usuario !== 'string' ||
        typeof contrasena !== 'string' ||
        !usuario.trim() ||
        usuario.length > 50 ||
        !contrasena ||
        contrasena.length > 1024
    )
        return null;
    // El signo ? recibe el usuario como parámetro; solo se buscan cuentas activas.
    const [filas] = await db.execute(
        "SELECT id_usuario, nombre, apellido, nombre_usuario, contrasena, rol FROM usuarios WHERE nombre_usuario = ? AND estado = 'Activo' LIMIT 1",
        [usuario.trim()],
    );
    // Rechaza cuentas inexistentes y contraseñas que no coinciden.
    const registro = filas[0];
    if (!registro || !(await verificarContrasena(contrasena, registro.contrasena)))
        return null;
    // Excluye el hash de la respuesta que se envía a la pantalla.
    const { contrasena: omitida, ...user } = registro;
    return user;
}

// Permite que otros archivos utilicen estas funciones.
module.exports = { autenticar, verificarContrasena };

// Importa Electron, la base de datos y las funciones de acceso.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const db = require('./database');
const { autenticar } = require('./auth');
const usuarios = require('./usuarios');
const compras = require('./compras-servicio');
const medicamentos = require('./medicamentos-servicio');
const ventas = require('./ventas-servicios');

for (const operacion of ['cargar', 'listar', 'guardar', 'factura']) {
    ipcMain.handle(`ventas:${operacion}`, async (_evento, datos) => {
        try {
            return { datos: await ventas[operacion](db, usuarioActivo, datos) };
        } catch (error) {
            console.error(`ventas:${operacion}`, error.code || error.message);
            return { error: error.code ? 'No se pudo procesar la venta. Revisa MySQL y ejecuta npm run migrar.' : error.message };
        }
    });
}

// Conserva el usuario conectado en memoria mientras la app permanece abierta.
let usuarioActivo = null;


// Recibe las credenciales desde el puente y valida el acceso en MySQL.
ipcMain.handle('login', async (_evento, usuario, contrasena) => {

    usuarioActivo = null;

    try {

        usuarioActivo = await autenticar(db, usuario, contrasena);

        return usuarioActivo
            ? { usuario: usuarioActivo }
            : { error: 'Usuario o contrasena incorrectos, o usuario inactivo.' };

    } catch (error) {

        console.error('Error de conexion:', error.code);

        return {
            error: 'No se pudo consultar MySQL. Revisa el servidor, la base JosueFarma y la configuración de database.js.',
        };

    }

});


// Borra la cuenta activa para cerrar la sesion.
ipcMain.handle('logout', () => {

    usuarioActivo = null;

});


// Recupera los datos actuales del usuario y comprueba que siga activo.
ipcMain.handle('session:get', async () => {

    if (!usuarioActivo) return { usuario: null };

    try {

        const [filas] = await db.execute(
            "SELECT id_usuario, nombre, apellido, nombre_usuario, rol FROM usuarios WHERE id_usuario = ? AND estado = 'Activo'",
            [usuarioActivo.id_usuario],
        );

        usuarioActivo = filas[0] || null;

        return { usuario: usuarioActivo };

    } catch {

        return {
            error: 'No se pudo recuperar la sesion. Revisa la conexion a MySQL.'
        };

    }

});


// Registra los canales para listar y guardar usuarios.
for (const operacion of ['listar', 'guardar']) {

    ipcMain.handle(`usuarios:${operacion}`, async (_evento, datos) => {

        try {

            const resultado = await usuarios[operacion](
                db,
                usuarioActivo,
                datos
            );

            return { datos: resultado };

        } catch (error) {

            return {
                error: error.code
                    ? 'No se pudo consultar MySQL. Revisa la conexion e intenta nuevamente.'
                    : error.message,
            };

        }

    });

}


// Registra los canales para compras.
for (const operacion of [
    'cargar',
    'guardar',
    'lotes',
    'registrarMedicamento'
]) {

    ipcMain.handle(`compras:${operacion}`, async (_evento, datos) => {

        try {

            return {
                datos: await compras[operacion](
                    db,
                    usuarioActivo,
                    datos
                )
            };

        } catch (error) {

            return {
                error: error.code
                    ? `No se pudo completar la operación de compras (${error.code}). Revisa la conexión y ejecuta npm run migrar si la base está desactualizada.`
                    : error.message
            };

        }

    });

}


// Registra los canales del modulo de medicamentos.
for (const operacion of [
    'listar',
    'lotes',
    'actualizar'
]) {

    ipcMain.handle(`medicamentos:${operacion}`, async (_evento, datos) => {

        try {

            return {
                datos: await medicamentos[operacion](
                    db,
                    usuarioActivo,
                    datos
                )
            };

        } catch (error) {

            return {
                error: error.message
            };

        }

    });

}


function crearVentana() {

    const ventana = new BrowserWindow({

        width: 1100,
        height: 760,
        minWidth: 720,
        minHeight: 560,

        autoHideMenuBar: true,

        title: 'Farmacia Josue',

        webPreferences: {

            preload: path.join(__dirname, 'puente.js'),

            nodeIntegration: false,

            contextIsolation: true,

        },

    });


    ventana.loadFile('index.html');

    ventana.webContents.setWindowOpenHandler(() => ({
        action: 'deny'
    }));

}


// Inicia la ventana cuando Electron esta listo.
app.whenReady().then(() => {

    crearVentana();

    app.on('activate', () => {

        if (BrowserWindow.getAllWindows().length === 0)
            crearVentana();

    });

});


// Cierra el programa al cerrar todas las ventanas.
app.on('window-all-closed', () => {

    if (process.platform !== 'darwin')
        app.quit();

});

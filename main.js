// Importa Electron, la base de datos y las funciones de acceso.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const db = require('./database');
const { autenticar } = require('./auth');
const usuarios = require('./usuarios');
// Conserva el usuario conectado en memoria mientras la app permanece abierta.
let usuarioActivo = null;

// Recibe las credenciales desde el puente y valida el acceso en MySQL.
ipcMain.handle('login', async (_evento, usuario, contrasena) => {
    usuarioActivo = null;
    try {
        usuarioActivo = await autenticar(db, usuario, contrasena);
        return usuarioActivo
            ? { usuario: usuarioActivo }
            : { error: 'Usuario o contraseña incorrectos, o usuario inactivo.' };
    } catch (error) {
        console.error('Error de conexión:', error.code);
        return {
            error: 'No se pudo consultar MySQL. Revisá el servidor, la base JosueFarma y la configuración de database.js.',
        };
    }
});

// Borra la cuenta activa para cerrar la sesión.
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
        return { error: 'No se pudo recuperar la sesión. Revisá la conexión a MySQL.' };
    }
});

// Registra los canales para listar y guardar usuarios; el servicio verifica permisos.
for (const operacion of ['listar', 'guardar']) {
    ipcMain.handle(`usuarios:${operacion}`, async (_evento, datos) => {
        try {
            const resultado = await usuarios[operacion](db, usuarioActivo, datos);
            return { datos: resultado };
        } catch (error) {
            return {
                error: error.code
                    ? 'No se pudo consultar MySQL. Revisá la conexión e intentá nuevamente.'
                    : error.message,
            };
        }
    });
}

// Configura el tamaño de la ventana y conecta puente.js con las pantallas.
function crearVentana() {
    const ventana = new BrowserWindow({
        width: 1100,
        height: 760,
        minWidth: 720,
        minHeight: 560,
        autoHideMenuBar: true,
        title: 'Farmacia Josué',
        webPreferences: {
            preload: path.join(__dirname, 'puente.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    // Abre el login y bloquea la apertura de ventanas adicionales.
    ventana.loadFile('index.html');
    ventana.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

// Inicia la ventana cuando Electron está listo; en macOS permite volver a abrirla.
app.whenReady().then(() => {
    crearVentana();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) crearVentana();
    });
});

// Cierra el programa al cerrar todas las ventanas, excepto en macOS.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

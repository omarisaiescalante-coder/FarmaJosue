// Carga el puente seguro y el cliente de mensajes de Electron.
const { contextBridge, ipcRenderer } = require('electron');
async function solicitarProveedor(operacion, datos) {
    try { return await ipcRenderer.invoke(`proveedores:${operacion}`, datos); }
    catch (error) {
        if (/No handler registered/.test(error.message)) return { error: 'La aplicación sigue ejecutando una versión anterior. Cerrá todas sus ventanas y volvé a abrirla con npm start para activar Laboratorios y proveedores.' };
        return { error: 'No se pudo comunicar con el módulo de proveedores. Reiniciá la aplicación.' };
    }
}

// Expone window.farmacia: las pantallas solo pueden solicitar estas operaciones.
contextBridge.exposeInMainWorld('farmacia', {
    // Envía usuario y contraseña al proceso principal para verificar el acceso.
    iniciarSesion: (usuario, contrasena) =>
        ipcRenderer.invoke('login', usuario, contrasena),

    // Solicita borrar la sesión guardada en memoria.
    cerrarSesion: () => ipcRenderer.invoke('logout'),

    // Consulta la sesión al entrar a otra pantalla.
    obtenerSesion: () => ipcRenderer.invoke('session:get'),

    // Solicita la lista de usuarios sin contraseñas.
    listarUsuarios: () => ipcRenderer.invoke('usuarios:listar'),

    // Envía los datos del formulario para crear o actualizar un usuario.
    guardarUsuario: (datos) => ipcRenderer.invoke('usuarios:guardar', datos),

    // Compras
    cargarCompras: () => ipcRenderer.invoke('compras:cargar'),
    listarProveedores: () => solicitarProveedor('listar'),
    guardarProveedor: datos => solicitarProveedor('guardar', datos),
    eliminarProveedor: id => solicitarProveedor('eliminar', id),
    guardarCompra: (datos) => ipcRenderer.invoke('compras:guardar', datos),
    listarLotesCompra: (id) => ipcRenderer.invoke('compras:lotes', id),
    registrarMedicamento: (datos) =>
        ipcRenderer.invoke('compras:registrarMedicamento', datos),

    // Medicamentos
    listarMedicamentos: () => ipcRenderer.invoke('medicamentos:listar'),
    verLotesMedicamento: (id) => ipcRenderer.invoke('medicamentos:lotes', id),
    actualizarMedicamento: (datos) =>
        ipcRenderer.invoke('medicamentos:actualizar', datos),

    // Ventas (tu módulo)
    cargarVentas: () => ipcRenderer.invoke('ventas:cargar'),
    listarVentas: () => ipcRenderer.invoke('ventas:listar'),
    resumenVentas: () => ipcRenderer.invoke('ventas:resumen'),
    guardarVenta: (datos) => ipcRenderer.invoke('ventas:guardar', datos),
    obtenerFactura: (id) => ipcRenderer.invoke('ventas:factura', id),
});

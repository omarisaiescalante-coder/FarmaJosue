// Carga el puente seguro y el cliente de mensajes de Electron.
const { contextBridge, ipcRenderer } = require('electron');

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
});

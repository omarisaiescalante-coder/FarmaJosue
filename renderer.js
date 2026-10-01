// Login conectado a MySQL mediante el proceso principal de Electron.
// Obtiene los elementos del login y el panel para mostrar u ocultar cada vista.
const login = document.getElementById('login');
const panel = document.getElementById('panel');
const formulario = document.getElementById('login-form');
const error = document.getElementById('error-login');
let sesionActual = null;
// Muestra la bienvenida y mueve el foco al título principal.
function mostrarInicio() {
    document.getElementById('bienvenida').hidden = false;
    document.title = 'Panel principal | Farmacia Josué';
    document.getElementById('panel-titulo').focus();
}

// Intercepta el formulario y solicita el inicio de sesión sin recargar la página.
formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const boton = formulario.querySelector('button');
    if (boton.disabled) return;
    const usuario = document.getElementById('usuario').value.trim();
    const contrasena = document.getElementById('contrasena');
    // Deshabilita el botón mientras espera para evitar solicitudes repetidas.
    boton.disabled = true;
    boton.textContent = 'Verificando...';
    error.hidden = true;
    try {
        if (!window.farmacia)
            throw new Error('Abrí la aplicación con npm start para conectar a MySQL.');
        const resultado = await window.farmacia.iniciarSesion(usuario, contrasena.value);
        if (resultado.error) throw new Error(resultado.error);
        // Muestra el nombre y rol; el acceso a Usuarios se ofrece a administradores.
        sesionActual = resultado.usuario;
        document.getElementById('abrir-usuarios').hidden =
            sesionActual.rol !== 'Administrador';
        document.getElementById('sesion-nombre').textContent =
            resultado.usuario.nombre + ' ' + resultado.usuario.apellido;
        document.getElementById('sesion-rol').textContent = resultado.usuario.rol;
        formulario.reset();
        login.hidden = true;
        panel.hidden = false;
        mostrarInicio();
    // Muestra el error; finally vuelve a habilitar el botón aunque falle el acceso.
    } catch (problema) {
        error.textContent = problema.message || 'No se pudo iniciar sesión.';
        error.hidden = false;
        contrasena.focus();
        contrasena.select();
    } finally {
        boton.disabled = false;
        boton.textContent = 'Iniciar sesión';
    }
});

// Oculta el error anterior cuando se corrigen las credenciales.
formulario.addEventListener('input', () => {
    error.hidden = true;
});
// El nombre de la farmacia lleva de nuevo al panel de bienvenida.
document.getElementById('inicio').addEventListener('click', (evento) => {
    evento.preventDefault();
    mostrarInicio();
});
// Cierra la sesión, limpia los datos visibles y vuelve al login.
document.getElementById('salir').addEventListener('click', async () => {
    await window.farmacia.cerrarSesion();
    sesionActual = null;
    document.getElementById('abrir-usuarios').hidden = true;
    document.getElementById('sesion-nombre').textContent = '';
    document.getElementById('sesion-rol').textContent = '';
    panel.hidden = true;
    login.hidden = false;
    formulario.reset();
    error.hidden = true;
    document.title = 'Farmacia Josué';
    document.getElementById('usuario').focus();
});

// El proceso principal conserva la sesión al cambiar de página.
// Navega a la página independiente del módulo de usuarios.
document.getElementById('abrir-usuarios').addEventListener('click', () => {
    window.location.href = 'usuarios.html';
});
document.getElementById('abrir-compras').addEventListener('click', () => {
    window.location.href = 'compras.html';
});
const botonVentas = document.getElementById('abrir-ventas');
if (botonVentas) {
    botonVentas.addEventListener('click', () => {
        window.location.href = 'ventas.html';
    });
}
// Navega a la página independiente del módulo de facturas.
const botonFacturas = document.getElementById('abrir-facturas');
if (botonFacturas) {
    botonFacturas.addEventListener('click', () => {
        window.location.href = 'facturas.html';
    });
}

// Restaura el panel al volver de Usuarios sin pedir otra vez la contraseña.
async function recuperarSesion() {
    if (!window.farmacia) return;
    const boton = formulario.querySelector('button');
    boton.disabled = true;
    try {
        const resultado = await window.farmacia.obtenerSesion();
        if (resultado.error) throw new Error(resultado.error);
        if (!resultado.usuario) return;
        sesionActual = resultado.usuario;
        document.getElementById('abrir-usuarios').hidden =
            sesionActual.rol !== 'Administrador';
        document.getElementById('sesion-nombre').textContent =
            sesionActual.nombre + ' ' + sesionActual.apellido;
        document.getElementById('sesion-rol').textContent = sesionActual.rol;
        login.hidden = true;
        panel.hidden = false;
        mostrarInicio();
    } catch (problema) {
        error.textContent = problema.message;
        error.hidden = false;
    } finally {
        boton.disabled = false;
    }
}
// Comprueba si hay una sesión al cargar index.html.
recuperarSesion();

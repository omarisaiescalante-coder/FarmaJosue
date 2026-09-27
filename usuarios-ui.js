// Interfaz sencilla del módulo. Las consultas y permisos se resuelven en Electron.
// Estado de la pantalla: sesión, formulario, lista y usuario seleccionado.
let sesionActual = null;
const formUsuario = document.getElementById('usuarios-form');
const mensajeUsuarios = document.getElementById('usuarios-mensaje');
let usuariosRegistrados = [];
let usuarioEditado = null;
// Identifica solicitudes vigentes para ignorar respuestas antiguas al recargar o salir.
let versionUsuarios = 0;
// Evita guardar dos veces o cambiar de registro durante un guardado.
let guardandoUsuario = false;

// Vacía el formulario y vuelve al modo de crear usuario.
function limpiarUsuario() {
    usuarioEditado = null;
    formUsuario.reset();
    formUsuario.elements.contrasena.required = true;
    document.getElementById('usuario-form-titulo').textContent = 'Nuevo usuario';
}

// Filtra la lista por el texto buscado y vuelve a construir las filas de la tabla.
function dibujarUsuarios() {
    const cuerpo = document.getElementById('usuarios-filas');
    cuerpo.replaceChildren();
    const busqueda = document.getElementById('buscar-usuario').value.trim().toLowerCase();
    for (const usuario of usuariosRegistrados.filter((u) =>
        `${u.nombre} ${u.apellido} ${u.nombre_usuario} ${u.identidad || ''}`
            .toLowerCase()
            .includes(busqueda),
    )) {
        // Crea las celdas usando textContent para mostrar los datos como texto.
        const fila = document.createElement('tr');
        for (const valor of [
            usuario.id_usuario,
            `${usuario.nombre} ${usuario.apellido}`,
            usuario.nombre_usuario,
            usuario.rol,
            usuario.estado,
        ]) {
            const celda = document.createElement('td');
            celda.textContent = valor;
            fila.append(celda);
        }
        const acciones = document.createElement('td');
        const editar = document.createElement('button');
        editar.type = 'button';
        editar.textContent = 'Editar';
        // Carga los datos del registro en el formulario; la contraseña queda vacía.
        editar.addEventListener('click', () => {
            if (guardandoUsuario) return;
            limpiarUsuario();
            usuarioEditado = usuario.id_usuario;
            for (const campo of [
                'nombre',
                'apellido',
                'identidad',
                'telefono',
                'correo',
                'direccion',
                'nombre_usuario',
                'rol',
                'estado',
            ])
                formUsuario.elements[campo].value = usuario[campo] || '';
            formUsuario.elements.contrasena.required = false;
            document.getElementById('usuario-form-titulo').textContent =
                `Editar usuario: ${usuario.nombre_usuario}`;
            mensajeUsuarios.textContent = '';
            formUsuario.elements.nombre.focus();
        });
        acciones.append(editar);
        fila.append(acciones);
        cuerpo.append(fila);
    }
    // Muestra un aviso cuando no hay registros o coincidencias.
    if (!cuerpo.children.length) {
        const fila = document.createElement('tr');
        const celda = document.createElement('td');
        celda.colSpan = 6;
        celda.textContent = 'No hay usuarios para mostrar.';
        fila.append(celda);
        cuerpo.append(fila);
    }
}

// Pide la lista al proceso principal y presenta los resultados o el error.
async function cargarUsuarios() {
    const version = ++versionUsuarios;
    mensajeUsuarios.textContent = 'Cargando usuarios...';
    try {
        const resultado = await window.farmacia.listarUsuarios();
        if (version !== versionUsuarios) return;
        if (resultado.error) throw new Error(resultado.error);
        usuariosRegistrados = resultado.datos;
        dibujarUsuarios();
        mensajeUsuarios.textContent = '';
    } catch (error) {
        if (version !== versionUsuarios) return;
        usuariosRegistrados = [];
        dibujarUsuarios();
        mensajeUsuarios.textContent = error.message;
    }
}

// Regresa al panel conservando la sesión del proceso principal.
document.getElementById('volver-inicio').addEventListener('click', () => {
    window.location.href = 'index.html';
});
// Cancela la edición y limpia los campos.
document.getElementById('cancelar-usuario').addEventListener('click', limpiarUsuario);
// Actualiza el filtro a medida que se escribe.
document.getElementById('buscar-usuario').addEventListener('input', dibujarUsuarios);
// Consulta nuevamente la base de datos al pulsar Actualizar lista.
document.getElementById('recargar-usuarios').addEventListener('click', cargarUsuarios);
// Descarta las respuestas pendientes, limpia la vista y cierra la sesión.
document.getElementById('salir').addEventListener('click', async () => {
    ++versionUsuarios;
    usuariosRegistrados = [];
    limpiarUsuario();
    document.getElementById('buscar-usuario').value = '';
    document.getElementById('usuarios-filas').replaceChildren();
    mensajeUsuarios.textContent = '';
    await window.farmacia.cerrarSesion();
    window.location.replace('index.html');
});
// Recoge los campos del formulario y envía un alta o una edición.
formUsuario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (guardandoUsuario) return;
    guardandoUsuario = true;
    // FormData convierte los campos con name en datos; un ID nulo indica un alta.
    const datos = Object.fromEntries(new FormData(formUsuario));
    datos.id_usuario = usuarioEditado;
    const version = versionUsuarios;
    // Bloquea los campos durante el guardado para evitar cambios a mitad de la solicitud.
    const controles = [...formUsuario.elements];
    controles.forEach((control) => {
        control.disabled = true;
    });
    mensajeUsuarios.textContent = 'Guardando...';
    try {
        const resultado = await window.farmacia.guardarUsuario(datos);
        if (version !== versionUsuarios) return;
        if (resultado.error) throw new Error(resultado.error);
        // Si editamos nuestra cuenta, actualiza también el nombre de la cabecera.
        if (usuarioEditado === sesionActual.id_usuario) {
            document.getElementById('sesion-nombre').textContent =
                `${datos.nombre.trim()} ${datos.apellido.trim()}`;
        }
        limpiarUsuario();
        await cargarUsuarios();
        if (!mensajeUsuarios.textContent)
            mensajeUsuarios.textContent = 'Usuario guardado correctamente.';
    } catch (error) {
        if (version === versionUsuarios) mensajeUsuarios.textContent = error.message;
    // Habilita de nuevo los controles tanto si se guardó como si hubo un error.
    } finally {
        guardandoUsuario = false;
        controles.forEach((control) => {
            control.disabled = false;
        });
    }
});

// Comprueba la sesión y el rol antes de mostrar el módulo y cargar sus datos.
async function iniciarUsuarios() {
    try {
        if (!window.farmacia) {
            window.location.replace('index.html');
            return;
        }
        const resultado = await window.farmacia.obtenerSesion();
        if (resultado.error) throw new Error(resultado.error);
        sesionActual = resultado.usuario;
        if (!sesionActual || sesionActual.rol !== 'Administrador') {
            window.location.replace('index.html');
            return;
        }
        document.getElementById('sesion-nombre').textContent =
            sesionActual.nombre + ' ' + sesionActual.apellido;
        document.getElementById('sesion-rol').textContent = sesionActual.rol;
        document.getElementById('sesion-mensaje').hidden = true;
        document.getElementById('pagina-usuarios').hidden = false;
        document.getElementById('usuarios-titulo').focus();
        await cargarUsuarios();
    } catch (error) {
        const mensaje = document.getElementById('sesion-mensaje');
        mensaje.textContent = error.message + ' ';
        const volver = document.createElement('a');
        volver.href = 'index.html';
        volver.textContent = 'Volver al inicio';
        mensaje.append(volver);
    }
}
// Ejecuta la comprobación inicial al abrir usuarios.html.
iniciarUsuarios();

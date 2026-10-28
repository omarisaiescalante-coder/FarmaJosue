// Login conectado a MySQL mediante el proceso principal de Electron.
// Obtiene los elementos del login y el panel para mostrar u ocultar cada vista.
const login = document.getElementById('login');
const panel = document.getElementById('panel');
const formulario = document.getElementById('login-form');
const error = document.getElementById('error-login');
let sesionActual = null;
const recordarUsuario = document.getElementById('rememberUser');
const verContrasena = document.getElementById('togglePassword');
function mostrarContrasena(visible) {
    document.getElementById('contrasena').type = visible ? 'text' : 'password';
    verContrasena.querySelector('.ojo-tachado').toggleAttribute('hidden', !visible);
    verContrasena.setAttribute('aria-pressed', String(visible));
    verContrasena.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
    verContrasena.title = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';
}
function cargarUsuarioRecordado() {
    let usuario = '';
    try { usuario = localStorage.getItem('usuarioRecordado') || ''; } catch {}
    document.getElementById('usuario').value = usuario;
    recordarUsuario.checked = Boolean(usuario);
    document.getElementById(usuario ? 'contrasena' : 'usuario').focus();
}
verContrasena.addEventListener('click', () => {
    mostrarContrasena(document.getElementById('contrasena').type === 'password');
    document.getElementById('contrasena').focus();
});
recordarUsuario.addEventListener('change', () => {
    if (!recordarUsuario.checked) {
        try { localStorage.removeItem('usuarioRecordado'); } catch {}
    }
});
cargarUsuarioRecordado();
// Muestra la bienvenida y mueve el foco al título principal.
function mostrarInicio() {
    document.getElementById('bienvenida').hidden = false;
    const accesos = {
        usuarios: ['Administrador'],
        medicamentos: ['Administrador', 'Cajero', 'Dispensador'],
        compras: ['Administrador', 'Dispensador'],
        ventas: ['Administrador', 'Cajero'],
        facturas: ['Administrador', 'Cajero'],
    };
    for (const [modulo, roles] of Object.entries(accesos)) {
        document.getElementById(`abrir-${modulo}`).hidden = !roles.includes(sesionActual.rol);
    }
    const puedeVerVentas = accesos.ventas.includes(sesionActual.rol);
    document.querySelector('.tarjeta-total-ventas').hidden = !puedeVerVentas;
    document.querySelector('.ventas-resumen-grid').hidden = !puedeVerVentas;
    const hoy = new Date();
    const hora = Number(new Intl.DateTimeFormat('es-HN', { timeZone: 'America/Tegucigalpa', hour: 'numeric', hourCycle: 'h23' }).format(hoy));
    const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
    document.getElementById('panel-titulo').textContent = `${saludo}, ${sesionActual.nombre}`;
    document.getElementById('dashboard-fecha').textContent = new Intl.DateTimeFormat('es-HN', { timeZone: 'America/Tegucigalpa', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(hoy);
    if (puedeVerVentas) cargarTotalVentas();
    document.title = 'Panel principal | Farmacia Josué';
    document.getElementById('panel-titulo').focus();
}

let consultaVentas = 0;
async function cargarTotalVentas() {
    const consulta = ++consultaVentas;
    const total = document.getElementById('dashboard-total-ventas');
    const mensaje = document.getElementById('dashboard-ventas-mensaje');
    total.textContent = 'Cargando…';
    mensaje.textContent = 'Consultando ventas registradas';
    document.getElementById('dashboard-ventas-dia').textContent = 'Cargando…';
    document.getElementById('dashboard-ventas-dia-mensaje').textContent = 'Consultando las ventas de hoy';
    document.getElementById('ventas-semana-total').textContent = 'Cargando…';
    document.getElementById('ventas-semana-mensaje').textContent = '';
    document.getElementById('ventas-semana-grafico').replaceChildren();
    try {
        const resultado = await window.farmacia.resumenVentas();
        if (consulta !== consultaVentas || !sesionActual) return;
        if (resultado.error) throw new Error(resultado.error);
        total.textContent = 'L ' + new Intl.NumberFormat('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(resultado.datos.total));
        mensaje.textContent = `${resultado.datos.cantidad} ventas completadas · Acumulado histórico`;
        const hoy = resultado.datos.semana.at(-1);
        document.getElementById('dashboard-ventas-dia').textContent = 'L ' + new Intl.NumberFormat('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(hoy.total);
        document.getElementById('dashboard-ventas-dia-mensaje').textContent = `${hoy.cantidad} ventas completadas · Hoy`;
        dibujarVentasSemana(resultado.datos.semana);
    } catch (problema) {
        if (consulta !== consultaVentas || !sesionActual) return;
        total.textContent = 'No disponible';
        document.getElementById('dashboard-ventas-dia').textContent = 'No disponible';
        document.getElementById('dashboard-ventas-dia-mensaje').textContent = 'No se pudieron consultar las ventas de hoy.';
        mensaje.textContent = 'No se pudo consultar el total. Volvé a entrar al panel para reintentar.';
        document.getElementById('ventas-semana-total').textContent = 'No disponible';
        document.getElementById('ventas-semana-mensaje').textContent = 'No se pudieron cargar las estadísticas.';
    }
}

function dibujarVentasSemana(dias) {
    const moneda = valor => 'L ' + new Intl.NumberFormat('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
    const total = dias.reduce((suma, dia) => suma + dia.total, 0);
    const cantidad = dias.reduce((suma, dia) => suma + dia.cantidad, 0);
    document.getElementById('ventas-semana-total').textContent = moneda(total);
    document.getElementById('ventas-semana-mensaje').textContent = `${cantidad} ventas completadas`;
    const grafico = document.getElementById('ventas-semana-grafico');
    grafico.replaceChildren();
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 300 300');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Anillos de ventas diarias: longitud proporcional al día de mayor venta de la semana.');
    const colores = ['#13acc2', '#c5d914', '#62666b', '#13acc2', '#c5d914', '#62666b', '#13acc2'];
    const maximo = Math.max(1, ...dias.map(dia => dia.total));
    const leyenda = document.createElement('div');
    leyenda.className = 'anillos-leyenda';
    dias.forEach((dia, i) => {
        const radio = 133 - i * 16;
        const longitud = 2 * Math.PI * radio;
        const proporcion = dia.total / maximo;
        for (const fondo of [true, false]) {
            if (!fondo && dia.total === 0) continue;
            const circulo = document.createElementNS(ns, 'circle');
            circulo.setAttribute('cx', '150');
            circulo.setAttribute('cy', '150');
            circulo.setAttribute('r', String(radio));
            circulo.setAttribute('fill', 'none');
            circulo.setAttribute('stroke', fondo ? '#edf2f7' : colores[i]);
            circulo.setAttribute('stroke-width', '10');
            circulo.setAttribute('stroke-dasharray', `${longitud * .82 * (fondo ? 1 : proporcion)} ${longitud}`);
            circulo.setAttribute('transform', `rotate(${ -90 + i * 22 } 150 150)`);
            const titulo = document.createElementNS(ns, 'title');
            titulo.textContent = `${dia.fecha}: ${moneda(dia.total)}`;
            circulo.append(titulo);
            svg.append(circulo);
        }
        const fecha = new Date(dia.fecha + 'T12:00:00Z');
        const nombre = new Intl.DateTimeFormat('es-HN', { weekday: 'short', day: 'numeric', timeZone: 'America/Tegucigalpa' }).format(fecha);
        const fila = document.createElement('div');
        const punto = document.createElement('span');
        punto.className = `anillo-color anillo-color-${i % 3}`;
        const etiqueta = document.createElement('span');
        etiqueta.textContent = nombre;
        const monto = document.createElement('strong');
        monto.textContent = moneda(dia.total);
        fila.append(punto, etiqueta, monto);
        leyenda.append(fila);
    });
    grafico.append(svg, leyenda);
}

// Intercepta el formulario y solicita el inicio de sesión sin recargar la página.
formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const boton = formulario.querySelector('button[type="submit"]');
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
        try {
            if (recordarUsuario.checked) localStorage.setItem('usuarioRecordado', usuario);
            else localStorage.removeItem('usuarioRecordado');
        } catch {}
        mostrarContrasena(false);
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
    mostrarContrasena(false);
    cargarUsuarioRecordado();
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
document.getElementById('abrir-medicamentos').addEventListener('click', () => {
    window.location.href = 'medicamentos.html';
});
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
    const boton = formulario.querySelector('button[type="submit"]');
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

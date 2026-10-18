// Navegación compartida por las pantallas internas de la farmacia.
(async function () {
    const principal = document.querySelector('main');
    if (!principal) return;
    const estructura = document.createElement('div');
    estructura.className = 'modulo-layout';
    const lateral = document.createElement('nav');
    lateral.className = 'modulo-navegacion';
    lateral.setAttribute('aria-label', 'Módulos de la farmacia');
    const titulo = document.createElement('h2');
    titulo.textContent = 'Menú';
    lateral.append(titulo);
    const accesos = [
        ['index', 'Inicio', '⌂', null],
        ['usuarios', 'Usuarios', '◎', ['Administrador']],
        ['compras', 'Compras', '▣', ['Administrador', 'Dispensador']],
        ['medicamentos', 'Medicamentos', '✚', ['Administrador', 'Cajero', 'Dispensador']],
        ['ventas', 'Ventas', '▤', ['Administrador', 'Cajero']],
        ['facturas', 'Facturas', '≡', ['Administrador', 'Cajero']],
    ];
    const enlaces = [];
    for (const [modulo, nombre, icono, roles] of accesos) {
        const enlace = document.createElement('a');
        enlace.href = modulo + '.html';
        enlace.hidden = Boolean(roles);
        const simbolo = document.createElement('span');
        simbolo.textContent = icono;
        simbolo.setAttribute('aria-hidden', 'true');
        enlace.append(simbolo, document.createTextNode(nombre));
        if (document.body.dataset.module === modulo) enlace.setAttribute('aria-current', 'page');
        enlaces.push({ enlace, roles });
        lateral.append(enlace);
    }
    principal.before(estructura);
    estructura.append(lateral, principal);
    try {
        const sesion = await window.farmacia.obtenerSesion();
        if (sesion.error || !sesion.usuario) return;
        for (const { enlace, roles } of enlaces) {
            enlace.hidden = Boolean(roles && !roles.includes(sesion.usuario.rol));
        }
    } catch {
        // La pantalla del módulo informa los errores de sesión.
    }
})();

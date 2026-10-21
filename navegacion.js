// Navegación compartida por las pantallas internas de la farmacia.
(async function () {
    const principal = document.querySelector('main');
    if (!principal) return;
    const estructura = document.createElement('div');
    estructura.className = 'modulo-layout modulo-menu-compacto';
    const lateral = document.createElement('nav');
    lateral.className = 'modulo-navegacion';
    lateral.setAttribute('aria-label', 'Módulos de la farmacia');
    lateral.id = 'menuModulos';
    lateral.inert = true;
    const alternar = document.createElement('button');
    alternar.type = 'button';
    alternar.className = 'modulo-menu-alternar';
    alternar.setAttribute('aria-label', 'Mostrar módulos');
    alternar.setAttribute('aria-expanded', 'false');
    alternar.setAttribute('aria-controls', lateral.id);
    alternar.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
    alternar.addEventListener('click', () => {
        const compacto = estructura.classList.toggle('modulo-menu-compacto');
        lateral.inert = compacto;
        alternar.setAttribute('aria-expanded', String(!compacto));
        alternar.setAttribute('aria-label', compacto ? 'Mostrar módulos' : 'Contraer módulos');
    });
    const titulo = document.createElement('h2');
    titulo.textContent = 'Menú';
    lateral.append(titulo);
    const iconos = {
    "index": "<svg viewBox=\"0 0 24 24\" focusable=\"false\"><path d=\"m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8\"/></svg>",
    "usuarios": "<svg viewBox=\"0 0 24 24\" focusable=\"false\"><circle cx=\"9\" cy=\"8\" r=\"3\"/><path d=\"M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5\"/></svg>",
    "compras": "<svg viewBox=\"0 0 24 24\" focusable=\"false\"><path d=\"M3 3h2l2 12h11l3-9H6\"/><circle cx=\"9\" cy=\"20\" r=\"1\"/><circle cx=\"18\" cy=\"20\" r=\"1\"/></svg>",
    "medicamentos": "<svg viewBox=\"0 0 24 24\" focusable=\"false\"><path d=\"m9 15 6-6M5 19a5 5 0 0 1 0-7l7-7a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7 0Z\"/></svg>",
    "ventas": "<svg viewBox=\"0 0 24 24\" focusable=\"false\"><path d=\"M4 20h16M5 15l5-5 4 3 6-8M14 5h6v6\"/></svg>",
    "facturas": "<svg viewBox=\"0 0 24 24\" focusable=\"false\"><path d=\"M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 7h6M9 11h6M9 15h3\"/></svg>"
};
    const accesos = [
        ['index', 'Inicio', '⌂', null],
        ['usuarios', 'Usuarios', '◎', ['Administrador']],
        ['compras', 'Compras', '▣', ['Administrador', 'Dispensador']],
        ['medicamentos', 'Medicamentos', '✚', ['Administrador', 'Cajero', 'Dispensador']],
        ['ventas', 'Ventas', '▤', ['Administrador', 'Cajero']],
        ['facturas', 'Facturas', '≡', ['Administrador', 'Cajero']],
    ];
    const enlaces = [];
    for (const [modulo, nombre, , roles] of accesos) {
        const enlace = document.createElement('a');
        enlace.href = modulo + '.html';
        enlace.hidden = Boolean(roles);
        const simbolo = document.createElement('span');
        simbolo.innerHTML = iconos[modulo];
        simbolo.setAttribute('aria-hidden', 'true');
        const etiqueta = document.createElement('span');
        etiqueta.className = 'modulo-menu-etiqueta';
        etiqueta.textContent = nombre;
        enlace.title = nombre;
        enlace.setAttribute('aria-label', nombre);
        enlace.append(simbolo, etiqueta);
        if (document.body.dataset.module === modulo) enlace.setAttribute('aria-current', 'page');
        enlaces.push({ enlace, roles });
        lateral.append(enlace);
    }
    principal.before(estructura);
    const cabecera = document.querySelector('header.cabecera, nav.navbar');
    if (cabecera) {
        cabecera.classList.add('modulo-cabecera');
        cabecera.prepend(alternar);
    } else {
        estructura.append(alternar);
    }
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

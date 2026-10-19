// Componente independiente; los valores del servicio se insertan como texto, nunca HTML.
(() => {
    const crear = (tag, texto, clase) => {
        const nodo = document.createElement(tag);
        if (texto !== undefined) nodo.textContent = texto;
        if (clase) nodo.className = clase;
        return nodo;
    };
    const boton = texto => {
        const nodo = crear('button', texto, 'btn btn-outline-success btn-sm');
        nodo.type = 'button';
        return nodo;
    };
    const modal = crear('dialog', undefined, 'inventario-lotes');
    modal.setAttribute('aria-labelledby', 'inventarioTitulo');
    const cabecera = crear('header', undefined, 'inventario-cabecera');
    const titulos = crear('div');
    const titulo = crear('h2', 'Inventario de Lotes');
    titulo.id = 'inventarioTitulo';
    titulos.append(titulo, crear('p', 'Consulta los lotes y despliega sus medicamentos.'));
    const cerrar = boton('Cerrar');
    cabecera.append(titulos, cerrar);
    const contenido = crear('div', undefined, 'inventario-contenido');
    contenido.setAttribute('aria-live', 'polite');
    const pie = crear('footer', undefined, 'inventario-pie');
    const regresar = boton('Regresar a Compras');
    pie.append(regresar);
    modal.append(cabecera, contenido, pie);
    document.body.append(modal);
    let version = 0;
    let origen;
    let posicionOrigen = 0;
    let isModalMode = false;
    // Una ?nica plantilla se mueve entre la p?gina y el dialog; no se duplican tablas ni eventos.
    const pagina = document.getElementById('vistaInventarioLotes');
    cerrar.onclick = regresar.onclick = () => {
        if (isModalMode) modal.close();
        else {
            version++; // Descarta respuestas pendientes despu?s de abandonar la p?gina.
            window.inventarioCompras.mostrarRegistro();
        }
    };
    modal.addEventListener('close', () => {
        version++;
        origen?.focus({ preventScroll: true });
        window.scrollTo(0, posicionOrigen);
    });
    const dinero = valor => valor === null || valor === undefined || valor === '' ? '—' :
        new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(Number(valor));
    function tabla(encabezados) {
        const nodo = crear('table', undefined, 'inventario-tabla');
        const fila = nodo.createTHead().insertRow();
        encabezados.forEach(texto => {
            const th = crear('th', texto); th.scope = 'col'; fila.append(th);
        });
        nodo.createTBody();
        return nodo;
    }
    function renderizar(registros, opciones) {
        if (!registros.length) {
            contenido.replaceChildren(crear('p', 'No hay lotes registrados.', 'inventario-estado'));
            return;
        }
        // El número de lote es único en el esquema actual. La agrupación admite varios medicamentos.
        const grupos = new Map();
        registros.forEach(registro => {
            const clave = `${registro.compra.id_compra}:${registro.numero_lote}`;
            if (!grupos.has(clave)) grupos.set(clave, []);
            grupos.get(clave).push(registro);
        });
        const principal = tabla(['Código / Número de lote', 'Fecha de compra', 'Proveedor / Laboratorio', 'Cantidad de productos', 'Acciones']);
        principal.prepend(crear('caption', `${grupos.size} lotes registrados · Cantidades y precios por empaque recibido.`));
        let indice = 0;
        grupos.forEach(medicamentos => {
            const lote = medicamentos[0];
            const fila = principal.tBodies[0].insertRow();
            fila.dataset.compraId = lote.compra.id_compra;
            fila.dataset.numeroLote = lote.numero_lote;
            const contextual = opciones.compraId != null && String(lote.compra.id_compra) === String(opciones.compraId);
            fila.classList.toggle('inventario-lote-destacado', contextual);
            [lote.numero_lote, lote.compra.fecha_compra, lote.compra.nombre_distribuidor || lote.laboratorio || '—',
                `${new Set(medicamentos.map(m => m.medicamento)).size} medicamento(s)`]
                .forEach(valor => fila.insertCell().textContent = valor ?? '—');
            const alternar = boton('Ver medicamentos');
            alternar.setAttribute('aria-expanded', 'false');
            fila.insertCell().append(alternar);
            const detalle = principal.tBodies[0].insertRow();
            detalle.className = 'inventario-fila-detalle';
            const celda = detalle.insertCell(); celda.colSpan = 5;
            const acordeon = crear('div', undefined, 'inventario-acordeon');
            acordeon.id = `inventario-detalle-${++indice}`;
            acordeon.inert = true;
            acordeon.setAttribute('aria-hidden', 'true');
            alternar.setAttribute('aria-controls', acordeon.id);
            const interior = crear('div');
            const card = crear('section', undefined, 'inventario-medicamentos');
            card.append(crear('h3', `💊 Medicamentos en el Lote ${lote.numero_lote}`));
            const secundaria = tabla(['Nombre del Medicamento', 'Tipo de Empaque', 'Cantidad', 'Precio Compra Unitario', 'Precio Venta Unitario', 'Acciones']);
            medicamentos.forEach(medicamento => {
                const filaMed = secundaria.tBodies[0].insertRow();
                [medicamento.medicamento, medicamento.presentacion_ingreso || 'Unidad',
                    medicamento.cantidad_empaques ?? medicamento.cantidad_inicial,
                    dinero(medicamento.precio_empaque ?? medicamento.precio_compra), dinero(medicamento.precio_venta)]
                    .forEach(valor => filaMed.insertCell().textContent = valor ?? '—');
                const consultar = boton('Ver existencias');
                const existencias = crear('p', `Disponible: ${medicamento.cantidad_disponible ?? '—'} unidades de inventario · Vencimiento: ${medicamento.fecha_vencimiento ?? '—'} · Estado: ${medicamento.estado ?? '—'}`, 'inventario-existencias');
                existencias.hidden = true;
                consultar.setAttribute('aria-expanded', 'false');
                consultar.onclick = () => {
                    existencias.hidden = !existencias.hidden;
                    consultar.setAttribute('aria-expanded', String(!existencias.hidden));
                    consultar.textContent = existencias.hidden ? 'Ver existencias' : 'Ocultar existencias';
                };
                filaMed.insertCell().append(consultar, existencias);
            });
            card.append(secundaria); interior.append(card); acordeon.append(interior); celda.append(acordeon);
            alternar.onclick = () => {
                const abierto = alternar.getAttribute('aria-expanded') !== 'true';
                alternar.setAttribute('aria-expanded', String(abierto));
                alternar.textContent = abierto ? 'Ocultar medicamentos' : 'Ver medicamentos';
                acordeon.inert = !abierto;
                acordeon.setAttribute('aria-hidden', String(!abierto));
                acordeon.classList.toggle('abierto', abierto);
            };
            if (contextual && opciones.expandir) alternar.click();
        });
        contenido.replaceChildren(principal);
    }
    window.inventarioLotes = {
        async abrir(compras, nombre = 'Inventario de Lotes', opciones = {}) {
            const actual = ++version;
            isModalMode = opciones.isModalMode === true;
            if (isModalMode && !modal.open) {
                origen = document.activeElement;
                posicionOrigen = window.scrollY;
            }
            if (isModalMode) {
                modal.append(cabecera, contenido, pie);
                cerrar.hidden = false;
                regresar.textContent = 'Regresar a Inventario de Compras';
            } else {
                if (!pagina) throw new Error('No se encontr? el contenedor de la p?gina de lotes.');
                pagina.append(cabecera, contenido, pie);
                cerrar.hidden = true;
                regresar.textContent = 'Regresar a Compras';
                window.inventarioCompras.mostrarLotes();
            }
            titulo.textContent = nombre;
            contenido.replaceChildren(crear('p', 'Cargando lotes…', 'inventario-estado'));
            contenido.setAttribute('aria-busy', 'true');
            if (isModalMode && !modal.open) modal.showModal();
            if (!isModalMode) {
                titulo.tabIndex = -1;
                titulo.focus();
            }
            try {
                // Procesar por compra evita saturar el canal IPC o el pool de conexiones.
                const registros = [];
                for (const compra of compras.filter(c => opciones.compraId == null || String(c.id_compra) === String(opciones.compraId))) {
                    if (actual !== version) return;
                    const respuesta = await window.farmacia.listarLotesCompra(compra.id_compra);
                    if (respuesta.error) throw new Error(respuesta.error);
                    registros.push(...respuesta.datos.map(lote => ({ ...lote, compra })));
                }
                if (actual === version) renderizar(registros, opciones);
            } catch (error) {
                if (actual === version) {
                    const reintentar = boton('Reintentar');
                    reintentar.onclick = () => this.abrir(compras, nombre, opciones);
                    contenido.replaceChildren(crear('p', `No se pudieron cargar los lotes: ${error.message}`, 'inventario-estado'), reintentar);
                }
            } finally {
                if (actual === version) contenido.setAttribute('aria-busy', 'false');
            }
        }
    };
})();

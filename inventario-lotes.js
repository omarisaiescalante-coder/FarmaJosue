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
    modal.append(cabecera, contenido);
    document.body.append(modal);
    let version = 0;
    let origen;
    let posicionOrigen = 0;
    let isModalMode = false;
    // Una ?nica plantilla se mueve entre la p?gina y el dialog; no se duplican tablas ni eventos.
    const pagina = document.getElementById('vistaInventarioLotes');
    cerrar.onclick = () => {
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
    function tarjetaMedicamento(lote) {
        const tarjeta = crear('article', undefined, 'inventario-lote-card');
        tarjeta.append(crear('h4', lote.medicamento));
        const factor = Number(lote.paquetes_por_caja || 1) * Number(lote.unidades_por_blister || 1);
        const disponible = Number(lote.cantidad_disponible || 0);
        const stocks = lote.tipo_medicamento ? [Math.floor(disponible / factor) + ' cajas'] : [disponible + ' unidades de inventario'];
        if (lote.modalidad_venta === 'Caja y unidad') {
            if (lote.tipo_medicamento === 'Pastilla') stocks.push(Math.floor(disponible / lote.unidades_por_blister) + ' blísteres');
            stocks.push(disponible + (lote.tipo_medicamento === 'Pastilla' ? ' pastillas' : ' unidades'));
        }
        tarjeta.append(crear('p', `Existencias: ${stocks.join(' / ')}`, 'inventario-card-numero'));
        const formulario = crear('form', undefined, 'inventario-editor');
        const campos = {};
        let editando = false;
        const campo = (nombre, etiqueta, valor, opciones) => {
            const label = crear('label', undefined, 'inventario-editor-campo');
            label.append(crear('span', etiqueta));
            const input = crear(opciones ? 'select' : 'input', undefined, opciones ? 'form-select' : 'form-control');
            if (opciones) opciones.forEach(v => input.add(new Option(v, v)));
            else input.type = ['cantidad', 'paquetes_por_caja', 'unidades_por_blister', 'precio', 'precio_compra_contenido', 'precio_compra_unidad', 'precio_venta', 'precio_venta_contenido', 'precio_venta_unidad'].includes(nombre) ? 'number' : 'text';
            input.name = nombre;
            input.value = valor ?? '';
            if (input.type === 'number') {
                input.min = nombre.startsWith('precio') ? (nombre === 'precio' ? 0 : .01) : 1;
                input.step = nombre.startsWith('precio') ? '.01' : '1';
                input.max = nombre.startsWith('precio') ? '99999999.99' : '2147483647';
            }
            if (nombre === 'nombre') input.maxLength = 150;
            if (nombre === 'razon_edicion') input.maxLength = 500;
            label.append(input); formulario.append(label); campos[nombre] = input;
        };
        const tipo = lote.tipo_medicamento || (lote.contenido_caja === 'Blister' ? 'Pastilla' : ['Frasco', 'Ampolla', 'Suero'].includes(lote.presentacion_ingreso) ? lote.presentacion_ingreso : 'Suero');
        campo('nombre', 'Nombre', lote.medicamento);
        campo('tipo_medicamento', 'Tipo de medicamento', tipo, ['Pastilla', 'Frasco', 'Ampolla', 'Suero']);
        campo('modalidad_venta', 'Restricción de venta', lote.modalidad_venta || (lote.precio_venta_unidad || lote.precio_venta_contenido ? 'Caja y unidad' : 'Caja'), ['Caja', 'Caja y unidad']);
        campo('cantidad', 'Cantidad de cajas ingresadas', lote.cantidad_empaques ?? lote.cantidad_inicial);
        campo('paquetes_por_caja', 'Unidades por caja', lote.paquetes_por_caja || 1);
        campo('unidades_por_blister', 'Pastillas por blíster', lote.unidades_por_blister || 1);
        campo('precio', 'Compra por caja (L)', lote.precio_empaque ?? lote.precio_compra);
        campo('precio_compra_contenido', 'Compra por blíster (L)', lote.precio_compra_contenido);
        campo('precio_compra_unidad', 'Compra por unidad (L)', lote.precio_compra_unidad);
        campo('precio_venta', 'Venta por caja (L)', lote.precio_venta);
        campo('precio_venta_contenido', 'Venta por blíster (L)', lote.precio_venta_contenido);
        campo('precio_venta_unidad', 'Venta por unidad (L)', lote.precio_venta_unidad);
        campo('razon_edicion', 'Razón de edición', lote.razon_edicion || 'Sin edición');
        const historial = lote.historial_ediciones?.length ? lote.historial_ediciones : lote.fecha_edicion
            ? [{ id_edicion: 'ultima', fecha_edicion: lote.fecha_edicion, razon_edicion: lote.razon_edicion }] : [];
        campo('fecha_edicion', 'Última edición', undefined, []);
        if (historial.length) historial.forEach(edicion => campos.fecha_edicion.add(new Option(`${edicion.fecha_edicion}${edicion.revision ? ` · Edición ${edicion.revision}` : ''}`, String(edicion.id_edicion))));
        else campos.fecha_edicion.add(new Option('Sin edición', ''));
        campos.fecha_edicion.onchange = () => {
            const seleccionada = historial.find(e => String(e.id_edicion) === campos.fecha_edicion.value);
            campos.razon_edicion.value = seleccionada?.razon_edicion || 'Sin edición';
        };
        const acciones = crear('div', undefined, 'inventario-editor-acciones');
        const editar = boton('Editar'), guardar = boton('Guardar cambios'), cancelar = boton('Cancelar');
        guardar.type = 'submit';
        acciones.append(editar, guardar, cancelar);
        const mensaje = crear('p', '', 'inventario-editor-mensaje'); mensaje.setAttribute('role', 'status');
        formulario.append(acciones, mensaje); tarjeta.append(formulario);
        const ajustar = () => {
            const pastilla = campos.tipo_medicamento.value === 'Pastilla', individual = campos.modalidad_venta.value === 'Caja y unidad';
            for (const [nombre, input] of Object.entries(campos)) {
                const visible = nombre === 'paquetes_por_caja' ? !pastilla || individual : nombre === 'unidades_por_blister' ? pastilla && individual
                    : ['precio_compra_contenido', 'precio_venta_contenido'].includes(nombre) ? pastilla && individual
                    : ['precio_compra_unidad', 'precio_venta_unidad'].includes(nombre) ? individual : true;
                input.parentElement.hidden = !visible;
                const editable = editando && visible && nombre !== 'fecha_edicion';
                input.required = editable;
                if (input.tagName === 'SELECT') input.disabled = nombre === 'fecha_edicion' ? editando || !historial.length : !editable;
                else { input.readOnly = !editable; input.disabled = !visible; }
            }
            campos.paquetes_por_caja.previousElementSibling.textContent = pastilla ? 'Blísteres por caja' : 'Unidades por caja';
            campos.precio_compra_unidad.previousElementSibling.textContent = pastilla ? 'Compra por pastilla (L)' : 'Compra por unidad (L)';
            campos.precio_venta_unidad.previousElementSibling.textContent = pastilla ? 'Venta por pastilla (L)' : 'Venta por unidad (L)';
            editar.hidden = editando; guardar.hidden = cancelar.hidden = !editando;
        };
        campos.tipo_medicamento.onchange = campos.modalidad_venta.onchange = ajustar;
        editar.onclick = () => { editando = true; campos.razon_edicion.value = ''; ajustar(); campos.nombre.focus(); };
        cancelar.onclick = () => tarjeta.replaceWith(tarjetaMedicamento(lote));
        formulario.onsubmit = async evento => {
            evento.preventDefault();
            if (!editando || !formulario.reportValidity()) return;
            const datos = { id_lote: lote.id_lote, revision: lote.revision || 0, presentacion_ingreso: 'Caja' };
            for (const [nombre, input] of Object.entries(campos)) if (!input.parentElement.hidden && nombre !== 'fecha_edicion') datos[nombre] = input.value;
            const controles = [...formulario.elements].map(input => [input, input.disabled]);
            controles.forEach(([input]) => { input.disabled = true; });
            mensaje.textContent = 'Guardando…';
            try {
                const respuesta = await window.farmacia.editarLoteCompra(datos);
                if (respuesta.error) throw new Error(respuesta.error);
                const actualizados = await window.farmacia.listarLotesCompra(lote.compra.id_compra);
                if (actualizados.error) throw new Error('Los cambios se guardaron, pero no se pudo actualizar la tarjeta. Volvé a abrir el inventario.');
                const actualizado = actualizados.datos.find(l => l.id_lote === lote.id_lote);
                if (!actualizado) throw new Error('Volvé a abrir el inventario para consultar el lote actualizado.');
                Object.assign(lote, actualizado);
                tarjeta.replaceWith(tarjetaMedicamento(lote));
                window.dispatchEvent(new Event('lote-actualizado'));
            } catch (error) {
                mensaje.textContent = /No handler registered|editarLoteCompra is not a function/.test(error.message)
                    ? 'La aplicación sigue ejecutando una versión anterior. Cerrá completamente Farmacia Josué y volvé a abrirla con npm start para activar la edición de lotes. Recargar la pantalla no es suficiente.'
                    : error.message;
            }
            finally { controles.forEach(([input, disabled]) => { input.disabled = disabled; }); }
        };
        ajustar();
        return tarjeta;
    }
    function renderizarTarjetas(registros) {
        const resumen = crear('p', `${registros.length} lote(s) de esta compra. Cada tarjeta muestra únicamente los datos de ese lote.`);
        const tarjetero = crear('div', undefined, 'inventario-tarjetero');
        for (const lote of registros) {
            const tarjeta = crear('article', undefined, 'inventario-lote-card');
            tarjeta.dataset.compraId = lote.compra.id_compra;
            tarjeta.dataset.numeroLote = lote.numero_lote;
            tarjeta.append(crear('h3', lote.medicamento), crear('p', `Lote ${lote.numero_lote}`, 'inventario-card-numero'));
            const datos = crear('dl', undefined, 'inventario-card-datos');
            const agregar = (nombre, valor) => datos.append(crear('dt', nombre), crear('dd', valor ?? '—'));
            agregar('Proveedor / Laboratorio', lote.laboratorio || lote.compra.nombre_distribuidor);
            agregar('Fecha de compra', lote.compra.fecha_compra);
            if (lote.tipo_medicamento) agregar('Tipo de medicamento', lote.tipo_medicamento);
            if (lote.modalidad_venta) agregar('Venta permitida', lote.modalidad_venta);
            agregar('Estado', lote.estado);
            agregar('Fecha de fabricación', lote.fecha_fabricacion);
            agregar('Fecha de vencimiento', lote.fecha_vencimiento);
            agregar(lote.presentacion_ingreso === 'Caja' ? 'Cajas recibidas' : 'Cantidad recibida', lote.cantidad_empaques ?? lote.cantidad_inicial);
            const factor = Number(lote.paquetes_por_caja || 1) * Number(lote.unidades_por_blister || 1);
            const disponible = Number(lote.cantidad_disponible || 0);
            const stocks = lote.tipo_medicamento ? [Math.floor(disponible / factor) + ' cajas'] : [disponible + ' unidades de inventario'];
            if (lote.modalidad_venta === 'Caja y unidad') {
                if (lote.tipo_medicamento === 'Pastilla') {
                    stocks.push(Math.floor(disponible / lote.unidades_por_blister) + ' blísteres');
                    agregar('Contenido por caja', `${lote.paquetes_por_caja} blísteres de ${lote.unidades_por_blister} pastillas`);
                } else agregar('Unidades por caja', lote.paquetes_por_caja);
                stocks.push(disponible + (lote.tipo_medicamento === 'Pastilla' ? ' pastillas' : ' unidades'));
            }
            agregar('Existencias de este lote', stocks.join(' / '));
            tarjeta.append(datos, crear('h4', 'Precios de este lote'));
            const precios = crear('div', undefined, 'inventario-card-precios');
            const precio = (nombre, compra, venta) => {
                const fila = crear('div');
                fila.append(crear('strong', nombre), crear('span', `Compra: ${dinero(compra)}`), crear('span', `Venta: ${dinero(venta)}`));
                precios.append(fila);
            };
            precio(lote.presentacion_ingreso || 'Unidad', lote.precio_empaque ?? lote.precio_compra, lote.precio_venta);
            if (lote.modalidad_venta === 'Caja y unidad') {
                if (lote.tipo_medicamento === 'Pastilla') precio('Blíster', lote.precio_compra_contenido, lote.precio_venta_contenido);
                precio(lote.tipo_medicamento === 'Pastilla' ? 'Pastilla' : 'Unidad', lote.precio_compra_unidad, lote.precio_venta_unidad);
            } else if (!lote.tipo_medicamento) {
                if (lote.precio_venta_contenido != null) precio(lote.contenido_caja || 'Contenido', lote.precio_compra_contenido, lote.precio_venta_contenido);
                if (lote.precio_venta_unidad != null) precio('Unidad', lote.precio_compra_unidad, lote.precio_venta_unidad);
            }
            tarjeta.append(precios, crear('p', `Total de compra del lote: ${dinero(lote.costo_total)}`, 'inventario-card-total'));
            tarjetero.append(tarjeta);
        }
        contenido.replaceChildren(resumen, tarjetero);
    }
    function renderizar(registros, opciones) {
        if (!registros.length) {
            contenido.replaceChildren(crear('p', 'No hay lotes registrados.', 'inventario-estado'));
            return;
        }
        if (opciones.isModalMode) { renderizarTarjetas(registros); return; }
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
            const tarjetas = crear('div', undefined, 'inventario-tarjetero');
            medicamentos.forEach(medicamento => tarjetas.append(tarjetaMedicamento(medicamento)));
            card.append(tarjetas); interior.append(card); acordeon.append(interior); celda.append(acordeon);
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
            titulos.querySelector('p').textContent = isModalMode
                ? 'Consulta los datos, precios y existencias de cada lote de esta compra.'
                : 'Consulta los lotes y despliega sus medicamentos.';
            if (isModalMode && !modal.open) {
                origen = document.activeElement;
                posicionOrigen = window.scrollY;
            }
            if (isModalMode) {
                modal.append(cabecera, contenido);
                cerrar.hidden = false;
            } else {
                if (!pagina) throw new Error('No se encontr? el contenedor de la p?gina de lotes.');
                pagina.append(cabecera, contenido);
                cerrar.hidden = true;
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

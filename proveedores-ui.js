function configurarProveedores(proveedores) {
    const selector = document.getElementById('id_distribuidor');
    const grupo = selector.parentElement;
    selector.hidden = true;
    const buscar = document.createElement('input');
    buscar.id = 'buscarProveedor'; buscar.type = 'search'; buscar.className = 'form-control';
    buscar.placeholder = 'Buscar laboratorio o proveedor'; buscar.autocomplete = 'off';
    buscar.required = true; buscar.setAttribute('form', 'recordForm');
    buscar.setAttribute('role', 'combobox'); buscar.setAttribute('aria-autocomplete', 'list');
    buscar.setAttribute('aria-controls', 'opcionesProveedores'); buscar.setAttribute('aria-expanded', 'false');
    grupo.querySelector('label').htmlFor = buscar.id;
    const opciones = document.createElement('div'); opciones.id = 'opcionesProveedores';
    opciones.className = 'proveedores-opciones'; opciones.hidden = true; opciones.setAttribute('role', 'listbox');
    opciones.setAttribute('popover', 'manual');
    const combobox = document.createElement('div'); combobox.className = 'proveedores-combobox';
    const flecha = document.createElement('button'); flecha.type = 'button'; flecha.className = 'proveedores-flecha';
    flecha.textContent = '⌄'; flecha.setAttribute('aria-label', 'Desplegar proveedores'); flecha.setAttribute('aria-controls', opciones.id);
    combobox.append(buscar, flecha, opciones);
    const acceso = document.createElement('button'); acceso.type = 'button';
    acceso.className = 'btn btn-outline-light proveedores-acceso'; acceso.textContent = 'Registrar Lab/Prov';
    grupo.append(combobox, acceso);
    document.getElementById('proveedoresModal')?.remove();
    const modal = document.createElement('dialog'); modal.id = 'proveedoresModal'; modal.className = 'proveedores-modal';
    modal.innerHTML = `<div class="proveedores-modal-cabecera"><h2>Laboratorios y proveedores</h2><button type="button" data-cerrar aria-label="Cerrar">Cerrar</button></div>
        <p data-aviso role="status"></p><form id="proveedorForm" class="proveedores-campos">
        <input type="hidden" name="id_distribuidor">
        <div><label for="proveedorNombre">Nombre del proveedor</label><input id="proveedorNombre" name="nombre" maxlength="150" required></div>
        <div><label for="proveedorTelefono">Teléfono</label><input id="proveedorTelefono" name="telefono" placeholder="9999-9999" pattern="[0-9]{4}-[0-9]{4}" maxlength="9" required></div>
        <div><label for="proveedorCorreo">Correo electrónico</label><input id="proveedorCorreo" name="correo" type="email" maxlength="150" required></div>
        <div class="proveedores-acciones"><button type="submit" class="btn btn-success">Guardar proveedor</button><button type="button" class="btn btn-secondary" data-cancelar-edicion hidden>Cancelar edición</button></div></form>
        <div class="table-responsive" data-tabla></div>`;
    document.body.append(modal);
    const formulario = modal.querySelector('form'); const aviso = modal.querySelector('[data-aviso]');
    const cancelarEdicion = modal.querySelector('[data-cancelar-edicion]');
    formulario.addEventListener('reset', () => {
        formulario.elements.id_distribuidor.value = '';
        cancelarEdicion.hidden = true;
    });
    cancelarEdicion.addEventListener('click', () => {
        if (ocupado) return;
        formulario.reset(); aviso.textContent = ''; formulario.elements.nombre.focus();
    });
    let ocupado = false;
    const solicitarProveedor = async promesa => { const r = await promesa; if (r.error) throw new Error(r.error); return r.datos; };
    function cerrarLista() { if (opciones.matches(':popover-open')) opciones.hidePopover(); opciones.hidden = true; buscar.setAttribute('aria-expanded', 'false'); }
    function posicionarLista() {
        const rect = combobox.getBoundingClientRect();
        opciones.style.left = `${rect.left}px`; opciones.style.top = `${rect.bottom + 4}px`; opciones.style.width = `${rect.width}px`;
        opciones.style.maxHeight = `${Math.max(80, Math.min(200, window.innerHeight - rect.bottom - 16))}px`;
    }
    function seleccionar(proveedor) {
        selector.value = proveedor?.nombre || ''; buscar.value = proveedor?.nombre || '';
        buscar.setCustomValidity(proveedor ? '' : 'Seleccioná un proveedor existente o registralo.');
        selector.dispatchEvent(new Event('input')); cerrarLista();
    }
    function actualizarLista(filas) {
        const anterior = proveedores.find(p => p.nombre === selector.value);
        proveedores.splice(0, proveedores.length, ...filas);
        selector.replaceChildren(new Option('Seleccioná...', ''));
        for (const p of proveedores) selector.add(new Option(p.nombre, p.nombre));
        seleccionar(proveedores.find(p => p.id_distribuidor === anterior?.id_distribuidor));
    }
    function filtrar() {
        opciones.replaceChildren(); const texto = buscar.value.trim().toLocaleLowerCase();
        const coincidencias = proveedores.filter(p => p.nombre.toLocaleLowerCase().includes(texto));
        for (const p of coincidencias) {
            const boton = document.createElement('button'); boton.type = 'button'; boton.textContent = p.nombre;
            boton.setAttribute('role', 'option'); boton.addEventListener('click', () => seleccionar(p)); opciones.append(boton);
        }
        if (texto && !proveedores.some(p => p.nombre.toLocaleLowerCase() === texto)) {
            const crear = document.createElement('button'); crear.type = 'button'; crear.textContent = '+ Crear nuevo proveedor';
            crear.addEventListener('click', () => abrir(buscar.value.trim())); opciones.append(crear);
        }
        opciones.hidden = false; posicionarLista(); if (!opciones.matches(':popover-open')) opciones.showPopover(); buscar.setAttribute('aria-expanded', 'true');
    }
    function tablaProveedores() {
        const tabla = document.createElement('table'); tabla.className = 'table table-striped align-middle';
        const cabecera = tabla.createTHead().insertRow();
        for (const titulo of ['Nombre', 'Teléfono', 'Correo', 'Acciones']) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = titulo; cabecera.append(th); }
        const cuerpo = tabla.createTBody();
        for (const p of proveedores) {
            const fila = cuerpo.insertRow();
            for (const clave of ['nombre', 'telefono', 'correo']) fila.insertCell().textContent = p[clave] || '';
            const acciones = fila.insertCell();
            for (const accion of ['Editar', 'Eliminar']) {
                const boton = document.createElement('button'); boton.type = 'button'; boton.textContent = accion;
                boton.disabled = ocupado;
                boton.addEventListener('click', async () => {
                    if (ocupado) return;
                    if (accion === 'Editar') { formulario.reset(); for (const clave of ['id_distribuidor', 'nombre', 'telefono', 'correo']) formulario.elements[clave].value = p[clave] || ''; cancelarEdicion.hidden = false; aviso.textContent = ''; formulario.elements.nombre.focus(); return; }
                    if (!window.confirm(`¿Eliminar el proveedor ${p.nombre}?`)) return;
                    bloquear(true);
                    try { await solicitarProveedor(window.farmacia.eliminarProveedor(p.id_distribuidor)); await refrescar(); formulario.reset(); aviso.textContent = 'Proveedor eliminado.'; }
                    catch (error) { aviso.textContent = error.message; }
                    finally { bloquear(false); }
                }); acciones.append(boton);
            }
        }
        modal.querySelector('[data-tabla]').replaceChildren(tabla);
    }
    function bloquear(valor) { ocupado = valor; formulario.querySelectorAll('button').forEach(b => b.disabled = valor); modal.querySelector('[data-cerrar]').disabled = valor; tablaProveedores(); }
    async function refrescar() { actualizarLista(await solicitarProveedor(window.farmacia.listarProveedores())); tablaProveedores(); }
    async function abrir(nombre = '') {
        formulario.reset(); formulario.elements.nombre.value = nombre; aviso.textContent = '';
        cerrarLista(); modal.showModal(); tablaProveedores();
        try { await refrescar(); } catch (error) { aviso.textContent = error.message; }
        formulario.elements.nombre.focus();
    }
    acceso.addEventListener('click', () => abrir());
    modal.querySelector('[data-cerrar]').addEventListener('click', () => modal.close());
    modal.addEventListener('cancel', e => { if (ocupado) e.preventDefault(); });
    formulario.elements.telefono.addEventListener('input', e => { const n = e.target.value.replace(/\D/g, '').slice(0, 8); e.target.value = n.length > 4 ? `${n.slice(0, 4)}-${n.slice(4)}` : n; });
    formulario.addEventListener('submit', async e => {
        e.preventDefault(); if (ocupado || !formulario.reportValidity()) return;
        const datos = Object.fromEntries(new FormData(formulario)); bloquear(true); aviso.textContent = '';
        try {
            const guardado = await solicitarProveedor(window.farmacia.guardarProveedor(datos));
            // La respuesta del guardado basta para seleccionar, incluso si falla la recarga.
            const filas = proveedores.filter(p => p.id_distribuidor !== guardado.id_distribuidor);
            filas.push(guardado); filas.sort((a, b) => a.nombre.localeCompare(b.nombre));
            actualizarLista(filas); seleccionar(guardado); formulario.reset();
            aviso.textContent = `Proveedor ${guardado.nombre} guardado. Podés registrar otro.`;
            formulario.elements.nombre.focus();
        } catch (error) { aviso.textContent = error.message; }
        finally { bloquear(false); }
    });
    buscar.addEventListener('input', () => {
        const escrito = buscar.value;
        const exacto = proveedores.find(p => p.nombre.toLocaleLowerCase() === buscar.value.trim().toLocaleLowerCase());
        selector.value = exacto?.nombre || ''; buscar.setCustomValidity(exacto ? '' : 'Seleccioná un proveedor existente o registralo.');
        selector.dispatchEvent(new Event('input')); buscar.value = escrito; filtrar();
    });
    buscar.addEventListener('focus', filtrar);
    flecha.addEventListener('click', () => { if (opciones.hidden) { buscar.focus(); filtrar(); } else cerrarLista(); });
    window.addEventListener('resize', cerrarLista);
    window.addEventListener('scroll', e => { if (!opciones.contains(e.target)) cerrarLista(); }, true);
    grupo.addEventListener('focusout', e => {
        if (!grupo.contains(e.relatedTarget)) cerrarLista();
    });
    buscar.addEventListener('keydown', e => {
        if (e.key === 'Escape') cerrarLista();
        if (e.key === 'ArrowDown') { e.preventDefault(); opciones.querySelector('button')?.focus(); }
        if (e.key === 'Enter' && !opciones.hidden) { e.preventDefault(); opciones.querySelector('button')?.click(); }
    });
    opciones.addEventListener('keydown', e => {
        const botones = [...opciones.querySelectorAll('button')]; const i = botones.indexOf(document.activeElement);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); botones[(i + (e.key === 'ArrowDown' ? 1 : -1) + botones.length) % botones.length]?.focus(); }
        if (e.key === 'Escape') { buscar.focus(); cerrarLista(); }
    });
    selector.addEventListener('change', () => seleccionar(proveedores.find(p => p.nombre === selector.value)));
    selector.addEventListener('input', () => { buscar.value = selector.value; buscar.setCustomValidity(selector.value ? '' : 'Seleccioná un proveedor existente o registralo.'); });
    document.getElementById('recordForm').addEventListener('reset', () => { buscar.value = ''; buscar.setCustomValidity(''); cerrarLista(); });
}

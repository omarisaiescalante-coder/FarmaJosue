// Interfaz exclusiva de Compras y consulta de lotes asociados.
const form = document.getElementById('recordForm');
const guardar = document.getElementById('saveButton');
const limpiar = document.getElementById('clearButton');
let usuario;
let comprasRegistradas = [];
let catalogoMedicamentos = [];
let siguienteLote = 0;
let siguienteFactura;
let lotesAgregados = [];
let loteEnEdicion = null;

function datosLote(lote) {
    return { ...Object.fromEntries([...lote.querySelectorAll('[data-campo]')]
        .filter(input => !input.disabled && !['nombre_medicamento', 'laboratorio'].includes(input.dataset.campo))
        .map(input => [input.dataset.campo, input.value])),
        formas_venta: [...lote.querySelectorAll('[data-forma-venta]')].map(f => ({ nombre: f.querySelector('select').value, precio: f.querySelector('[data-precio-venta]').value, cantidad: f.querySelector('[data-equivalencia]').value })),
        numero_automatico: !lote.querySelector('[data-campo="numero_lote"]').value.trim() };
}

function pintarLotesAgregados() {
    const lista = document.getElementById('lotesAgregados');
    if (!lista) return;
    lista.replaceChildren();
    if (!lotesAgregados.length) {
        const vacio = document.createElement('p');
        vacio.className = 'compras-lotes-vacio';
        vacio.textContent = 'Todavía no hay lotes agregados.';
        lista.append(vacio);
    }
    for (const [indice, lote] of lotesAgregados.entries()) {
        const fila = document.createElement('button');
        fila.type = 'button';
        fila.className = 'compras-lote-compacto';
        fila.setAttribute('aria-label', `Editar lote ${lote.datos.numero_lote || 'automático'} de ${lote.nombre}`);
        fila.addEventListener('click', () => {
            document.querySelector('[data-lote]').dispatchEvent(new CustomEvent('editar-lote', { detail: indice }));
        });
        const nombre = document.createElement('span');
        nombre.textContent = lote.nombre;
        const numero = document.createElement('span');
        numero.textContent = lote.datos.numero_lote || 'Automático';
        fila.append(nombre, numero);
        const registro = document.createElement('div');
        registro.className = 'compras-lote-fila';
        const eliminar = document.createElement('button');
        eliminar.type = 'button';
        eliminar.className = 'compras-eliminar-lote';
        eliminar.setAttribute('aria-label', `Eliminar lote ${lote.datos.numero_lote || 'automático'} de ${lote.nombre}`);
        eliminar.title = 'Eliminar lote';
        eliminar.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg>';
        eliminar.addEventListener('click', () => {
            lotesAgregados.splice(indice, 1);
            if (loteEnEdicion === indice) {
                document.querySelector('[data-lote]').dispatchEvent(new Event('limpiar-lote'));
            } else if (loteEnEdicion !== null && loteEnEdicion > indice) {
                loteEnEdicion--;
            }
            pintarLotesAgregados();
            actualizarTotales();
            const siguiente = lista.querySelector('.compras-eliminar-lote');
            (siguiente || document.querySelector('[data-campo="nombre_medicamento"]')).focus();
        });
        registro.append(fila, eliminar);
        lista.append(registro);
    }
}

function loteActualTieneDatos(lote) {
    return lote && [...lote.querySelectorAll('[data-campo], [data-forma-venta] input')].some(input => !input.disabled && input.type !== 'hidden' && !input.parentElement.hidden && input.value.trim() && input.dataset.campo !== 'tipo_medicamento');
}

function actualizarTotales() {
    let total = lotesAgregados.reduce((suma, lote, indice) => suma + (indice === loteEnEdicion ? 0 : Math.round(Number(lote.datos.precio) * 100) * Number(lote.datos.cantidad)), 0);
    for (const lote of document.querySelectorAll('[data-lote]')) {
        const cantidad = Number(lote.querySelector('[data-campo="cantidad"]').value);
        const precio = Number(lote.querySelector('[data-campo="precio"]').value);
        const centavos = Math.round(precio * 100) * cantidad;
        const subtotal = Number.isSafeInteger(centavos) && centavos >= 0 ? centavos : 0;
        lote.querySelector('[data-total-lote]').textContent = `Precio de compra total = L. ${(subtotal / 100).toFixed(2)}`;
        const contenido = nombre => Number(lote.querySelector(`[data-campo="${nombre}"]`).value || 0);
        const columnasStock = { Caja: ['Caja', 'cajas_por_paquete'], Blister: ['Blíster', 'blisteres_por_paquete'], Unidad: ['Unidad', 'unidades_por_paquete'] };
        const seleccionadas = new Set([...lote.querySelectorAll('[data-forma-venta] select')].map(select => select.value));
        const resumenStock = Object.entries(columnasStock).filter(([nombre]) => seleccionadas.has(nombre))
            .map(([, [etiqueta, campo]]) => `${etiqueta} = ${cantidad * contenido(campo) || 0}`);
        lote.querySelector('[data-unidades-lote]').textContent = 'Stock = ' + (resumenStock.join(', ') || '0');
        total += subtotal;
    }
    form.elements.total.value = (total / 100).toFixed(2);
}

function agregarLote() {
    const actual = document.querySelector('[data-lote]');
    if (actual) { actual.querySelector('[data-campo="nombre_medicamento"]').focus(); return; }
    const lote = document.createElement('fieldset');
    lote.dataset.lote = '';
    lote.className = 'compra-lote';
    const leyenda = document.createElement('legend');
    leyenda.className = 'visually-hidden';
    leyenda.textContent = 'LOTE Y PRECIO COMPRA';
    lote.append(leyenda);
    const numero = ++siguienteLote;
    for (const [campo, titulo, tipo] of [
        ['nombre_medicamento', 'Nombre del medicamento', 'text'], ['numero_lote', 'Número de lote', 'text'],
        ['id_medicamento', '', 'hidden'], ['laboratorio', '', 'hidden'],
        ['tipo_medicamento', 'Tipo de medicamento', 'select'],
        ['presentacion_ingreso', '', 'hidden'],
        ['cajas_por_paquete', '', 'hidden'], ['blisteres_por_paquete', '', 'hidden'], ['unidades_por_paquete', '', 'hidden'],
        ['cantidad', 'Cantidad de empaques a ingresar', 'number'],
        ['paquetes_por_caja', 'Blísteres por caja', 'number'],
        ['unidades_por_blister', 'Pastillas por blíster', 'number'],
        ['precio', 'Precio de compra por caja contenedora', 'number'],
        ['fecha_fabricacion', 'Fecha de fabricación', 'date'], ['fecha_vencimiento', 'Fecha de vencimiento', 'date'],
    ]) {
        const grupo = document.createElement('div');
        grupo.className = 'col-12 col-md-6';
        if (campo.startsWith('precio_venta')) grupo.className = 'col-12 col-md-4';
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = titulo;
        const input = document.createElement(tipo === 'select' ? 'select' : 'input');
        input.id = `lote-${numero}-${campo}`;
        label.htmlFor = input.id;
        input.dataset.campo = campo;
        input.className = tipo === 'select' ? 'form-select' : 'form-control';
        input.required = tipo !== 'hidden' && campo !== 'numero_lote';
        if (tipo === 'select') {
                input.add(new Option('Seleccioná...', ''));
                const opciones = ['Pastilla', 'Frasco', 'Ampolla', 'Suero'];
                const etiquetas = { Blister: 'Blíster' };
                for (const opcion of opciones) input.add(new Option(etiquetas[opcion] || opcion, opcion));
        } else input.type = tipo;
        if (tipo === 'hidden') grupo.hidden = true;
        if (campo === 'numero_lote') { input.maxLength = 50; input.placeholder = 'Escribí el lote o dejá vacío para generarlo'; }
        if (campo === 'nombre_medicamento') { input.maxLength = 150; input.autocomplete = 'off'; }
        if (['paquetes_por_caja', 'unidades_por_blister'].includes(campo)) { input.min = 1; input.step = 1; input.max = 2147483647; }
        if (campo.startsWith('precio_venta') || campo.startsWith('precio_compra')) { input.min = '0.01'; input.step = '0.01'; input.max = '99999999.99'; }
        if (campo === 'cantidad') { input.min = 1; input.step = 1; input.max = 2147483647; }
        if (campo === 'precio') { input.min = 0; input.step = '0.01'; input.max = '99999999.99'; }
        grupo.append(label, input);
        lote.append(grupo);
    }
    const campo = nombre => lote.querySelector(`[data-campo="${nombre}"]`);
    const sincronizarEquivalencias = () => {
        const cantidades = [...lote.querySelectorAll('[data-equivalencia]')];
        cantidades.forEach(input => input.setCustomValidity(''));
        if (!cantidades.length) return;
        try {
            const equivalencias = window.equivalenciasLote(datosLote(lote));
            campo('paquetes_por_caja').value = equivalencias.paquetes;
            campo('unidades_por_blister').value = equivalencias.unidades;
            campo('cajas_por_paquete').value = equivalencias.cajasPorPaquete;
            campo('blisteres_por_paquete').value = equivalencias.blisteresPorPaquete ?? '';
            campo('unidades_por_paquete').value = equivalencias.unidadesPorPaquete;
        } catch (error) {
            cantidades.forEach(input => { if (input.value) input.setCustomValidity(error.message); });
        }
    };

    const ventas = document.createElement('div'); ventas.className = 'lote-ventas-cuaderno';
    const filas = document.createElement('div');
    const agregarForma = document.createElement('button');
    agregarForma.type = 'button'; agregarForma.className = 'btn btn-outline-success mt-2';
    agregarForma.textContent = '+ Otra';
    ventas.append(filas, agregarForma); campo('fecha_fabricacion').parentElement.before(ventas);
    campo('nombre_medicamento').parentElement.className = 'col-12';
    for (const nombre of ['numero_lote', 'cantidad', 'precio']) campo(nombre).parentElement.className = 'col-12 col-md-4';
    const stock = document.createElement('p'); stock.hidden = true;
    const total = document.createElement('p'); total.className = 'col-12 lote-total-compra'; total.dataset.totalLote = '';
    const unidadesTotal = document.createElement('p'); unidadesTotal.className = 'col-12 text-secondary'; unidadesTotal.dataset.unidadesLote = '';
    lote.append(stock, total, unidadesTotal);
    campo('tipo_medicamento').previousElementSibling.textContent = 'Cómo entra';
    campo('tipo_medicamento').options[1].textContent = 'Blíster (pastillas)';
    campo('tipo_medicamento').options[2].textContent = 'Jarabe / frasco';
    campo('cantidad').previousElementSibling.textContent = 'Paquetes que ingresan';
    campo('cantidad').setAttribute('aria-description', 'Cantidad de paquetes mayoristas que ingresan al inventario.');
    campo('precio').previousElementSibling.textContent = 'Precio del paquete';
    campo('precio').setAttribute('aria-description', 'Precio de compra de cada paquete mayorista, en lempiras.');
    const ajustarEmpaque = () => {
        campo('tipo_medicamento').parentElement.hidden = false;
        campo('tipo_medicamento').required = true;
        const pastilla = campo('tipo_medicamento').value === 'Pastilla';
        campo('presentacion_ingreso').value = 'Paquete';
        campo('paquetes_por_caja').previousElementSibling.textContent = pastilla ? 'Blísteres por caja' : 'Unidades por caja';
        for (const nombre of ['paquetes_por_caja', 'unidades_por_blister']) {
            campo(nombre).parentElement.hidden = true;
            campo(nombre).type = 'hidden';
            campo(nombre).required = false;
        }
        const seleccionadas = [...filas.querySelectorAll('select')].map(input => input.value);
        for (const select of filas.querySelectorAll('select')) for (const opcion of select.options)
            opcion.disabled = (opcion.value !== select.value && seleccionadas.includes(opcion.value)) || (opcion.value === 'Blister' && !pastilla);
        agregarForma.disabled = filas.children.length >= 3;
        for (const fila of filas.children) {
            const nombre = fila.querySelector('select').value;
            const texto = nombre === 'Caja' ? 'Cantidad de cajas' : nombre === 'Blister' ? 'Cantidad de blísteres' : nombre === 'Unidad' ? 'Cantidad de unidades' : 'Cantidad';
            fila.querySelector('[data-titulo-cantidad]').textContent = texto;
            fila.querySelector('[data-equivalencia]').title = texto;
        }
        sincronizarEquivalencias();
        if (lote.isConnected) actualizarTotales();
    };
    const nuevaForma = (nombre = '', precio = '', equivalencia = '') => {
        const fila = document.createElement('div'); fila.className = 'lote-forma-venta'; fila.dataset.formaVenta = '';
        const etiqueta = document.createElement('label'); etiqueta.textContent = 'Forma de venta';
        const select = document.createElement('select'); select.className = 'form-select'; select.required = true;
        select.add(new Option('Seleccioná...', ''));
        for (const valor of ['Caja', 'Blister', 'Unidad']) select.add(new Option(valor === 'Blister' ? 'Blíster' : valor, valor));
        select.value = nombre; etiqueta.append(select);
        const etiquetaPrecio = document.createElement('label');
        const tituloPrecio = document.createElement('span'); etiquetaPrecio.append(tituloPrecio);
        const input = document.createElement('input'); input.type = 'number'; input.className = 'form-control';
        input.dataset.precioVenta = '';
        input.min = '.01'; input.max = '99999999.99'; input.step = '.01'; input.required = true; input.value = precio;
        etiquetaPrecio.append(input);
        const etiquetaCantidad = document.createElement('label');
        const tituloCantidad = document.createElement('span'); tituloCantidad.dataset.tituloCantidad = ''; etiquetaCantidad.append(tituloCantidad);
        const cantidad = document.createElement('input'); cantidad.type = 'number'; cantidad.className = 'form-control';
        cantidad.dataset.equivalencia = ''; cantidad.min = '1'; cantidad.max = '2147483647'; cantidad.step = '1'; cantidad.required = true;
        cantidad.value = equivalencia;
        etiquetaCantidad.append(cantidad);
        const actualizarFila = () => {
            const nombresPrecio = { Caja: 'caja', Blister: 'blíster', Unidad: 'unidad' };
            tituloPrecio.textContent = 'Precio de venta' + (nombresPrecio[select.value] ? ' por ' + nombresPrecio[select.value] : '') + ' (L)';
            ajustarEmpaque();
        };
        const quitar = document.createElement('button'); quitar.type = 'button'; quitar.className = 'btn btn-outline-danger';
        quitar.textContent = '×'; quitar.setAttribute('aria-label', 'Quitar forma de venta');
        quitar.onclick = () => { fila.remove(); ajustarEmpaque(); }; select.onchange = actualizarFila;
        fila.append(etiqueta, etiquetaPrecio, etiquetaCantidad, quitar); filas.append(fila); actualizarFila();
    };
    agregarForma.onclick = () => nuevaForma();
    campo('tipo_medicamento').addEventListener('change', ajustarEmpaque);
    nuevaForma('Caja');
    campo('id_medicamento').addEventListener('change', () => {
        const medicamento = catalogoMedicamentos.find(m => String(m.id_medicamento) === campo('id_medicamento').value);
        campo('laboratorio').value = form.elements.id_distribuidor.value.trim();
        stock.textContent = '';
        for (const nombre of ['tipo_medicamento', 'precio', 'cantidad']) campo(nombre).value = '';
        if (medicamento?.tipo_medicamento) campo('tipo_medicamento').value = medicamento.tipo_medicamento;
        campo('presentacion_ingreso').value = ['Caja', 'Frasco', 'Ampolla', 'Suero', 'Sueros por caja'].includes(medicamento?.forma_venta) ? medicamento.forma_venta : '';
        for (const nombre of ['paquetes_por_caja', 'unidades_por_blister', 'cajas_por_paquete', 'blisteres_por_paquete', 'unidades_por_paquete']) campo(nombre).value = '';
        filas.replaceChildren(); nuevaForma('Caja');
        ajustarEmpaque();
        actualizarLaboratorios();
    });
    agregarRegistroMedicamento(lote, campo('id_medicamento'), campo('nombre_medicamento'));
    ajustarEmpaque();
    for (const nombre of ['nombre_medicamento', 'numero_lote', 'cantidad', 'precio', 'tipo_medicamento', 'paquetes_por_caja', 'unidades_por_blister']) lote.append(campo(nombre).parentElement);
    lote.append(ventas, campo('fecha_fabricacion').parentElement, campo('fecha_vencimiento').parentElement, stock, total, unidadesTotal);
    // Las tres columnas conservan la posición del boceto incluso cuando «Cómo entra» está oculto.
    campo('nombre_medicamento').parentElement.classList.add('lote-nombre-cuaderno');
    for (const [nombre, clase] of [['numero_lote', 'lote-numero-cuaderno'], ['cantidad', 'lote-cantidad-cuaderno'], ['precio', 'lote-precio-cuaderno'], ['tipo_medicamento', 'lote-entrada-cuaderno']]) campo(nombre).parentElement.classList.add(clase);
    const fechas = document.createElement('div'); fechas.className = 'lote-fechas-cuaderno';
    fechas.append(...['fecha_fabricacion', 'fecha_vencimiento'].map(nombre => campo(nombre).parentElement));
    ventas.after(fechas);
    const detalle = document.createElement('div');
    detalle.className = 'lote-distribucion-cuaderno';
    detalle.id = `detalle-lote-${numero}`;
    detalle.dataset.detalleLote = '';
    detalle.append(...[...lote.children].filter(elemento => elemento !== leyenda));
    const limpiarLoteActual = () => {
        loteEnEdicion = null;
        for (const input of lote.querySelectorAll('[data-campo]')) {
            input.value = '';
            input.setCustomValidity('');
        }
        campo('id_medicamento').dispatchEvent(new Event('change'));
        actualizarTotales();
        campo('nombre_medicamento').focus();
    };
    lote.addEventListener('limpiar-lote', limpiarLoteActual);
    lote.addEventListener('editar-lote', evento => {
        if (loteActualTieneDatos(lote)) {
            mensaje('Guarda o cancela el lote actual antes de editar otro.', true);
            return;
        }
        loteEnEdicion = evento.detail;
        const seleccionado = lotesAgregados[loteEnEdicion];
        campo('nombre_medicamento').value = seleccionado.nombre;
        campo('id_medicamento').value = seleccionado.datos.id_medicamento;
        campo('id_medicamento').dispatchEvent(new Event('change'));
        campo('tipo_medicamento').value = seleccionado.datos.tipo_medicamento;
        filas.replaceChildren();
        for (const forma of seleccionado.datos.formas_venta || []) nuevaForma(forma.nombre, forma.precio, forma.cantidad);
        ajustarEmpaque();
        for (const [nombre, valor] of Object.entries(seleccionado.datos)) {
            const input = campo(nombre);
            if (input) input.value = valor;
        }
        actualizarTotales();
        campo('nombre_medicamento').focus();
    });
    const guardarLote = document.createElement('button');
    guardarLote.type = 'button';
    guardarLote.className = 'btn btn-success col-auto';
    guardarLote.textContent = 'Guardar';
    guardarLote.dataset.guardarLote = '';
    guardarLote.addEventListener('click', () => {
        if (![...detalle.querySelectorAll('input, select')].every(input => input.disabled || input.reportValidity())) return;
        if (!filas.children.length) { mensaje('Agregá una forma de venta.', true); return; }
        const agregado = { nombre: campo('nombre_medicamento').value.trim(), datos: datosLote(lote) };
        if (loteEnEdicion === null) lotesAgregados.push(agregado);
        else lotesAgregados[loteEnEdicion] = agregado;
        pintarLotesAgregados();
        limpiarLoteActual();
    });
    const accionesLote = document.createElement('div');
    accionesLote.className = 'lote-acciones-cuaderno d-flex flex-wrap gap-3';
    limpiar.textContent = 'Cancelar';
    accionesLote.append(guardarLote, limpiar);
    detalle.append(accionesLote);
    lote.append(detalle);
    lote.addEventListener('input', () => { sincronizarEquivalencias(); actualizarTotales(); });
    document.getElementById('lotesNuevos').append(lote);
    actualizarLaboratorios();
    campo('nombre_medicamento').focus();
}

function actualizarLaboratorios() {
    const laboratorio = form.elements.id_distribuidor.value.trim();
    document.querySelectorAll('[data-campo="laboratorio"], [data-laboratorio-medicamento]').forEach(input => { input.value = laboratorio; });
}

function agregarRegistroMedicamento(lote, selector, buscador) {
    const seccion = document.createElement('div');
    seccion.style.display = 'contents';
    const abrir = document.createElement('button');
    abrir.type = 'button'; abrir.className = 'btn btn-warning';
    abrir.textContent = 'Nuevo';
    const pregunta = document.createElement('p');
    pregunta.textContent = '¿Quieres registrar medicamento?';
    pregunta.hidden = true;
    const cancelarAviso = document.createElement('button');
    cancelarAviso.type = 'button';
    cancelarAviso.className = 'btn btn-secondary ms-2';
    cancelarAviso.textContent = 'Cancelar';
    cancelarAviso.hidden = true;
    const modal = document.createElement('dialog');
    modal.className = 'registro-medicamento';
    const titulo = document.createElement('h2');
    titulo.className = 'h5';
    titulo.id = `${selector.id}-titulo-registro`;
    titulo.textContent = 'Registrar medicamento';
    modal.setAttribute('aria-labelledby', titulo.id);
    const panel = document.createElement('fieldset');
    panel.className = 'row g-3 border rounded p-3 mt-2';
    panel.hidden = panel.disabled = true;
    const campos = {};
    for (const [nombre, titulo] of [['nombre', 'Nombre *'], ['laboratorio', 'Laboratorio *'], ['categoria', 'Categoría'], ['restriccion', 'Restricción *']]) {
        const grupo = document.createElement('div'); grupo.className = 'col-12 col-md-6';
        const label = document.createElement('label'); label.textContent = titulo; label.className = 'form-label';
        const input = document.createElement(nombre === 'restriccion' ? 'select' : 'input');
        input.id = `${selector.id}-nuevo-${nombre}`; label.htmlFor = input.id;
        input.className = 'form-control'; input.required = nombre !== 'categoria';
        if (nombre === 'restriccion') {
            input.add(new Option('Seleccioná...', ''));
            for (const valor of ['Sin Receta Medica', 'Con Receta Medica']) input.add(new Option(valor, valor));
        } else { input.type = 'text'; input.maxLength = nombre === 'categoria' ? 100 : 150; }
        if (nombre === 'laboratorio') {
            input.type = 'hidden'; grupo.hidden = true; input.required = false;
            input.dataset.laboratorioMedicamento = '';
            input.value = form.elements.id_distribuidor.value.trim();
        }
        campos[nombre] = input; grupo.append(label, input); panel.append(grupo);
    }
    const guardarNuevo = document.createElement('button'); guardarNuevo.type = 'button';
    guardarNuevo.className = 'btn btn-success btn-sm col-auto'; guardarNuevo.textContent = 'Guardar medicamento';
    const cancelar = document.createElement('button'); cancelar.type = 'button';
    cancelar.className = 'btn btn-secondary btn-sm col-auto'; cancelar.textContent = 'Cancelar';
    const estado = document.createElement('p'); estado.setAttribute('role', 'status');
    const cerrar = () => {
        modal.close();
        panel.hidden = panel.disabled = true;
        pregunta.hidden = cancelarAviso.hidden = true;
    };
    modal.addEventListener('cancel', evento => {
        evento.preventDefault();
        if (!guardarNuevo.disabled) cerrar();
    });
    const mostrar = (enfocar = true) => {
        campos.nombre.value = buscador.value.trim();
        panel.hidden = panel.disabled = false;
        pregunta.hidden = cancelarAviso.hidden = true;
        estado.textContent = '';
        if (!modal.open) modal.showModal();
        if (enfocar) campos.nombre.focus();
    };
    abrir.addEventListener('click', () => mostrar());
    cancelar.addEventListener('click', cerrar);
    cancelarAviso.addEventListener('click', () => { cerrar(); buscador.focus(); });
    const lista = document.createElement('div');
    lista.id = `${selector.id}-opciones`;
    lista.className = 'medicamentos-sugerencias';
    lista.setAttribute('popover', 'auto');
    lista.setAttribute('role', 'listbox');
    buscador.setAttribute('role', 'combobox');
    buscador.setAttribute('aria-autocomplete', 'list');
    buscador.setAttribute('aria-controls', lista.id);
    buscador.setAttribute('aria-expanded', 'false');
    let opcionActiva = -1;
    const cerrarSugerencias = () => {
        if (lista.matches(':popover-open')) lista.hidePopover();
        buscador.setAttribute('aria-expanded', 'false');
        buscador.removeAttribute('aria-activedescendant');
        opcionActiva = -1;
    };
    const elegir = medicamento => {
        buscador.value = medicamento.nombre;
        buscar();
        cerrarSugerencias();
        buscador.focus();
    };
    const sugerir = () => {
        lista.replaceChildren();
        opcionActiva = -1;
        buscador.removeAttribute('aria-activedescendant');
        const texto = buscador.value.trim().toLocaleLowerCase('es');
        const coincidencias = texto ? catalogoMedicamentos.filter(m =>
            `${m.nombre} ${m.codigo}`.toLocaleLowerCase('es').includes(texto)).slice(0, 30) : [];
        if (!coincidencias.length) { cerrarSugerencias(); return; }
        for (const [indice, medicamento] of coincidencias.entries()) {
            const opcion = document.createElement('button');
            opcion.type = 'button';
            opcion.id = `${lista.id}-${indice}`;
            opcion.setAttribute('role', 'option');
            opcion.setAttribute('aria-selected', 'false');
            opcion.tabIndex = -1;
            const nombre = document.createElement('span');
            nombre.textContent = medicamento.nombre;
            const codigo = document.createElement('small');
            codigo.textContent = medicamento.codigo;
            opcion.append(nombre, codigo);
            opcion.addEventListener('mousedown', evento => evento.preventDefault());
            opcion.addEventListener('click', () => elegir(medicamento));
            lista.append(opcion);
        }
        const posicion = buscador.getBoundingClientRect();
        lista.style.left = `${posicion.left}px`;
        lista.style.width = `${posicion.width}px`;
        const debajo = window.innerHeight - posicion.bottom;
        const arriba = debajo < 160 && posicion.top > debajo;
        lista.style.top = arriba ? 'auto' : `${posicion.bottom + 6}px`;
        lista.style.bottom = arriba ? `${window.innerHeight - posicion.top + 6}px` : 'auto';
        lista.style.maxHeight = `${Math.max(48, Math.min(240, (arriba ? posicion.top : debajo) - 12))}px`;
        if (!lista.matches(':popover-open')) lista.showPopover();
        buscador.setAttribute('aria-expanded', 'true');
    };
    lista.addEventListener('toggle', evento => {
        if (evento.newState === 'closed') {
            buscador.setAttribute('aria-expanded', 'false');
            buscador.removeAttribute('aria-activedescendant');
        }
    });
    seccion.append(lista);
    const buscar = (confirmar = false) => {
        const nombre = buscador.value.trim();
        const medicamento = catalogoMedicamentos.find(m => m.nombre.toLocaleLowerCase('es') === nombre.toLocaleLowerCase('es'));
        const id = medicamento ? String(medicamento.id_medicamento) : '';
        if (selector.value !== id) { selector.value = id; selector.dispatchEvent(new Event('change')); }
        buscador.setCustomValidity(nombre && !medicamento ? 'Registrá este medicamento para continuar.' : '');
        pregunta.textContent = 'Agregue medicamento → Nuevo';
        pregunta.hidden = !nombre || !!medicamento || catalogoMedicamentos.some(m => m.nombre.toLocaleLowerCase('es').includes(nombre.toLocaleLowerCase('es')));
    };
    buscador.addEventListener('input', () => { buscar(); sugerir(); });
    buscador.addEventListener('focus', sugerir);
    buscador.addEventListener('change', () => { cerrarSugerencias(); buscar(true); });
    buscador.addEventListener('blur', cerrarSugerencias);
    buscador.addEventListener('keydown', evento => {
        if (['ArrowDown', 'ArrowUp'].includes(evento.key)) {
            evento.preventDefault();
            if (!lista.matches(':popover-open')) sugerir();
            const opciones = [...lista.querySelectorAll('button')];
            if (!opciones.length) return;
            opcionActiva = (opcionActiva + (evento.key === 'ArrowDown' ? 1 : opciones.length - 1) + opciones.length) % opciones.length;
            opciones.forEach((opcion, i) => opcion.setAttribute('aria-selected', String(i === opcionActiva)));
            buscador.setAttribute('aria-activedescendant', opciones[opcionActiva].id);
            opciones[opcionActiva].scrollIntoView({ block: 'nearest' });
            return;
        }
        if (evento.key === 'Escape') { cerrarSugerencias(); return; }
        if (evento.key === 'Enter' && lista.matches(':popover-open') && opcionActiva >= 0) {
            evento.preventDefault();
            lista.querySelectorAll('button')[opcionActiva].click();
            return;
        }
        if (evento.key === 'Enter') { evento.preventDefault(); buscar(true); }
    });
    guardarNuevo.addEventListener('click', async () => {
        actualizarLaboratorios();
        if (!campos.laboratorio.value) {
            estado.textContent = 'Escribí el laboratorio o proveedor de la compra antes de registrar el medicamento.';
            form.elements.id_distribuidor.focus(); return;
        }
        if (!Object.values(campos).every(input => input.reportValidity())) return;
        const datos = Object.fromEntries(Object.entries(campos).map(([nombre, input]) => [nombre, input.value]));
        guardarNuevo.disabled = cancelar.disabled = true;
        guardar.disabled = true;
        try {
            const medicamento = await solicitar(window.farmacia.registrarMedicamento(datos));
            catalogoMedicamentos.push(medicamento);
            selector.value = medicamento.id_medicamento;
            buscador.value = medicamento.nombre;
            buscador.setCustomValidity('');
            selector.dispatchEvent(new Event('change'));
            cerrar();
            mensaje(`Medicamento ${medicamento.codigo} registrado. Completá los datos del lote.`);
        } catch (error) { estado.textContent = error.message; }
        finally { guardarNuevo.disabled = cancelar.disabled = guardar.disabled = false; }
    });
    const accionesMedicamento = document.createElement('div');
    accionesMedicamento.className = 'registro-medicamento-acciones col-12';
    accionesMedicamento.append(guardarNuevo, cancelar);
    panel.append(accionesMedicamento, estado);
    modal.append(titulo, panel);
    buscador.parentElement.classList.add('lote-buscador');
    buscador.parentElement.append(pregunta, abrir);
    modal.addEventListener('keydown', evento => {
        if (evento.key === 'Enter' && evento.target.tagName !== 'BUTTON') {
            evento.preventDefault();
            if (panel.hidden) abrir.click();
            else guardarNuevo.click();
        }
    });
    seccion.append(modal); lote.append(seccion);
}

function mensaje(texto, error = false) {
    const elemento = document.getElementById('message');
    elemento.textContent = texto;
    elemento.className = `alert ${error ? 'alert-danger' : 'alert-success'}`;
}
async function solicitar(promesa) {
    const respuesta = await promesa;
    if (respuesta.error) throw new Error(respuesta.error);
    return respuesta.datos;
}
function limpiarFormulario() {
    lotesAgregados = [];
    loteEnEdicion = null;
    pintarLotesAgregados();
    form.reset();
    document.getElementById('lotesNuevos').replaceChildren();
    siguienteLote = 0;
    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    document.getElementById('numero_factura').textContent = siguienteFactura;
    document.getElementById('id_usuario').textContent = [usuario.nombre, usuario.apellido].filter(Boolean).join(' ');
    form.elements.fecha_compra.value = fecha;
    form.elements.fecha_compra.max = fecha;
    actualizarTotales();
    agregarLote();
}
function crearFormulario(config, proveedores) {
    form.replaceChildren();
    form.noValidate = true;
    const encabezado = document.getElementById('comprasEncabezado');
    encabezado.replaceChildren();
    const resumen = document.getElementById('comprasResumen');
    resumen.replaceChildren();
    for (const campo of config.fields) {
        const grupo = document.createElement('div');
        grupo.className = 'col-12 col-md-6';
        const esEncabezado = ['numero_factura', 'id_usuario', 'id_distribuidor', 'fecha_compra'].includes(campo.name);
        if (esEncabezado) grupo.className = 'compras-encabezado-campo';
        if (['numero_factura', 'id_usuario'].includes(campo.name)) {
            const etiqueta = document.createElement('span');
            etiqueta.className = 'form-label';
            etiqueta.textContent = campo.name === 'numero_factura' ? 'Número de factura' : 'Usuario que atiende';
            const texto = document.createElement('p');
            texto.id = campo.name;
            texto.className = 'compras-dato-lectura';
            texto.setAttribute('aria-live', 'polite');
            grupo.append(etiqueta, texto);
            encabezado.append(grupo);
            continue;
        }
        const esContacto = ['telefono_distribuidor', 'correo_distribuidor'].includes(campo.name);
        const esProveedor = campo.name === 'id_distribuidor';
        const esResumen = ['total', 'metodo_pago', 'estado'].includes(campo.name);
        if (esResumen) {
            grupo.className = 'compras-resumen-tarjeta compras-encabezado-campo';
            grupo.dataset.resumen = campo.name;
        }
        const label = document.createElement('label');
        label.textContent = campo.label;
        label.htmlFor = campo.name;
        label.className = 'form-label';
        const input = document.createElement(campo.type === 'select' || esProveedor ? 'select' : 'input');
        input.id = input.name = campo.name;
        input.setAttribute('form', 'recordForm');
        input.className = campo.type === 'select' ? 'form-select' : 'form-control';
        input.required = Boolean(campo.required);
        if (esProveedor) {
            input.className = 'form-select';
            input.add(new Option('Seleccioná un laboratorio o proveedor', ''));
            for (const proveedor of proveedores) input.add(new Option(proveedor.nombre, proveedor.nombre));
        } else if (campo.type === 'select') {
            for (const opcion of campo.options) input.add(new Option(opcion, opcion));
        } else {
            input.type = campo.type === 'distributor-name' ? 'text' : campo.type || 'text';
            input.readOnly = Boolean(campo.readOnly);
            for (const atributo of ['min', 'step', 'placeholder']) {
                if (campo[atributo] !== undefined) input[atributo] = campo[atributo];
            }
            if (campo.exactLength) input.minLength = input.maxLength = campo.exactLength;
        }
        grupo.append(label, input);
        if (esContacto) input.type = 'hidden';
        if (campo.type === 'hidden' || esContacto) grupo.hidden = true;
        (esEncabezado ? encabezado : esResumen ? resumen : form).append(grupo);
        if (campo.name === 'fecha_compra') {
            const seccion = document.createElement('div');
            seccion.className = 'col-12';
            const lotes = document.createElement('div');
            lotes.id = 'lotesNuevos';
            seccion.append(lotes);
            form.append(seccion);
        }
    }
    // Agrupa el cierre de la compra debajo del flujo de lotes.
    for (const nombre of ['metodo_pago', 'estado', 'total']) {
        resumen.append(resumen.querySelector(`[data-resumen="${nombre}"]`));
    }
    const seleccionarProveedor = () => {
        actualizarLaboratorios();
        const nombre = form.elements.id_distribuidor.value.trim().toLowerCase();
        const proveedor = proveedores.find(p => p.nombre.toLowerCase() === nombre);
        form.elements.telefono_distribuidor.value = proveedor?.telefono || '';
        form.elements.correo_distribuidor.value = proveedor?.correo || '';
    };
    form.elements.id_distribuidor.addEventListener('input', seleccionarProveedor);
    form.elements.id_distribuidor.addEventListener('change', seleccionarProveedor);
    form.elements.telefono_distribuidor.addEventListener('input', (e) => {
        const n = e.target.value.replace(/\D/g, '').slice(0, 8);
        e.target.value = n.length > 4 ? `${n.slice(0, 4)}-${n.slice(4)}` : n;
    });
    limpiarFormulario();
    configurarProveedores(proveedores);
}
// El modal reutiliza la consulta autorizada de Compras.
async function verLotes(compra) {
    // Una compra puede contener varios lotes: se pasa su ID para mostrar todos sus lotes.
    return window.inventarioLotes.abrir([compra], `Lotes de ${compra.numero_factura}`, { isModalMode: true, compraId: compra.id_compra, expandir: true });
}
document.getElementById('verLotesRegistrados')?.addEventListener('click', () => {
    const paginaLotes = document.getElementById('vistaInventarioLotes');
    if (paginaLotes && !paginaLotes.hidden) {
        window.inventarioCompras.mostrarRegistro();
        return;
    }
    window.inventarioLotes.abrir(comprasRegistradas, 'Inventario de Lotes', { isModalMode: false });
});
async function cargar() {
    const datos = await solicitar(window.farmacia.cargarCompras());
    catalogoMedicamentos = datos.medicamentos;
    comprasRegistradas = datos.compras;
    window.inventarioCompras?.actualizar(datos.compras, verLotes);
    const accesoLotes = document.getElementById('verLotesRegistrados');
    if (accesoLotes) accesoLotes.disabled = false;
    // Una ventana recargada puede seguir conectada al servicio anterior de Electron.
    // Conserva el correlativo visible también cuando esa respuesta aún no incluye la secuencia.
    siguienteFactura = datos.siguienteFactura || `FAC#${Math.max(0, ...datos.compras.map(compra => Number(compra.id_compra) || 0)) + 1}`;
    crearFormulario(datos.config, datos.proveedores);
}
window.addEventListener('lote-actualizado', async () => {
    try {
        const datos = await solicitar(window.farmacia.cargarCompras());
        comprasRegistradas = datos.compras;
        catalogoMedicamentos = datos.medicamentos;
        window.inventarioCompras?.actualizar(comprasRegistradas, verLotes);
    } catch (error) { mensaje(`El lote se guardó. No se pudo actualizar el historial: ${error.message}`, true); }
});
function confirmarCompra(datos) {
    const crear = (tag, texto, clase) => {
        const nodo = document.createElement(tag);
        if (texto !== undefined) nodo.textContent = texto;
        if (clase) nodo.className = clase;
        return nodo;
    };
    const dinero = centavos => 'L. ' + (centavos / 100).toLocaleString('es-HN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const modal = crear('dialog', undefined, 'compra-confirmacion');
    const titulo = crear('h2', 'Resumen de la compra'); titulo.id = 'confirmarCompraTitulo';
    modal.setAttribute('aria-labelledby', titulo.id);
    const proveedor = crear('p', `Proveedor: ${datos.id_distribuidor} · Fecha: ${datos.fecha_compra}`);
    const contenedor = crear('div', undefined, 'compra-confirmacion-tabla');
    const tabla = crear('table');
    const encabezado = tabla.createTHead().insertRow();
    ['Lote', 'Medicamento', 'Empaques', 'Precio por empaque', 'Total del lote'].forEach(texto => {const th = crear('th', texto); th.scope = 'col'; encabezado.append(th);});
    let total = 0;
    const cuerpo = tabla.createTBody();
    for (const lote of datos.lotes) {
        const subtotal = Math.round(Number(lote.precio) * 100) * Number(lote.cantidad);
        if (!Number.isSafeInteger(subtotal) || subtotal < 0) throw new Error('Revisá las cantidades y precios de la compra.');
        total += subtotal;
        const nombre = catalogoMedicamentos.find(m => String(m.id_medicamento) === String(lote.id_medicamento))?.nombre || 'Medicamento';
        const fila = cuerpo.insertRow();
        [lote.numero_lote || 'Automático al guardar', nombre, lote.cantidad, dinero(Math.round(Number(lote.precio) * 100)), dinero(subtotal)].forEach((valor, i) => {
            const celda = fila.insertCell(); celda.textContent = valor; if(i >= 2) celda.className = 'compra-confirmacion-numero';
        });
    }
    if (!Number.isSafeInteger(total) || total > 9999999999) throw new Error('El total excede el monto máximo de la compra.');
    const pie = tabla.createTFoot().insertRow(); const etiquetaTotal = crear('th', 'Total de la compra'); etiquetaTotal.colSpan = 4; etiquetaTotal.scope = 'row';
    pie.append(etiquetaTotal, crear('td', dinero(total), 'compra-confirmacion-numero'));
    contenedor.append(tabla);
    const pregunta = crear('p', '¿Seguro desea guardar esta compra?', 'compra-confirmacion-pregunta'); pregunta.hidden = true; pregunta.setAttribute('role', 'alert');
    const acciones = crear('div', undefined, 'compra-confirmacion-acciones');
    const aceptar = crear('button', 'Aceptar', 'btn btn-success'); aceptar.type = 'button'; aceptar.dataset.aceptarCompra = '';
    const cancelar = crear('button', 'Volver a editar', 'btn btn-secondary'); cancelar.type = 'button';
    acciones.append(aceptar, cancelar); modal.append(titulo, proveedor, contenedor, pregunta, acciones); document.body.append(modal);
    return new Promise(resolve => {
        let finalizado = false;
        const finalizar = confirmado => {
            if (finalizado) return;
            finalizado = true; modal.close(); modal.remove(); resolve(confirmado);
        };
        aceptar.onclick = () => {
            if (pregunta.hidden) {
                pregunta.hidden = false; titulo.textContent = 'Confirmar compra'; aceptar.textContent = 'Sí, guardar compra'; cancelar.textContent = 'Cancelar';
                aceptar.focus();
            } else finalizar(true);
        };
        cancelar.onclick = () => finalizar(false);
        modal.addEventListener('cancel', evento => {evento.preventDefault(); finalizar(false);});
        modal.addEventListener('close', () => finalizar(false), {once:true});
        modal.showModal(); aceptar.focus();
    });
}
form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (guardar.disabled) return;
    const actual = document.querySelector('[data-lote]');
    const incluirActual = loteActualTieneDatos(actual);
    // El editor vac?o no impide guardar los lotes ya a?adidos.
    if (actual && !incluirActual) actual.disabled = true;
    const valido = form.reportValidity();
    const datos = Object.fromEntries(new FormData(form));
    if (actual && !incluirActual) actual.disabled = false;
    if (!valido) return;
    datos.lotes = lotesAgregados.filter((lote, indice) => indice !== loteEnEdicion).map(lote => ({ ...lote.datos }));
    if (incluirActual) datos.lotes.push(datosLote(actual));
    if (!datos.lotes.length) { mensaje('Agregá al menos un lote a la compra.', true); return; }
    const controles = [...form.elements, ...document.querySelectorAll('#lotesAgregados button'), guardar, limpiar].map(c => [c, c.disabled]);
    controles.forEach(([c]) => { c.disabled = true; });
    let guardada = false;
    try {
        if (!await confirmarCompra(datos)) return;
        const resultado = await solicitar(window.farmacia.guardarCompra(datos));
        guardada = true;
        limpiarFormulario();
        mensaje(`Compra ${resultado.numero_factura} registrada.`);
        await cargar();
    } catch (error) {
        mensaje(guardada ? `La compra se guardó, pero no se pudo actualizar la lista: ${error.message}` : error.message, true);
    } finally {
        controles.forEach(([c, deshabilitado]) => { c.disabled = deshabilitado; });
        document.querySelectorAll('[data-campo="presentacion_ingreso"]').forEach(c => c.dispatchEvent(new Event('change')));
        document.querySelectorAll('[data-lote] fieldset[hidden]').forEach(c => { c.disabled = true; });
    }
});
limpiar.addEventListener('click', () => document.querySelector('[data-lote]')?.dispatchEvent(new Event('limpiar-lote')));
document.getElementById('logoutButton').addEventListener('click', async () => {
    try {
        await window.farmacia.cerrarSesion();
        window.location.replace('index.html');
    } catch (error) { mensaje(error.message, true); }
});
async function iniciar() {
    try {
        if (!window.farmacia) { window.location.replace('index.html'); return; }
        const respuesta = await window.farmacia.obtenerSesion();
        if (respuesta.error) throw new Error(respuesta.error);
        usuario = respuesta.usuario;
        if (!usuario || !['Administrador', 'Dispensador'].includes(usuario.rol)) { window.location.replace('index.html'); return; }
        document.getElementById('sessionUser').textContent = `${usuario.nombre} ${usuario.apellido}`;
        await cargar();
        guardar.disabled = limpiar.disabled = false;
    } catch (error) { mensaje(error.message, true); }
}
iniciar();



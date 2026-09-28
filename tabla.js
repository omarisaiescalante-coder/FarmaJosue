// Interfaz exclusiva de Compras y consulta de lotes asociados.
const form = document.getElementById('recordForm');
const guardar = document.getElementById('saveButton');
const limpiar = document.getElementById('clearButton');
let usuario;
let versionLotes = 0;
let catalogoMedicamentos = [];
let siguienteLote = 0;

function actualizarTotales() {
    let total = 0;
    for (const lote of document.querySelectorAll('[data-lote]')) {
        const cantidad = Number(lote.querySelector('[data-campo="cantidad"]').value);
        const precio = Number(lote.querySelector('[data-campo="precio"]').value);
        const centavos = Math.round(precio * 100) * cantidad;
        const subtotal = Number.isSafeInteger(centavos) && centavos >= 0 ? centavos : 0;
        lote.querySelector('[data-total-lote]').textContent = `Precio de compra total: L ${(subtotal / 100).toFixed(2)}`;
        total += subtotal;
    }
    form.elements.total.value = (total / 100).toFixed(2);
}

function agregarLote() {
    const lote = document.createElement('fieldset');
    lote.dataset.lote = '';
    lote.className = 'row g-3 border rounded p-3 mb-3';
    const leyenda = document.createElement('legend');
    leyenda.className = 'h6';
    leyenda.textContent = 'Lote';
    lote.append(leyenda);
    const numero = ++siguienteLote;
    for (const [campo, titulo, tipo] of [
        ['nombre_medicamento', 'Nombre del medicamento', 'text'], ['numero_lote', 'Número de lote', 'text'],
        ['id_medicamento', '', 'hidden'], ['laboratorio', '', 'hidden'],
        ['presentacion_ingreso', 'Tipo de empaque que ingresa', 'select'],
        ['contenido_caja', 'Contenido de la caja', 'select'],
        ['paquetes_por_caja', 'Blísteres por caja', 'number'],
        ['unidades_por_blister', 'Pastillas por blíster', 'number'],
        ['precio_venta', 'Precio de venta por empaque (L)', 'number'],
        ['precio_venta_contenido', 'Precio de venta por blíster (L)', 'number'],
        ['precio_venta_unidad', 'Precio de venta por unidad (L)', 'number'],
        ['cantidad', 'Cantidad de empaques a ingresar', 'number'],
        ['fecha_fabricacion', 'Fecha de fabricación', 'date'], ['fecha_vencimiento', 'Fecha de vencimiento', 'date'],
        ['precio', 'Precio de compra por empaque (L)', 'number'],
    ]) {
        const grupo = document.createElement('div');
        grupo.className = 'col-12 col-md-6';
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = titulo;
        const input = document.createElement(tipo === 'select' ? 'select' : 'input');
        input.id = `lote-${numero}-${campo}`;
        label.htmlFor = input.id;
        input.dataset.campo = campo;
        input.className = 'form-control';
        input.required = tipo !== 'hidden' && campo !== 'numero_lote';
        if (tipo === 'select') {
                input.add(new Option('Seleccioná...', ''));
                const opciones = campo === 'contenido_caja' ? ['Blister', 'Sobre'] : ['Caja', 'Frasco', 'Ampolla', 'Suero'];
                for (const opcion of opciones) input.add(new Option(opcion === 'Blister' ? 'Blíster' : opcion, opcion));
        } else input.type = tipo;
        if (tipo === 'hidden') grupo.hidden = true;
        if (campo === 'numero_lote') { input.maxLength = 50; input.placeholder = 'Escribí el lote o dejá vacío para generarlo'; }
        if (campo === 'nombre_medicamento') { input.maxLength = 150; input.autocomplete = 'off'; }
        if (['paquetes_por_caja', 'unidades_por_blister'].includes(campo)) { input.min = 1; input.step = 1; input.max = 2147483647; }
        if (campo.startsWith('precio_venta')) { input.min = '0.01'; input.step = '0.01'; input.max = '99999999.99'; }
        if (campo === 'cantidad') { input.min = 1; input.step = 1; input.max = 2147483647; }
        if (campo === 'precio') { input.min = 0; input.step = '0.01'; input.max = '99999999.99'; }
        grupo.append(label, input);
        lote.append(grupo);
    }
    const campo = nombre => lote.querySelector(`[data-campo="${nombre}"]`);
    const stock = document.createElement('p'); stock.className = 'col-12 text-secondary';
    const total = document.createElement('p'); total.className = 'col-12 fw-semibold'; total.dataset.totalLote = '';
    total.textContent = 'Precio de compra total: L 0.00';
    const notaPrecios = document.createElement('p'); notaPrecios.className = 'col-12 text-secondary';
    notaPrecios.textContent = 'Completá los precios de las presentaciones que venderás; para cajas, ingresá al menos uno.';
    lote.append(stock, total, notaPrecios);
    const ajustarEmpaque = () => {
        const caja = campo('presentacion_ingreso').value === 'Caja';
        const blister = campo('contenido_caja').value === 'Blister';
        const contenido = Boolean(campo('contenido_caja').value);
        for (const nombre of ['contenido_caja', 'paquetes_por_caja', 'unidades_por_blister', 'precio_venta_contenido', 'precio_venta_unidad']) {
            const visible = caja && (nombre === 'contenido_caja' || contenido) && (!['unidades_por_blister', 'precio_venta_unidad'].includes(nombre) || blister);
            campo(nombre).parentElement.hidden = !visible;
            campo(nombre).disabled = !visible;
            campo(nombre).required = visible && !nombre.startsWith('precio_venta');
        }
        campo('precio_venta').required = !caja;
        campo('precio_venta').previousElementSibling.textContent = caja ? 'Precio de venta de la caja completa (L)' : 'Precio de venta unitario (L)';
        campo('precio_venta_unidad').previousElementSibling.textContent = 'Precio de venta por pastilla (L)';
        campo('paquetes_por_caja').previousElementSibling.textContent = blister ? 'Blísteres por caja' : 'Sobres por caja';
        campo('precio_venta_contenido').previousElementSibling.textContent = blister ? 'Precio de venta por blíster (L)' : 'Precio de venta por sobre (L)';
        campo('cantidad').previousElementSibling.textContent = caja ? 'Cantidad de cajas a ingresar' : 'Cantidad de empaques a ingresar';
    };
    campo('presentacion_ingreso').addEventListener('change', ajustarEmpaque);
    campo('contenido_caja').addEventListener('change', ajustarEmpaque);
    campo('id_medicamento').addEventListener('change', () => {
        const medicamento = catalogoMedicamentos.find(m => String(m.id_medicamento) === campo('id_medicamento').value);
        campo('laboratorio').value = form.elements.id_distribuidor.value.trim();
        stock.textContent = medicamento ? `Stock actual: ${medicamento.stock_total || 0} unidades` : '';
        campo('precio_venta').value = Number(medicamento?.precio_venta) > 0 ? medicamento.precio_venta : '';
        campo('presentacion_ingreso').value = ['Caja', 'Frasco', 'Ampolla', 'Suero'].includes(medicamento?.forma_venta) ? medicamento.forma_venta : '';
        for (const nombre of ['contenido_caja', 'paquetes_por_caja', 'unidades_por_blister', 'precio_venta_contenido', 'precio_venta_unidad']) campo(nombre).value = '';
        ajustarEmpaque();
        actualizarLaboratorios();
    });
    agregarRegistroMedicamento(lote, campo('id_medicamento'), campo('nombre_medicamento'));
    ajustarEmpaque();
    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.className = 'btn btn-outline-danger col-auto';
    quitar.textContent = 'Quitar lote';
    quitar.addEventListener('click', () => { lote.remove(); actualizarTotales(); actualizarLaboratorios(); });
    lote.append(quitar);
    const detalle = document.createElement('div');
    detalle.className = 'row g-3';
    detalle.id = `detalle-lote-${numero}`;
    detalle.dataset.detalleLote = '';
    detalle.append(...[...lote.children].filter(elemento => elemento !== leyenda));
    const desplegar = document.createElement('button');
    desplegar.type = 'button';
    desplegar.className = 'btn btn-link text-success p-0 text-start';
    desplegar.textContent = 'Lote';
    desplegar.setAttribute('aria-controls', detalle.id);
    const mostrarDetalle = visible => {
        detalle.hidden = !visible;
        desplegar.setAttribute('aria-expanded', String(visible));
    };
    desplegar.addEventListener('click', () => mostrarDetalle(detalle.hidden));
    leyenda.replaceChildren(desplegar);
    const guardarLote = document.createElement('button');
    guardarLote.type = 'button';
    guardarLote.className = 'btn btn-success col-auto';
    guardarLote.textContent = 'Guardar lote';
    guardarLote.dataset.guardarLote = '';
    guardarLote.addEventListener('click', () => {
        if (![...detalle.querySelectorAll('[data-campo]')].every(input => input.reportValidity())) return;
        if (campo('presentacion_ingreso').value === 'Caja' &&
            !['precio_venta', 'precio_venta_contenido', 'precio_venta_unidad'].some(nombre => !campo(nombre).disabled && Number(campo(nombre).value) > 0)) {
            mensaje('Ingresá al menos un precio de venta para la caja.', true);
            campo('precio_venta').focus();
            return;
        }
        desplegar.textContent = campo('nombre_medicamento').value.trim();
        mostrarDetalle(false);
        actualizarTotales();
        desplegar.focus();
    });
    lote.addEventListener('invalid', () => mostrarDetalle(true), true);
    detalle.append(guardarLote);
    lote.append(detalle);
    mostrarDetalle(true);
    lote.addEventListener('input', actualizarTotales);
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
    seccion.className = 'col-12';
    const abrir = document.createElement('button');
    abrir.type = 'button'; abrir.className = 'btn btn-outline-success';
    abrir.textContent = 'Continuar';
    const pregunta = document.createElement('p');
    pregunta.textContent = '¿Quieres registrar medicamento?';
    pregunta.hidden = abrir.hidden = true;
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
    guardarNuevo.className = 'btn btn-success col-auto'; guardarNuevo.textContent = 'Guardar medicamento y continuar';
    const cancelar = document.createElement('button'); cancelar.type = 'button';
    cancelar.className = 'btn btn-secondary col-auto'; cancelar.textContent = 'Cancelar';
    const estado = document.createElement('p'); estado.setAttribute('role', 'status');
    const cerrar = () => {
        modal.close();
        panel.hidden = panel.disabled = true;
        pregunta.hidden = abrir.hidden = cancelarAviso.hidden = true;
    };
    modal.addEventListener('cancel', evento => {
        evento.preventDefault();
        if (!guardarNuevo.disabled) cerrar();
    });
    const mostrar = (enfocar = true) => {
        campos.nombre.value = buscador.value.trim();
        panel.hidden = panel.disabled = false;
        pregunta.hidden = abrir.hidden = cancelarAviso.hidden = true;
        estado.textContent = '';
        if (!modal.open) modal.showModal();
        if (enfocar) campos.nombre.focus();
    };
    abrir.addEventListener('click', () => mostrar());
    cancelar.addEventListener('click', cerrar);
    cancelarAviso.addEventListener('click', () => { cerrar(); buscador.focus(); });
    const lista = document.createElement('datalist'); lista.id = `${selector.id}-opciones`;
    const llenarLista = () => lista.replaceChildren(...catalogoMedicamentos.map(m => new Option(m.codigo, m.nombre)));
    llenarLista(); buscador.setAttribute('list', lista.id); seccion.append(lista);
    const buscar = (confirmar = false) => {
        const nombre = buscador.value.trim();
        const medicamento = catalogoMedicamentos.find(m => m.nombre.toLocaleLowerCase('es') === nombre.toLocaleLowerCase('es'));
        const id = medicamento ? String(medicamento.id_medicamento) : '';
        if (selector.value !== id) { selector.value = id; selector.dispatchEvent(new Event('change')); }
        buscador.setCustomValidity(nombre && !medicamento ? 'Registrá este medicamento para continuar.' : '');
        if (medicamento || !nombre) cerrar();
        else if (confirmar && !modal.open) {
            pregunta.textContent = `El medicamento “${nombre}” no existe. ¿Quieres registrar un nuevo medicamento?`;
            pregunta.hidden = abrir.hidden = cancelarAviso.hidden = false;
            modal.showModal();
            abrir.focus();
        }
    };
    buscador.addEventListener('input', () => buscar());
    buscador.addEventListener('change', () => buscar(true));
    buscador.addEventListener('keydown', evento => {
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
            for (const lista of document.querySelectorAll('[data-lote] datalist'))
                lista.append(new Option(medicamento.codigo, medicamento.nombre));
            selector.value = medicamento.id_medicamento;
            buscador.value = medicamento.nombre;
            buscador.setCustomValidity('');
            selector.dispatchEvent(new Event('change'));
            cerrar();
            mensaje(`Medicamento ${medicamento.codigo} registrado. Completá los datos del lote.`);
        } catch (error) { estado.textContent = error.message; }
        finally { guardarNuevo.disabled = cancelar.disabled = guardar.disabled = false; }
    });
    panel.append(guardarNuevo, cancelar, estado);
    modal.append(titulo, pregunta, abrir, cancelarAviso, panel);
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
    form.reset();
    document.getElementById('lotesNuevos').replaceChildren();
    siguienteLote = 0;
    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    form.elements.numero_factura.value = 'Se asigna al guardar';
    form.elements.id_usuario.value = usuario.id_usuario;
    form.elements.fecha_compra.value = fecha;
    form.elements.fecha_compra.max = fecha;
    actualizarTotales();
}
function crearFormulario(config, proveedores) {
    form.replaceChildren();
    for (const campo of config.fields) {
        const grupo = document.createElement('div');
        grupo.className = 'col-12 col-md-6';
        const label = document.createElement('label');
        label.textContent = campo.label;
        label.htmlFor = campo.name;
        label.className = 'form-label';
        const input = document.createElement(campo.type === 'select' ? 'select' : 'input');
        input.id = input.name = campo.name;
        input.className = 'form-control';
        input.required = Boolean(campo.required);
        if (campo.type === 'select') {
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
        if (campo.type === 'hidden') grupo.hidden = true;
        form.append(grupo);
        if (campo.name === 'fecha_compra') {
            const seccion = document.createElement('div');
            seccion.className = 'col-12';
            const lotes = document.createElement('div');
            lotes.id = 'lotesNuevos';
            const agregar = document.createElement('button');
            agregar.type = 'button';
            agregar.className = 'btn btn-outline-success';
            agregar.textContent = '+ Añadir otro lote';
            agregar.addEventListener('click', agregarLote);
            seccion.append(lotes, agregar);
            form.append(seccion);
        }
    }
    const lista = document.createElement('datalist');
    lista.id = 'proveedores';
    for (const proveedor of proveedores) {
        const opcion = document.createElement('option');
        opcion.value = proveedor.nombre;
        lista.append(opcion);
    }
    form.append(lista);
    form.elements.id_distribuidor.setAttribute('list', lista.id);
    form.elements.id_distribuidor.addEventListener('input', () => {
        actualizarLaboratorios();
        const nombre = form.elements.id_distribuidor.value.trim().toLowerCase();
        const proveedor = proveedores.find(p => p.nombre.toLowerCase() === nombre);
        form.elements.telefono_distribuidor.value = proveedor?.telefono || '';
        form.elements.correo_distribuidor.value = proveedor?.correo || '';
    });
    form.elements.telefono_distribuidor.addEventListener('input', (e) => {
        const n = e.target.value.replace(/\D/g, '').slice(0, 8);
        e.target.value = n.length > 4 ? `${n.slice(0, 4)}-${n.slice(4)}` : n;
    });
    limpiarFormulario();
}
function tabla(id, columnas, filas, accion) {
    const contenedor = document.getElementById(id);
    contenedor.replaceChildren();
    if (!filas.length) { contenedor.textContent = 'No hay registros asociados.'; return; }
    const elemento = document.createElement('table');
    elemento.className = 'table table-striped align-middle';
    const encabezado = elemento.createTHead().insertRow();
    for (const titulo of [...columnas.map(c => c[1]), ...(accion ? ['Lotes'] : [])]) {
        const celda = document.createElement('th');
        celda.scope = 'col';
        celda.textContent = titulo;
        encabezado.append(celda);
    }
    const cuerpo = elemento.createTBody();
    for (const registro of filas) {
        const fila = cuerpo.insertRow();
        for (const [campo] of columnas) fila.insertCell().textContent = registro[campo] ?? '';
        if (accion) {
            const boton = document.createElement('button');
            boton.type = 'button';
            boton.className = 'btn btn-outline-success';
            boton.textContent = 'Ver lotes';
            boton.addEventListener('click', () => accion(registro));
            fila.insertCell().append(boton);
        }
    }
    contenedor.append(elemento);
}
async function verLotes(compra) {
    const version = ++versionLotes;
    document.getElementById('lotesSection').hidden = false;
    document.getElementById('lotesTitle').textContent = `Lotes de ${compra.numero_factura}`;
    const contenedor = document.getElementById('lotesContainer');
    contenedor.textContent = 'Cargando lotes...';
    try {
        const filas = await solicitar(window.farmacia.listarLotesCompra(compra.id_compra));
        if (version !== versionLotes) return;
        tabla('lotesContainer', [
            ['numero_lote', 'Lote'], ['medicamento', 'Medicamento'],
            ['presentacion_ingreso', 'Empaque'],
            ['contenido_caja', 'Contenido de caja'], ['paquetes_por_caja', 'Blísteres/sobres por caja'],
            ['unidades_por_blister', 'Unidades por blíster'], ['cantidad_empaques', 'Empaques recibidos'],
            ['precio_empaque', 'Compra por empaque (L)'], ['precio_venta', 'Venta por empaque (L)'],
            ['precio_venta_contenido', 'Venta por blíster/sobre (L)'], ['precio_venta_unidad', 'Venta por unidad (L)'],
            ['cantidad_inicial', 'Cantidad inicial'], ['cantidad_disponible', 'Disponible'],
            ['fecha_fabricacion', 'Fabricación'], ['fecha_vencimiento', 'Vencimiento'],
            ['precio_compra', 'Costo unitario (L)'], ['costo_total', 'Costo total (L)'], ['estado', 'Estado'],
        ], filas);
    } catch (error) { if (version === versionLotes) contenedor.textContent = error.message; }
}
async function cargar() {
    const datos = await solicitar(window.farmacia.cargarCompras());
    catalogoMedicamentos = datos.medicamentos;
    crearFormulario(datos.config, datos.proveedores);
    tabla('tableContainer', datos.config.fields.filter(c => !c.virtual && c.showInTable !== false)
        .map(c => [c.displayName || c.name, c.label]), datos.compras, verLotes);
}
form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (guardar.disabled || !form.reportValidity()) return;
    const datos = Object.fromEntries(new FormData(form));
    datos.lotes = [...document.querySelectorAll('[data-lote]')].map(lote =>
        ({ ...Object.fromEntries([...lote.querySelectorAll('[data-campo]')]
            .filter(input => !input.disabled && !['nombre_medicamento', 'laboratorio'].includes(input.dataset.campo))
            .map(input => [input.dataset.campo, input.value])), numero_automatico: !lote.querySelector('[data-campo="numero_lote"]').value.trim() }));
    if (!datos.lotes.length) { mensaje('Agregá al menos un lote a la compra.', true); return; }
    const controles = [...form.elements, guardar, limpiar].map(c => [c, c.disabled]);
    controles.forEach(([c]) => { c.disabled = true; });
    let guardada = false;
    try {
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
limpiar.addEventListener('click', limpiarFormulario);
document.getElementById('backButton').addEventListener('click', () => { window.location.href = 'index.html'; });
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
        if (!usuario) { window.location.replace('index.html'); return; }
        document.getElementById('sessionUser').textContent = `${usuario.nombre} ${usuario.apellido}`;
        await cargar();
        guardar.disabled = limpiar.disabled = false;
    } catch (error) { mensaje(error.message, true); }
}
iniciar();

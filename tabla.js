// Interfaz exclusiva de Compras y consulta de lotes asociados.
const form = document.getElementById('recordForm');
const guardar = document.getElementById('saveButton');
const limpiar = document.getElementById('clearButton');
let usuario;
let versionLotes = 0;
let catalogoMedicamentos = [];
let siguienteLote = 0;
let siguienteFactura;

function actualizarTotales() {
    let total = 0;
    for (const lote of document.querySelectorAll('[data-lote]')) {
        const cantidad = Number(lote.querySelector('[data-campo="cantidad"]').value);
        const precio = Number(lote.querySelector('[data-campo="precio"]').value);
        const centavos = Math.round(precio * 100) * cantidad;
        const subtotal = Number.isSafeInteger(centavos) && centavos >= 0 ? centavos : 0;
        lote.querySelector('[data-total-lote]').textContent = `Precio de compra total: L ${(subtotal / 100).toFixed(2)}`;
        const forma = lote.querySelector('[data-campo="presentacion_ingreso"]').value;
        const paquetes = Number(lote.querySelector('[data-campo="paquetes_por_caja"]').value);
        const pastillas = Number(lote.querySelector('[data-campo="unidades_por_blister"]').value);
        const unidades = cantidad * (forma === 'Caja' ? paquetes * pastillas : forma === 'Sueros por caja' ? paquetes : 1);
        lote.querySelector('[data-unidades-lote]').textContent = `Unidades totales a ingresar: ${Number.isSafeInteger(unidades) && unidades >= 0 ? unidades : 0}`;
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
        ['cantidad', 'Cantidad de empaques a ingresar', 'number'],
        ['paquetes_por_caja', 'Blísteres por caja', 'number'],
        ['unidades_por_blister', 'Pastillas por blíster', 'number'],
        ['precio', 'Precio de compra por caja contenedora', 'number'],
        ['precio_venta', 'Precio de venta unitario (L)', 'number'],
        ['precio_venta_contenido', 'Precio de venta por blíster (L)', 'number'],
        ['precio_venta_unidad', 'Precio de venta por unidad (L)', 'number'],
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
                const opciones = campo === 'contenido_caja' ? ['Blister', 'Suero'] : ['Caja', 'Frasco', 'Ampolla', 'Suero', 'Sueros por caja'];
                const etiquetas = { Caja: 'Caja de pastillas', Suero: campo === 'contenido_caja' ? 'Suero' : 'Suero unitario', Blister: 'Blíster' };
                for (const opcion of opciones) input.add(new Option(etiquetas[opcion] || opcion, opcion));
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
    const separador = document.createElement('h3');
    separador.className = 'col-12 lote-separador-venta';
    separador.textContent = 'PRECIOS PARA VENTA FINAL';
    campo('precio_venta').parentElement.before(separador);
    campo('precio').parentElement.className = 'col-12 col-md-6';
    for (const nombres of [['fecha_fabricacion', 'fecha_vencimiento']]) {
        const fila = document.createElement('div');
        fila.className = 'col-12';
        const columnas = document.createElement('div');
        columnas.className = 'row g-3';
        campo(nombres[0]).parentElement.before(fila);
        for (const nombre of nombres) columnas.append(campo(nombre).parentElement);
        fila.append(columnas);
    }
    const stock = document.createElement('p'); stock.className = 'col-12 text-secondary';
    const total = document.createElement('p'); total.className = 'col-12 lote-total-compra'; total.dataset.totalLote = '';
    const unidadesTotal = document.createElement('p'); unidadesTotal.className = 'col-12 text-secondary'; unidadesTotal.dataset.unidadesLote = '';
    total.textContent = 'Precio de compra total: L 0.00';
    const notaPrecios = document.createElement('p'); notaPrecios.className = 'col-12 text-secondary';
    notaPrecios.textContent = 'Completá los precios de las presentaciones que venderás; para cajas, ingresá al menos uno.';
    lote.append(stock, unidadesTotal, total, notaPrecios);
    const ajustarEmpaque = () => {
        const caja = campo('presentacion_ingreso').value === 'Caja';
        const sueros = campo('presentacion_ingreso').value === 'Sueros por caja';
        campo('contenido_caja').value = caja ? 'Blister' : sueros ? 'Suero' : '';
        campo('contenido_caja').parentElement.hidden = true;
        campo('contenido_caja').disabled = !caja && !sueros;
        campo('contenido_caja').required = false;
        for (const nombre of ['contenido_caja', 'paquetes_por_caja', 'unidades_por_blister', 'precio_venta_contenido', 'precio_venta_unidad']) {
            if (nombre === 'contenido_caja') continue;
            const visible = nombre === 'paquetes_por_caja' ? caja || sueros
                : nombre === 'precio_venta_contenido' ? caja || sueros : caja;
            campo(nombre).parentElement.hidden = !visible;
            campo(nombre).disabled = !visible;
            campo(nombre).required = visible && !nombre.startsWith('precio_venta');
        }
        campo('precio_venta').required = !caja && !sueros;
        campo('precio_venta').previousElementSibling.textContent = caja || sueros ? 'Precio de venta por caja (L)' : 'Precio de venta unitario (L)';
        campo('precio').previousElementSibling.textContent = caja ? 'Precio de compra de la caja contenedora (L)' : sueros ? 'Precio de compra de la caja (L)' : 'Precio de compra unitario (L)';
        campo('precio_venta_unidad').previousElementSibling.textContent = 'Precio de venta por pastilla (L)';
        campo('paquetes_por_caja').previousElementSibling.textContent = caja ? 'Cantidad de blísteres por caja' : 'Cantidad de sueros por caja';
        campo('precio_venta_contenido').previousElementSibling.textContent = caja ? 'Precio de venta por blíster (L)' : 'Precio de venta unitario (L)';
        campo('cantidad').previousElementSibling.textContent = caja
            ? 'Cantidad de cajas contenedoras' : sueros ? 'Cantidad de cajas'
            : (['Frasco', 'Suero', 'Ampolla'].includes(campo('presentacion_ingreso').value) ? 'Cantidad de unidades' : 'Cantidad de empaques a ingresar');
        unidadesTotal.hidden = !caja && !sueros;
        if (lote.isConnected) actualizarTotales();
    };
    campo('presentacion_ingreso').addEventListener('change', ajustarEmpaque);
    campo('contenido_caja').addEventListener('change', ajustarEmpaque);
    campo('id_medicamento').addEventListener('change', () => {
        const medicamento = catalogoMedicamentos.find(m => String(m.id_medicamento) === campo('id_medicamento').value);
        campo('laboratorio').value = form.elements.id_distribuidor.value.trim();
        stock.textContent = medicamento ? `Stock actual: ${medicamento.stock_total || 0} unidades` : '';
        campo('precio_venta').value = Number(medicamento?.precio_venta) > 0 ? medicamento.precio_venta : '';
        campo('presentacion_ingreso').value = ['Caja', 'Frasco', 'Ampolla', 'Suero', 'Sueros por caja'].includes(medicamento?.forma_venta) ? medicamento.forma_venta : '';
        for (const nombre of ['contenido_caja', 'paquetes_por_caja', 'unidades_por_blister', 'precio_venta_contenido', 'precio_venta_unidad']) campo(nombre).value = '';
        ajustarEmpaque();
        actualizarLaboratorios();
    });
    agregarRegistroMedicamento(lote, campo('id_medicamento'), campo('nombre_medicamento'));
    ajustarEmpaque();
    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.className = 'btn btn-outline-danger col-auto';
    quitar.textContent = 'Cancelar lote';
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
        if (['Caja', 'Sueros por caja'].includes(campo('presentacion_ingreso').value) &&
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
    document.getElementById('numero_factura').textContent = siguienteFactura;
    document.getElementById('id_usuario').textContent = [usuario.nombre, usuario.apellido].filter(Boolean).join(' ');
    form.elements.fecha_compra.value = fecha;
    form.elements.fecha_compra.max = fecha;
    actualizarTotales();
}
function crearFormulario(config, proveedores) {
    form.replaceChildren();
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
            const agregar = document.createElement('button');
            agregar.type = 'button';
            agregar.className = 'btn btn-outline-success';
            agregar.textContent = '+ Añadir lote';
            agregar.addEventListener('click', agregarLote);
            seccion.append(lotes, agregar);
            form.append(seccion);
        }
    }
    // Agrupa el cierre de la compra en el panel lateral de pagos.
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
    // Una ventana recargada puede seguir conectada al servicio anterior de Electron.
    // Conserva el correlativo visible también cuando esa respuesta aún no incluye la secuencia.
    siguienteFactura = datos.siguienteFactura || `FAC#${Math.max(0, ...datos.compras.map(compra => Number(compra.id_compra) || 0)) + 1}`;
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



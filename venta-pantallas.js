// Pantalla de ventas: búsqueda, resumen en tiempo real, descuentos, ISV, DNI y pago.
// Los cálculos vienen de calculos-venta.js (los mismos que usa el servidor).
const C = window.CalculosVenta;
let catalogo = { medicamentos: [], presentaciones: [] };
let carrito = new Map();     // id_presentacion -> línea de la venta
let edadManual = false;      // true si el cajero escribió la edad a mano
let dniTocado = false;       // true cuando el cajero salió del campo DNI
let guardandoVenta = false;

const $ = (id) => document.getElementById(id);
const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lempiras = (centavos) => 'L. ' + (centavos / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Notificaciones pequeñas tipo burbuja: aparecen unos segundos y se quitan solas.
// El contenedor es un popover (capa superior), así se ve también sobre los diálogos abiertos.
const DURACION_TOAST = { success: 2500, info: 2500, warning: 3500, danger: 3500 };
function quitarToast(toast) {
    const cont = $('toastContenedor');
    if (!toast.isConnected) return;
    toast.classList.add('saliendo');
    setTimeout(() => {
        toast.remove();
        if (!cont.children.length && cont.matches(':popover-open')) cont.hidePopover();
    }, 250);
}
function mostrarMensaje(texto, tipo = 'danger') {
    if (!texto) return;
    const cont = $('toastContenedor');
    [...cont.children].forEach((t) => { if (t.dataset.texto === texto) t.remove(); });   // sin duplicados
    while (cont.children.length >= 3) cont.firstElementChild.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-burbuja toast-' + tipo;
    toast.setAttribute('role', tipo === 'danger' ? 'alert' : 'status');
    toast.dataset.texto = texto;
    toast.textContent = texto;
    cont.append(toast);
    // Se reabre para quedar por encima de cualquier diálogo que se haya abierto después.
    if (cont.matches(':popover-open')) cont.hidePopover();
    cont.showPopover();
    setTimeout(() => quitarToast(toast), DURACION_TOAST[tipo] || 3500);
}
// Al corregir un error (por ejemplo, ya hay cantidad válida) se retiran los avisos de error.
const ocultarMensaje = () => $('toastContenedor').querySelectorAll('.toast-danger').forEach(quitarToast);

const lineas = () => [...carrito.values()];
const hayReceta = () => lineas().some((l) => l.restriccion === 'Con Receta Medica');
const unidadesReservadas = (idMed) => lineas()
    .filter((l) => l.id_medicamento === idMed).reduce((s, l) => s + l.cantidad * l.unidades_stock, 0);

// En los medicamentos que vienen en blíster, la presentación "Unidad" es la pastilla.
function etiqueta(pres) {
    const enBlister = catalogo.presentaciones.some((p) => p.id_medicamento === pres.id_medicamento && /^bl[ií]ster$/i.test(p.nombre_presentacion));
    return enBlister && /^unidad$/i.test(pres.nombre_presentacion) ? 'Pastilla' : pres.nombre_presentacion;
}

// ---------- Búsqueda de medicamentos ----------
// Unidades de un medicamento (en su lote visible) que ya están en la venta actual.
const reservadasEnLote = (idMed, idLote) => lineas()
    .filter((l) => l.id_medicamento === idMed && (idLote == null || l.id_lote == null || l.id_lote === idLote))
    .reduce((s, l) => s + l.cantidad * l.unidades_stock, 0);

function pintarResultados() {
    const q = normalizar($('buscarMedicamento').value.trim());
    const lista = catalogo.medicamentos.filter((m) => normalizar(m.nombre).includes(q)).slice(0, 50);
    const porMedicamento = new Map();
    for (const pres of catalogo.presentaciones) {
        const idLote = pres.id_lote_catalogo ?? pres.id_lote;
        const grupo = porMedicamento.get(pres.id_medicamento);
        if (!grupo) {
            porMedicamento.set(pres.id_medicamento, { idLote, presentaciones: [pres] });
        } else if (grupo.idLote === idLote) {
            grupo.presentaciones.push(pres);
        }
    }
    $('resultados').innerHTML = lista.map((m) => {
        const pres = porMedicamento.get(m.id_medicamento)?.presentaciones || [];
        const lote = pres[0];
        const vence = lote?.vence_lote ? ' · Vence ' + lote.vence_lote.split('-').reverse().join('/') : '';
        const existencias = lote
            ? (lote.numero_lote ? 'Lote ' + lote.numero_lote + vence + ': ' : '')
                + window.textoStockEmpaque(lote, Math.max(0,
                    Number(lote.cantidad_disponible ?? m.stock_total) - reservadasEnLote(m.id_medicamento, lote.id_lote)))
            : '';
        return `<div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
                <strong>${escapar(m.nombre)}${m.restriccion === 'Con Receta Medica' ? ' <span class="badge text-bg-warning">Receta</span>' : ''}</strong>
                <small class="text-secondary">${escapar(existencias)}</small>
            </div>
            ${pres.map((p) => `<div class="d-flex justify-content-between align-items-center mt-1">
                <span>${escapar(etiqueta(p))}: <strong>L. ${Number(p.precio_venta).toFixed(2)}</strong></span>
                <button class="btn btn-sm btn-success" type="button" data-mas="${p.id_presentacion}"
                    aria-label="Agregar ${escapar(etiqueta(p))} de ${escapar(m.nombre)}">+</button>
            </div>`).join('')}
        </div>`;
    }).join('') || '<div class="list-group-item text-secondary">No se encontraron medicamentos.</div>';
}

// Suma o resta una unidad de una presentación (cada clic en + incrementa la cantidad).
function cambiarCantidad(id, delta) {
    const nueva = (carrito.get(id)?.cantidad || 0) + delta;
    if (nueva <= 0) {
        carrito.delete(id);
    } else {
        const error = fijarCantidad(id, nueva);
        if (error) return mostrarMensaje(error);
        ocultarMensaje();
    }
    pintarCarrito();
    pintarResultados();
    actualizarVenta();
}

function fijarCantidad(id, nueva) {
    if (!Number.isSafeInteger(nueva) || nueva < 1 || nueva > 2147483647)
        return 'Ingresa una cantidad entera válida, mayor que cero.';
    const pres = catalogo.presentaciones.find((p) => p.id_presentacion === id);
    const med = pres && catalogo.medicamentos.find((m) => m.id_medicamento === pres.id_medicamento);
    if (!pres || !med) return 'La presentación no está disponible.';
    const actual = carrito.get(id)?.cantidad || 0;
    const unidadesStock = Number(pres.unidades_stock);
    const otras = unidadesReservadas(med.id_medicamento) - actual * unidadesStock;
    if (otras + nueva * unidadesStock > Number(med.stock_total))
        return 'No hay existencias suficientes de ' + med.nombre + '.';
    if (pres.id_lote) {
        const reservadas = lineas().filter(l => l.id_lote === pres.id_lote && l.id_presentacion !== id)
            .reduce((s, l) => s + l.cantidad * l.unidades_stock, 0);
        if (reservadas + nueva * unidadesStock > Number(pres.cantidad_disponible))
            return 'No hay existencias suficientes del lote seleccionado.';
    }
    carrito.set(id, {
        id_lote: pres.id_lote,
        id_presentacion: id, id_medicamento: med.id_medicamento, nombre: med.nombre, restriccion: med.restriccion,
        presentacion: etiqueta(pres), precioCentavos: Math.round(Number(pres.precio_venta) * 100),
        unidades_stock: unidadesStock, aplicaIsv: Number(med.aplica_isv) === 1, cantidad: nueva,
    });
    return '';
}

// ---------- Cálculos ----------
function edadIngresada() {
    const v = $('edad').value;
    if (v === '') return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 120 ? n : NaN;
}
function calcular() {
    const edad = edadIngresada();
    return C.calcularVenta(
        lineas().map((l) => ({ precio: l.precioCentavos, cantidad: l.cantidad, aplicaIsv: l.aplicaIsv })),
        Number.isNaN(edad) ? null : edad);
}
function recibidoCentavos() {
    const v = $('recibido').value;
    if (v === '' || !Number.isFinite(Number(v)) || Number(v) < 0) return null;
    return Math.round(Number(v) * 100);
}

// ---------- DNI ----------
function actualizarDni() {
    const requerido = hayReceta();
    const dni = $('dni').value;
    $('dniEtiqueta').textContent = requerido ? 'DNI (Obligatorio por receta médica)' : 'DNI (No obligatorio)';
    $('dniEtiqueta').classList.toggle('text-danger', requerido);
    $('dni').classList.toggle('is-invalid', Boolean(dni) && !C.dniValido(dni) && (dni.length === 15 || dniTocado));
}

// ---------- Validación y pago ----------
function errorVenta(calc) {
    const cantidadInvalida = $('carrito').querySelector('[data-cantidad-venta]:invalid');
    if (cantidadInvalida) return cantidadInvalida.validationMessage;
    if (!carrito.size) return 'Agrega al menos un medicamento.';
    const dni = $('dni').value;
    if (hayReceta() && !dni) return 'El DNI es obligatorio: hay medicamentos con receta médica.';
    if (dni && !C.dniValido(dni)) return 'Ingresa un DNI válido (0000-0000-00000).';
    if (Number.isNaN(edadIngresada())) return 'La edad del cliente no es válida.';
    if ($('metodoPago').value === 'Efectivo') {
        const r = recibidoCentavos();
        if (r === null) return 'Ingresa el dinero recibido del cliente.';
        const pago = C.calcularCambio(calc.total, r);
        if (!pago.suficiente) return 'Pago insuficiente: faltan ' + lempiras(pago.faltante) + '.';
    }
    return null;
}

function actualizarPago(calc) {
    const efectivo = $('metodoPago').value === 'Efectivo';
    $('bloqueEfectivo').hidden = !efectivo;
    if (!efectivo) return;
    const r = recibidoCentavos(), caja = $('resCambio');
    if (r === null || !calc.total) { caja.className = 'fs-5 fw-semibold'; caja.textContent = 'Cambio: —'; return; }
    const pago = C.calcularCambio(calc.total, r);
    caja.className = 'fs-5 fw-semibold ' + (pago.suficiente ? 'text-success' : 'text-danger');
    caja.textContent = pago.suficiente ? 'Cambio: ' + lempiras(pago.cambio) : 'Pago insuficiente: faltan ' + lempiras(pago.faltante);
}

// ---------- Resumen en tiempo real ----------
function pintarCarrito() {
    $('carrito').innerHTML = lineas().map((l) => `
        <tr>
            <td>${escapar(l.nombre)} <small class="text-secondary">(${escapar(l.presentacion)})</small>${l.restriccion === 'Con Receta Medica' ? ' <span class="badge text-bg-warning">Receta</span>' : ''}</td>
            <td class="text-center text-nowrap">
                <button class="btn btn-sm btn-outline-secondary" type="button" data-menos="${l.id_presentacion}" aria-label="Quitar una unidad">−</button>
                <input class="form-control form-control-sm d-inline-block text-center" type="text"
                    inputmode="numeric" data-cantidad-venta="${l.id_presentacion}" value="${l.cantidad}"
                    aria-label="Cantidad de ${escapar(l.nombre)} (${escapar(l.presentacion)})">
                <button class="btn btn-sm btn-outline-secondary" type="button" data-mas="${l.id_presentacion}" aria-label="Agregar una unidad">+</button>
            </td>
            <td class="text-end">${lempiras(l.precioCentavos)}</td>
            <td class="text-end" data-subtotal-linea>${lempiras(l.precioCentavos * l.cantidad)}</td>
            <td><button class="btn btn-sm btn-outline-danger" type="button" data-quitar="${l.id_presentacion}" aria-label="Quitar de la venta">×</button></td>
        </tr>`).join('') || '<tr><td colspan="5" class="text-center text-secondary">Aún no hay medicamentos en la venta.</td></tr>';
}

function actualizarVenta() {
    const calc = calcular();
    $('resSubtotal').textContent = lempiras(calc.subtotal);
    // Los dos descuentos por edad siempre se muestran; solo se aplica (y resalta) el que corresponde a la edad.
    [['resDescTercera', C.EDAD_TERCERA ?? 60, C.DESCUENTO_TERCERA ?? 25, 'tercera edad'],
     ['resDescCuarta', C.EDAD_CUARTA ?? 80, C.DESCUENTO_CUARTA ?? 30, 'cuarta edad']].forEach(([id, desde, porcentaje, nombre]) => {
        const activo = calc.porcentajeDescuento === porcentaje;
        $(id + 'Etiqueta').textContent = `Descuento ${nombre} (${desde}+ años · ${porcentaje} %)`;
        $(id).textContent = activo && calc.descuento ? '− ' + lempiras(calc.descuento) : lempiras(0);
        $(id + 'Etiqueta').classList.toggle('descuento-activo', activo);
        $(id).classList.toggle('descuento-activo', activo);
    });
    $('resIsvEtiqueta').textContent = `ISV (${C.TASA_ISV} %)`;
    $('resIsv').textContent = lempiras(calc.isv);
    $('resTotal').textContent = lempiras(calc.total);

    actualizarDni();
    actualizarPago(calc);
    const error = errorVenta(calc);
    $('estadoVenta').textContent = error || '';
    $('guardarButton').disabled = guardandoVenta || Boolean(error);
}

function limpiarVenta() {
    carrito.clear();
    $('buscarMedicamento').value = '';
    $('dni').value = '';
    $('edad').value = '';
    $('recibido').value = '';
    $('metodoPago').value = 'Efectivo';
    edadManual = false;
    dniTocado = false;
    ocultarMensaje();
    pintarResultados();
    pintarCarrito();
    actualizarVenta();
}

// ---------- Registro de ventas ----------
$('alternarRegistroVentas')?.addEventListener('click', (e) => {
    const registro = $('registroVentas');
    registro.inert = !registro.inert;
    e.currentTarget.setAttribute('aria-expanded', String(!registro.inert));
    $('accionRegistroVentas').textContent = registro.inert ? 'Mostrar historial' : 'Ocultar historial';
});

async function cargarTabla() {
    const r = await window.farmacia.listarVentas();
    if (r.error) throw new Error(r.error);
    $('tablaVentas').innerHTML = r.datos.map((v) => `
        <tr>
            <td>${escapar(v.numero_factura || '—')}</td>
            <td>${escapar(v.dni_cliente || 'Sin DNI')}</td>
            <td>${new Date(v.fecha_venta).toLocaleString('es-HN')}</td>
            <td>L. ${Number(v.total).toFixed(2)}</td>
            <td>${escapar(v.metodo_pago)}</td>
        </tr>`).join('');
}

// ---------- Eventos ----------
$('buscarMedicamento').addEventListener('input', pintarResultados);
$('limpiarVentaButton').addEventListener('click', limpiarVenta);

// El botón + de la búsqueda y de la tabla de resumen funciona igual.
document.addEventListener('click', (e) => {
    const mas = e.target.closest('[data-mas]');
    const menos = e.target.closest('[data-menos]');
    const quitar = e.target.closest('[data-quitar]');
    if (mas) cambiarCantidad(Number(mas.dataset.mas), 1);
    else if (menos) cambiarCantidad(Number(menos.dataset.menos), -1);
    else if (quitar) {
        carrito.delete(Number(quitar.dataset.quitar));
        pintarCarrito();
        pintarResultados();
        actualizarVenta();
    }
});

$('carrito').addEventListener('input', (e) => {
    const campo = e.target.closest('[data-cantidad-venta]');
    if (!campo) return;
    const id = Number(campo.dataset.cantidadVenta);
    const valor = campo.value.trim();
    const error = fijarCantidad(id, /^\d+$/.test(valor) ? Number(valor) : NaN);
    campo.setCustomValidity(error);
    campo.setAttribute('aria-invalid', String(Boolean(error)));
    if (!error) {
        const linea = carrito.get(id);
        campo.closest('tr').querySelector('[data-subtotal-linea]').textContent =
            lempiras(linea.precioCentavos * linea.cantidad);
        ocultarMensaje();
    }
    pintarResultados();
    actualizarVenta();
});

// El DNI se escribe solo con números: el sistema coloca los guiones.
// El cursor se queda donde el cajero está editando (no salta al final).
let dniAnterior = '';
const posicionTrasDigitos = (texto, n) => {
    if (n <= 0) return 0;
    let vistos = 0;
    for (let i = 0; i < texto.length; i++) if (/\d/.test(texto[i]) && ++vistos === n) return i + 1;
    return texto.length;
};
$('dni').addEventListener('input', (e) => {
    const campo = $('dni');
    const cursor = campo.selectionStart ?? campo.value.length;
    let digitos = campo.value.replace(/\D/g, '');
    let antes = campo.value.slice(0, cursor).replace(/\D/g, '').length;
    let formateado = C.formatearDni(digitos);

    // Si se borró solo un guion, se borra el dígito vecino para que el borrado avance.
    if (formateado === dniAnterior && /^delete(Content|Word)(Backward|Forward)$/.test(e.inputType || '')) {
        const atras = /Backward$/.test(e.inputType);
        const i = atras ? antes - 1 : antes;
        if (i >= 0 && i < digitos.length) {
            digitos = digitos.slice(0, i) + digitos.slice(i + 1);
            antes = i;
            formateado = C.formatearDni(digitos);
        }
    }

    campo.value = formateado;
    dniAnterior = formateado;
    const pos = posicionTrasDigitos(formateado, Math.min(antes, 13));
    campo.setSelectionRange(pos, pos);

    if (!edadManual) {
        const edad = C.edadDesdeDni(formateado);
        $('edad').value = edad === null ? '' : edad;
    }
    actualizarVenta();
});
$('dni').addEventListener('blur', () => { dniTocado = true; actualizarVenta(); });
$('edad').addEventListener('input', () => { edadManual = $('edad').value !== ''; actualizarVenta(); });
$('metodoPago').addEventListener('change', actualizarVenta);

$('recibido').addEventListener('input', actualizarVenta);

const dialogoVenta = $('dialogoVenta');

$('guardarButton').addEventListener('click', () => {
    const calc = calcular();
    const error = errorVenta(calc);
    if (error) return mostrarMensaje(error);
    dialogoVenta.removeAttribute('data-estado');
    $('tituloDialogoVenta').textContent = 'Confirmar venta';
    $('descripcionDialogoVenta').textContent = 'Revisá el pedido y el pago antes de continuar.';
    $('vistaFacturaVenta').hidden = true;
    $('vistaFacturaVenta').removeAttribute('aria-busy');
    $('documentoVistaFactura').hidden = true;
    $('documentoVistaFactura').replaceChildren();
    $('estadoVistaFactura').textContent = '';
    $('verFacturaVenta').removeAttribute('data-venta');
    $('verFacturaVenta').textContent = 'Ver factura';
    $('verFacturaVenta').setAttribute('aria-expanded', 'false');
    $('confirmacionVenta').hidden = false;
    $('resultadoVenta').hidden = true;
    $('errorConfirmacionVenta').textContent = '';
    $('lineasConfirmacionVenta').innerHTML = lineas().map(l => `
        <tr>
            <td>${escapar(l.nombre)} <small>(${escapar(l.presentacion)})</small></td>
            <td class="text-end">${l.cantidad}</td>
            <td class="text-end">${lempiras(l.precioCentavos * l.cantidad)}</td>
        </tr>`).join('');
    const metodo = $('metodoPago').value;
    const recibido = recibidoCentavos();
    $('totalesConfirmacionVenta').innerHTML = `
        <dt>Subtotal</dt><dd>${lempiras(calc.subtotal)}</dd>
        <dt>Descuento</dt><dd>${lempiras(calc.descuento)}</dd>
        <dt>ISV</dt><dd>${lempiras(calc.isv)}</dd>
        <dt class="venta-dialogo-total">Total a pagar</dt><dd class="venta-dialogo-total">${lempiras(calc.total)}</dd>
        <dt>Método de pago</dt><dd>${escapar(metodo)}</dd>
        ${metodo === 'Efectivo' ? `<dt>Recibido</dt><dd>${lempiras(recibido)}</dd>
        <dt>Cambio</dt><dd>${lempiras(C.calcularCambio(calc.total, recibido).cambio)}</dd>` : ''}`;
    dialogoVenta.showModal();
});

$('corregirVenta').addEventListener('click', () => dialogoVenta.close());
$('noImprimirRecibo').addEventListener('click', () => dialogoVenta.close());
$('verFacturaVenta').addEventListener('click', async (e) => {
    const boton = e.currentTarget;
    const vista = $('vistaFacturaVenta');
    const documento = $('documentoVistaFactura');
    const estado = $('estadoVistaFactura');
    const id = boton.dataset.venta;
    if (!id) return;

    vista.hidden = !vista.hidden;
    boton.setAttribute('aria-expanded', String(!vista.hidden));
    boton.textContent = vista.hidden ? 'Ver factura' : 'Ocultar factura';
    if (vista.hidden || !documento.hidden || vista.hasAttribute('aria-busy')) return;

    vista.setAttribute('aria-busy', 'true');
    estado.textContent = 'Cargando factura…';
    try {
        const r = await window.farmacia.obtenerFactura(Number(id));
        if (boton.dataset.venta !== id) return;
        if (r.error) throw new Error(r.error);
        documento.innerHTML = window.renderizarFactura(r.datos, Number(id));
        documento.hidden = false;
        estado.textContent = '';
    } catch (error) {
        if (boton.dataset.venta === id) estado.textContent = error.message || 'No se pudo cargar la factura.';
    } finally {
        if (boton.dataset.venta === id) vista.removeAttribute('aria-busy');
    }
});

dialogoVenta.addEventListener('cancel', e => {
    if (guardandoVenta && !$('confirmacionVenta').hidden) e.preventDefault();
});

$('continuarVenta').addEventListener('click', async () => {
    if (guardandoVenta) return;
    const error = errorVenta(calcular());
    if (error) {
        mostrarMensaje(error);
        return;
    }

    guardandoVenta = true;
    $('continuarVenta').disabled = true;
    $('corregirVenta').disabled = true;
    $('errorConfirmacionVenta').textContent = '';
    try {
        const efectivo = $('metodoPago').value === 'Efectivo';
        const r = await window.farmacia.guardarVenta({
            dni: $('dni').value || null,
            edad: edadIngresada(),
            metodo_pago: $('metodoPago').value,
            monto_recibido: efectivo ? recibidoCentavos() / 100 : null,
            items: lineas().map((l) => ({ id_presentacion: l.id_presentacion, cantidad: l.cantidad })),
        });
        if (r.error) throw new Error(r.error);

        carrito.clear();
        pintarCarrito();
        $('dni').value = ''; $('edad').value = ''; $('recibido').value = '';
        edadManual = false; dniTocado = false; dniAnterior = '';
        ocultarMensaje();
        actualizarVenta();

        dialogoVenta.dataset.estado = 'exitosa';
        $('tituloDialogoVenta').textContent = 'Venta Exitosa';
        $('descripcionDialogoVenta').textContent = 'La venta se guardó correctamente.';
        $('facturaVentaExitosa').textContent = r.datos.numero_factura;
        $('totalVentaExitosa').textContent = lempiras(Math.round(Number(r.datos.total) * 100));
        $('cambioVentaExitosa').textContent = efectivo ? 'Cambio: ' + lempiras(Math.round(Number(r.datos.cambio) * 100)) : '';
        $('cambioVentaExitosa').hidden = !efectivo;
        $('verFacturaVenta').dataset.venta = r.datos.id_venta;
        $('imprimirRecibo').href = 'facturas.html?' + new URLSearchParams({ id: r.datos.id_venta, imprimir: '1' });
        $('confirmacionVenta').hidden = true;
        $('resultadoVenta').hidden = false;
        $('verFacturaVenta').focus();

        try {
            await iniciarCatalogo();
            await cargarTabla();
        } catch {
            mostrarMensaje('La venta quedó registrada. No se pudo actualizar la pantalla.', 'warning');
        }
    } catch (error) {
        mostrarMensaje(error.message || 'No se pudo guardar la venta.');
    } finally {
        guardandoVenta = false;
        $('continuarVenta').disabled = false;
        $('corregirVenta').disabled = false;
        actualizarVenta();
    }
});

async function iniciarCatalogo() {
    const r = await window.farmacia.cargarVentas();
    if (r.error) throw new Error(r.error);
    catalogo = r.datos;
    pintarResultados();
    actualizarVenta();
}

// ---------- Reportes de ventas ----------
let reporteActual = null;
let guardandoReportePdf = false;
let solicitudReporte = 0;
const fechaLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dinero = (n) => 'L. ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function aplicarPeriodo() {
    const hoy = new Date(), periodo = $('reportePeriodo').value;
    if (periodo === 'personalizado') return;
    const inicio = new Date(hoy);
    if (periodo === 'semana') inicio.setDate(hoy.getDate() - 6);
    if (periodo === 'mes') inicio.setDate(1);
    $('reporteDesde').value = fechaLocal(inicio);
    $('reporteHasta').value = fechaLocal(hoy);
}

function prepararReporte(mensaje) {
    solicitudReporte++;
    reporteActual = null;
    $('reporteResultados').hidden = true;
    $('reporteDescargar').disabled = true;
    $('reporteEstado').classList.remove('reporte-ventas-error');
    $('reporteEstado').textContent = mensaje;
}

async function consultarReporte() {
    const desde = $('reporteDesde').value;
    const hasta = $('reporteHasta').value;
    prepararReporte('Consultando ventas…');
    const solicitud = solicitudReporte;
    try {
        if (!desde || !hasta || desde > hasta) throw new Error('Seleccioná un rango de fechas válido.');
        const r = await window.farmacia.reporteVentas({ desde, hasta });
        if (solicitud !== solicitudReporte) return;
        if (r.error) throw new Error(r.error);

        const { resumen, ventas } = r.datos;
        $('reporteTotal').textContent = dinero(resumen.total);
        $('reporteCompletadas').textContent = resumen.cantidad + (resumen.anuladas ? ' · ' + resumen.anuladas + ' anuladas' : '');
        $('reporteIsv').textContent = dinero(resumen.impuesto);
        $('reporteDescuentos').textContent = dinero(resumen.descuento);
        const fecha = valor => valor.split('-').reverse().join('/');
        $('reporteRango').textContent = desde === hasta ? fecha(desde) : fecha(desde) + ' – ' + fecha(hasta);
        $('reporteMetodos').innerHTML = Object.entries(resumen.porMetodo).map(([nombre, total]) =>
            `<li><span>${escapar(nombre)}</span><strong>${dinero(total)}</strong></li>`
        ).join('') || '<li>Sin movimientos de pago</li>';
        $('reporteTabla').innerHTML = ventas.map(v => `
            <tr>
                <td class="reporte-venta-numero">${escapar(v.numero_factura)}</td>
                <td>${new Date(v.fecha_venta.replace(' ', 'T')).toLocaleString('es-HN')}</td>
                <td>${escapar(v.vendedor)}</td><td>${escapar(v.dni_cliente || 'Sin DNI')}</td>
                <td class="reporte-venta-importe">${dinero(v.subtotal)}</td><td class="reporte-venta-importe">${dinero(v.descuento)}</td>
                <td class="reporte-venta-importe">${dinero(v.impuesto)}</td><td class="reporte-venta-importe fw-bold">${dinero(v.total)}</td>
                <td>${escapar(v.metodo_pago)}</td>
                <td><span class="reporte-venta-insignia ${v.estado === 'Anulada' ? 'reporte-venta-anulada' : ''}">${escapar(v.estado)}</span></td>
            </tr>`).join('') || '<tr><td colspan="10" class="reporte-ventas-vacio">No hay ventas en este período.</td></tr>';
        reporteActual = { tipo: 'ventas', desde, hasta };
        const resultados = $('reporteResultados');
        resultados.dataset.desde = desde;
        resultados.dataset.hasta = hasta;
        $('reporteEstado').textContent = '';
        resultados.hidden = false;
        $('reporteDescargar').disabled = false;
    } catch (error) {
        if (solicitud !== solicitudReporte) return;
        $('reporteEstado').textContent = '';
        mostrarMensaje(error.message || 'No se pudo consultar el reporte.');
    }
}

async function descargarReporte() {
    if (!reporteActual || guardandoReportePdf) return;

    guardandoReportePdf = true;
    const controles = [...$('filtrosReporteVentas').elements, $('reporteDescargar'), $('cerrarReporteVentas')]
        .map(control => [control, control.disabled]);
    for (const [control] of controles) control.disabled = true;
    const estado = $('reporteEstado');
    estado.classList.remove('reporte-ventas-error');
    estado.textContent = 'Guardando PDF…';
    try {
        if (!window.farmacia.guardarReporteVentasPDF) throw new Error('Reiniciá la aplicación para activar Guardar PDF.');
        const r = await window.farmacia.guardarReporteVentasPDF(reporteActual);
        if (r.error) throw new Error(r.error);
        estado.textContent = '';
        mostrarMensaje(r.datos.cancelado ? 'Guardado cancelado.' : 'PDF guardado.', r.datos.cancelado ? 'info' : 'success');
    } catch (error) {
        estado.textContent = '';
        mostrarMensaje(/No handler registered/.test(error.message)
            ? 'Reiniciá la aplicación para activar Guardar PDF.'
            : error.message || 'No se pudo guardar el PDF.');
    } finally {
        guardandoReportePdf = false;
        for (const [control, deshabilitado] of controles) control.disabled = deshabilitado;
        $('reporteDescargar').focus();
    }
}

const formularioReporte = $('filtrosReporteVentas');
if (formularioReporte) {
    const modalReporte = $('modalReporte');
    $('verReportesButton').addEventListener('click', () => {
        $('reportePeriodo').value = 'hoy';
        aplicarPeriodo();
        modalReporte.showModal();
        $('reportePeriodo').focus();
        consultarReporte();
    });
    $('cerrarReporteVentas').addEventListener('click', () => modalReporte.close());
    modalReporte.addEventListener('cancel', e => {
        if (guardandoReportePdf) e.preventDefault();
    });
    $('reportePeriodo').addEventListener('change', () => {
        aplicarPeriodo();
        if ($('reportePeriodo').value === 'personalizado') {
            prepararReporte('Elegí las fechas y pulsá Consultar.');
        } else {
            consultarReporte();
        }
    });
    for (const id of ['reporteDesde', 'reporteHasta']) {
        $(id).addEventListener('input', () => {
            $('reportePeriodo').value = 'personalizado';
            prepararReporte('Pulsá Consultar para actualizar el reporte.');
        });
    }
    formularioReporte.addEventListener('submit', e => {
        e.preventDefault();
        consultarReporte();
    });
    $('reporteDescargar').addEventListener('click', descargarReporte);
}

$('logoutButton').addEventListener('click', async () => {
    try { await window.farmacia.cerrarSesion(); window.location.href = 'index.html'; }
    catch (error) { mostrarMensaje(error.message); }
});

(async function iniciar() {
    try {
        if (!window.farmacia) throw new Error('Abre la aplicación con npm start.');
        if (!C) throw new Error('No se cargó calculos-venta.js.');
        const s = await window.farmacia.obtenerSesion();
        if (s.error) throw new Error(s.error);
        if (!s.usuario || !['Administrador', 'Cajero'].includes(s.usuario.rol)) { window.location.href = 'index.html'; return; }
        const nombre = s.usuario.nombre + ' ' + s.usuario.apellido;
        $('sessionUser').textContent = nombre;
        $('vendedor').value = nombre;   // campo de solo lectura
        pintarCarrito();
        actualizarVenta();
        await iniciarCatalogo();
        await cargarTabla();
    } catch (error) { mostrarMensaje(error.message); }
})();
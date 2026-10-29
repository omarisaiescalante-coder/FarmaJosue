// Pantalla de ventas: búsqueda, resumen en tiempo real, descuentos, ISV, DNI y pago.
// Los cálculos vienen de calculos-venta.js (los mismos que usa el servidor).
const C = window.CalculosVenta;
let catalogo = { medicamentos: [], presentaciones: [] };
let carrito = new Map();     // id_presentacion -> línea de la venta
let edadManual = false;      // true si el cajero escribió la edad a mano
let dniTocado = false;       // true cuando el cajero salió del campo DNI
let temporizadorMensaje = null; // oculta solo los mensajes de éxito

const $ = (id) => document.getElementById(id);
const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lempiras = (centavos) => 'L. ' + (centavos / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function mostrarMensaje(texto, tipo = 'danger') {
    const caja = $('message');
    clearTimeout(temporizadorMensaje);
    caja.className = 'alert alert-' + tipo;
    caja.textContent = texto;
    // Los avisos de éxito desaparecen solos a los pocos segundos.
    if (tipo === 'success') temporizadorMensaje = setTimeout(ocultarMensaje, 4000);
}
const ocultarMensaje = () => { clearTimeout(temporizadorMensaje); $('message').className = 'alert d-none'; };

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
function pintarResultados() {
    const q = normalizar($('buscarMedicamento').value.trim());
    const lista = catalogo.medicamentos.filter((m) => normalizar(m.nombre).includes(q)).slice(0, 50);
    $('resultados').innerHTML = lista.map((m) => {
        const pres = catalogo.presentaciones.filter((p) => p.id_medicamento === m.id_medicamento);
        return `<div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
                <strong>${escapar(m.nombre)}${m.restriccion === 'Con Receta Medica' ? ' <span class="badge text-bg-warning">Receta</span>' : ''}</strong>
                <small class="text-secondary">Stock: ${pres.map(p => Math.floor(Number(p.cantidad_disponible ?? m.stock_total) / Number(p.unidades_stock)) + ' ' + escapar(etiqueta(p))).join(' / ')}</small>
            </div>
            ${pres.map((p) => `<div class="d-flex justify-content-between align-items-center mt-1">
                <span>${escapar(etiqueta(p))}${p.numero_lote ? ` (Lote ${escapar(p.numero_lote)})` : ''}: <strong>L. ${Number(p.precio_venta).toFixed(2)}</strong></span>
                <button class="btn btn-sm btn-success" type="button" data-mas="${p.id_presentacion}"
                    aria-label="Agregar ${escapar(etiqueta(p))} de ${escapar(m.nombre)}">+</button>
            </div>`).join('')}
        </div>`;
    }).join('') || '<div class="list-group-item text-secondary">No se encontraron medicamentos.</div>';
}

// Suma o resta una unidad de una presentación (cada clic en + incrementa la cantidad).
function cambiarCantidad(id, delta) {
    const pres = catalogo.presentaciones.find((p) => p.id_presentacion === id);
    const med = pres && catalogo.medicamentos.find((m) => m.id_medicamento === pres.id_medicamento);
    if (!pres || !med) return;
    const actual = carrito.get(id)?.cantidad || 0;
    const nueva = actual + delta;
    if (nueva <= 0) { carrito.delete(id); return actualizarVenta(); }
    const unidadesStock = Number(pres.unidades_stock);
    const otras = unidadesReservadas(med.id_medicamento) - actual * unidadesStock;
    if (otras + nueva * unidadesStock > Number(med.stock_total))
        return mostrarMensaje('No hay existencias suficientes de ' + med.nombre + '.');
    if (pres.id_lote) {
        const reservadas = lineas().filter(l => l.id_lote === pres.id_lote && l.id_presentacion !== id)
            .reduce((s, l) => s + l.cantidad * l.unidades_stock, 0);
        if (reservadas + nueva * unidadesStock > Number(pres.cantidad_disponible))
            return mostrarMensaje('No hay existencias suficientes del lote seleccionado.');
    }
    ocultarMensaje();
    carrito.set(id, {
        id_lote: pres.id_lote,
        id_presentacion: id, id_medicamento: med.id_medicamento, nombre: med.nombre, restriccion: med.restriccion,
        presentacion: etiqueta(pres), precioCentavos: Math.round(Number(pres.precio_venta) * 100),
        unidades_stock: unidadesStock, aplicaIsv: Number(med.aplica_isv) === 1, cantidad: nueva,
    });
    actualizarVenta();
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
function actualizarVenta() {
    const calc = calcular();
    $('carrito').innerHTML = lineas().map((l) => `
        <tr>
            <td>${escapar(l.nombre)} <small class="text-secondary">(${escapar(l.presentacion)})</small>${l.restriccion === 'Con Receta Medica' ? ' <span class="badge text-bg-warning">Receta</span>' : ''}</td>
            <td class="text-center text-nowrap">
                <button class="btn btn-sm btn-outline-secondary" type="button" data-menos="${l.id_presentacion}" aria-label="Quitar una unidad">−</button>
                <span class="mx-1">${l.cantidad}</span>
                <button class="btn btn-sm btn-outline-secondary" type="button" data-mas="${l.id_presentacion}" aria-label="Agregar una unidad">+</button>
            </td>
            <td class="text-end">${lempiras(l.precioCentavos)}</td>
            <td class="text-end">${lempiras(l.precioCentavos * l.cantidad)}</td>
            <td><button class="btn btn-sm btn-outline-danger" type="button" data-quitar="${l.id_presentacion}" aria-label="Quitar de la venta">×</button></td>
        </tr>`).join('') || '<tr><td colspan="5" class="text-center text-secondary">Aún no hay medicamentos en la venta.</td></tr>';

    $('resSubtotal').textContent = lempiras(calc.subtotal);
    const nombre = C.nombreDescuento(calc.porcentajeDescuento);
    $('resDescuentoEtiqueta').textContent = nombre ? `Descuento ${nombre} (${calc.porcentajeDescuento} %)` : 'Descuento';
    $('resDescuento').textContent = calc.descuento ? '− ' + lempiras(calc.descuento) : lempiras(0);
    $('resIsvEtiqueta').textContent = `ISV (${C.TASA_ISV} %)`;
    $('resIsv').textContent = lempiras(calc.isv);
    $('resTotal').textContent = lempiras(calc.total);

    actualizarDni();
    actualizarPago(calc);
    const error = errorVenta(calc);
    $('estadoVenta').textContent = error || '';
    $('guardarButton').disabled = Boolean(error);
}

// ---------- Registro de ventas ----------
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

// El botón + de la búsqueda y de la tabla de resumen funciona igual.
document.addEventListener('click', (e) => {
    const mas = e.target.closest('[data-mas]');
    const menos = e.target.closest('[data-menos]');
    const quitar = e.target.closest('[data-quitar]');
    if (mas) cambiarCantidad(Number(mas.dataset.mas), 1);
    else if (menos) cambiarCantidad(Number(menos.dataset.menos), -1);
    else if (quitar) { carrito.delete(Number(quitar.dataset.quitar)); actualizarVenta(); }
});

// El DNI se escribe solo con números: el sistema coloca los guiones.
$('dni').addEventListener('input', () => {
    $('dni').value = C.formatearDni($('dni').value);
    if (!edadManual) {
        const edad = C.edadDesdeDni($('dni').value);
        $('edad').value = edad === null ? '' : edad;
    }
    actualizarVenta();
});
$('dni').addEventListener('blur', () => { dniTocado = true; actualizarVenta(); });
$('edad').addEventListener('input', () => { edadManual = $('edad').value !== ''; actualizarVenta(); });
$('metodoPago').addEventListener('change', actualizarVenta);
$('recibido').addEventListener('input', actualizarVenta);

$('guardarButton').addEventListener('click', async () => {
    const error = errorVenta(calcular());
    if (error) return mostrarMensaje(error);
    if ($('guardarButton').disabled) return;
    $('guardarButton').disabled = true;
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
        mostrarMensaje('¡Venta registrada correctamente! Factura ' + r.datos.numero_factura + '.'
            + (efectivo ? ' Cambio: L. ' + Number(r.datos.cambio).toFixed(2) : ''), 'success');
        carrito.clear();
        $('dni').value = ''; $('edad').value = ''; $('recibido').value = '';
        edadManual = false; dniTocado = false;
        await cargarTabla();
        await iniciarCatalogo(); // refresca existencias
    } catch (error) { mostrarMensaje(error.message || 'No se pudo guardar la venta.'); }
    finally { actualizarVenta(); }
});

async function iniciarCatalogo() {
    const r = await window.farmacia.cargarVentas();
    if (r.error) throw new Error(r.error);
    catalogo = r.datos;
    pintarResultados();
    actualizarVenta();
}

// ---------- Reportes de ventas ----------
let reporteActual = null;   // último reporte consultado (se reutiliza al descargar)
const fechaLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dinero = (n) => 'L. ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function aplicarPeriodo() {
    const hoy = new Date(), periodo = $('reportePeriodo').value;
    if (periodo === 'personalizado') { $('reporteDesde').disabled = false; $('reporteHasta').disabled = false; return; }
    const inicio = new Date(hoy);
    if (periodo === 'semana') inicio.setDate(hoy.getDate() - 6);
    if (periodo === 'mes') inicio.setDate(1);
    $('reporteDesde').value = fechaLocal(inicio);
    $('reporteHasta').value = fechaLocal(hoy);
    $('reporteDesde').disabled = true; $('reporteHasta').disabled = true;
}

async function consultarReporte() {
    $('reporteEstado').textContent = '';
    try {
        const r = await window.farmacia.reporteVentas({ desde: $('reporteDesde').value, hasta: $('reporteHasta').value });
        if (r.error) throw new Error(r.error);
        reporteActual = { ...r.datos, desde: $('reporteDesde').value, hasta: $('reporteHasta').value };
        const m = r.datos.resumen;
        const metodos = Object.entries(m.porMetodo).map(([nombre, total]) => `${escapar(nombre)}: ${dinero(total)}`).join(' · ') || '—';
        $('reporteResumen').innerHTML = `
            <dt class="col-sm-3">Ventas completadas</dt><dd class="col-sm-3">${m.cantidad}${m.anuladas ? ` (${m.anuladas} anuladas)` : ''}</dd>
            <dt class="col-sm-3">Total vendido</dt><dd class="col-sm-3 fw-bold">${dinero(m.total)}</dd>
            <dt class="col-sm-3">Descuentos</dt><dd class="col-sm-3">${dinero(m.descuento)}</dd>
            <dt class="col-sm-3">ISV</dt><dd class="col-sm-3">${dinero(m.impuesto)}</dd>
            <dt class="col-sm-3">Por método de pago</dt><dd class="col-sm-9">${metodos}</dd>`;
        $('reporteTabla').innerHTML = r.datos.ventas.map((v) => `
            <tr class="${v.estado === 'Anulada' ? 'text-secondary' : ''}">
                <td>${escapar(v.numero_factura)}</td><td>${new Date(v.fecha_venta.replace(' ', 'T')).toLocaleString('es-HN')}</td>
                <td>${escapar(v.vendedor)}</td><td>${escapar(v.dni_cliente || 'Sin DNI')}</td>
                <td class="text-end">${dinero(v.subtotal)}</td><td class="text-end">${dinero(v.descuento)}</td>
                <td class="text-end">${dinero(v.impuesto)}</td><td class="text-end">${dinero(v.total)}</td>
                <td>${escapar(v.metodo_pago)}</td><td>${escapar(v.estado)}</td>
            </tr>`).join('') || '<tr><td colspan="10" class="text-center text-secondary">No hay ventas en este periodo.</td></tr>';
        return true;
    } catch (error) {
        reporteActual = null;
        $('reporteEstado').textContent = error.message || 'No se pudo consultar el reporte.';
        return false;
    }
}

// CSV con BOM para que Excel respete las tildes; se protege contra fórmulas (=, +, -, @).
function celdaCsv(valor) {
    let t = String(valor ?? '');
    if (/^[=+\-@]/.test(t)) t = "'" + t;
    return '"' + t.replace(/"/g, '""') + '"';
}
async function descargarReporte() {
    if (!(await consultarReporte())) return;
    const m = reporteActual.resumen;
    const filas = [
        ['Reporte de ventas - Farmacia Josué'], ['Desde', reporteActual.desde, 'Hasta', reporteActual.hasta], [],
        ['No. de factura', 'Fecha', 'Vendedor', 'DNI del cliente', 'Subtotal', 'Descuento', 'ISV', 'Total', 'Método de pago', 'Estado'],
        ...reporteActual.ventas.map((v) => [v.numero_factura, v.fecha_venta, v.vendedor, v.dni_cliente || 'Sin DNI',
            Number(v.subtotal).toFixed(2), Number(v.descuento).toFixed(2), Number(v.impuesto).toFixed(2), Number(v.total).toFixed(2), v.metodo_pago, v.estado]),
        [], ['Ventas completadas', m.cantidad, 'Anuladas', m.anuladas],
        ['Subtotal', m.subtotal.toFixed(2), 'Descuento', m.descuento.toFixed(2), 'ISV', m.impuesto.toFixed(2), 'Total', m.total.toFixed(2)],
    ];
    const blob = new Blob(['\ufeff' + filas.map((f) => f.map(celdaCsv).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `reporte-ventas_${reporteActual.desde}_a_${reporteActual.hasta}.csv`;
    document.body.append(enlace); enlace.click(); enlace.remove();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
    mostrarMensaje('Reporte de ventas generado correctamente.', 'success');
}

function abrirReporte(titulo) {
    $('tituloReporte').textContent = titulo;
    $('reportePeriodo').value = 'hoy';
    aplicarPeriodo();
    bootstrap.Modal.getOrCreateInstance($('modalReporte')).show();
    consultarReporte();
}
$('verReportesButton').addEventListener('click', () => abrirReporte('Reportes de ventas'));
$('generarReporteButton').addEventListener('click', () => abrirReporte('Generar reporte de ventas'));
$('reportePeriodo').addEventListener('change', () => { aplicarPeriodo(); consultarReporte(); });
$('reporteConsultar').addEventListener('click', consultarReporte);
$('reporteDescargar').addEventListener('click', descargarReporte);

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
        actualizarVenta();
        await iniciarCatalogo();
        await cargarTabla();
    } catch (error) { mostrarMensaje(error.message); }
})();

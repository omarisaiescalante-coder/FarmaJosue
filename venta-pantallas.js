// Pantalla de ventas: búsqueda, resumen en tiempo real, descuentos, ISV, DNI y pago.
// Los cálculos vienen de calculos-venta.js (los mismos que usa el servidor).
const C = window.CalculosVenta;
let catalogo = { medicamentos: [], presentaciones: [] };
let carrito = new Map();     // id_presentacion -> línea de la venta
let edadManual = false;      // true si el cajero escribió la edad a mano
let dniTocado = false;       // true cuando el cajero salió del campo DNI
let denomActiva = null;      // denominación elegida (0 = monto exacto) o null

const $ = (id) => document.getElementById(id);
const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lempiras = (centavos) => 'L. ' + (centavos / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function mostrarMensaje(texto, tipo = 'danger') {
    const caja = $('message');
    caja.className = 'alert alert-' + tipo;
    caja.textContent = texto;
}
const ocultarMensaje = () => { $('message').className = 'alert d-none'; };

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
                <small class="text-secondary">Stock: ${Number(m.stock_total)}</small>
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
    ocultarMensaje();
    carrito.set(id, {
        id_presentacion: id, id_medicamento: med.id_medicamento, nombre: med.nombre, restriccion: med.restriccion,
        presentacion: etiqueta(pres), precioCentavos: Math.round(Number(pres.precio_venta) * 100),
        unidades_stock: unidadesStock, aplicaIsv: Boolean(med.aplica_isv), cantidad: nueva,
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
    // Si se eligió un billete, el dinero recibido sigue al total cuando este cambia.
    if (denomActiva !== null && calc.total > 0) {
        const paso = denomActiva === 0 ? calc.total : denomActiva * 100;
        const centavos = Math.ceil(calc.total / paso) * paso;
        $('recibido').value = (centavos / 100).toFixed(2);
        $('resDenominacion').textContent = denomActiva === 0 ? 'Paga con el monto exacto.'
            : 'Paga con ' + (centavos / paso) + ' × L. ' + denomActiva + '.';
    } else if (denomActiva === null) $('resDenominacion').textContent = '';
    document.querySelectorAll('[data-denom]').forEach((b) => {
        const activo = denomActiva !== null && Number(b.dataset.denom) === denomActiva;
        b.classList.toggle('btn-success', activo);
        b.classList.toggle('btn-outline-success', !activo);
    });
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
            <td>${v.id_cliente ?? '—'}</td>
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
$('recibido').addEventListener('input', () => { denomActiva = null; actualizarVenta(); });
$('denominaciones').addEventListener('click', (e) => {
    const b = e.target.closest('[data-denom]');
    if (!b) return;
    if (!carrito.size) return mostrarMensaje('Agrega medicamentos antes de cobrar.');
    ocultarMensaje();
    denomActiva = Number(b.dataset.denom);
    actualizarVenta();
});

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
        mostrarMensaje('Venta registrada correctamente (' + r.datos.numero_factura + ').'
            + (efectivo ? ' Cambio: L. ' + Number(r.datos.cambio).toFixed(2) : ''), 'success');
        carrito.clear();
        $('dni').value = ''; $('edad').value = ''; $('recibido').value = '';
        edadManual = false; dniTocado = false; denomActiva = null;
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

$('backButton').addEventListener('click', () => { window.location.href = 'index.html'; });
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
// Pantalla de ventas: carrito, validación de receta y registro.
let catalogo = { medicamentos: [], presentaciones: [] };
let carrito = [];

const $ = (id) => document.getElementById(id);
const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function mostrarMensaje(texto, tipo = 'danger') {
    const caja = $('message');
    caja.className = 'alert alert-' + tipo;
    caja.textContent = texto;
}

function hayReceta() {
    return carrito.some((i) => i.restriccion === 'Con Receta Medica');
}

// Solo muestra el aviso de DNI obligatorio cuando el carrito lo requiere.
function actualizarAvisoDni() {
    $('dniAviso').hidden = !hayReceta();
    $('dni').classList.remove('is-invalid');
}

function pintarCarrito() {
    const total = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
    $('carrito').innerHTML = carrito.map((i, n) => `
        <tr>
            <td>${escapar(i.nombre)}</td>
            <td>${escapar(i.presentacion)}</td>
            <td>${i.restriccion === 'Con Receta Medica' ? 'Sí' : 'No'}</td>
            <td>${i.cantidad}</td>
            <td>L. ${i.precio.toFixed(2)}</td>
            <td>L. ${(i.precio * i.cantidad).toFixed(2)}</td>
            <td><button class="btn btn-sm btn-outline-danger" data-quitar="${n}" type="button">Quitar</button></td>
        </tr>`).join('');
    $('totalVenta').textContent = 'Total: L. ' + total.toFixed(2);
    actualizarAvisoDni();
}

function pintarPresentaciones() {
    const id = Number($('medicamento').value);
    $('presentacion').innerHTML = catalogo.presentaciones
        .filter((p) => p.id_medicamento === id)
        .map((p) => `<option value="${p.id_presentacion}">${escapar(p.nombre_presentacion)} — L. ${Number(p.precio_venta).toFixed(2)}</option>`)
        .join('');
}

async function cargarTabla() {
    const r = await window.farmacia.listarVentas();
    if (r.error) return mostrarMensaje(r.error);
    $('tablaVentas').innerHTML = r.datos.map((v) => `
        <tr>
            <td>${v.id_cliente}</td>
            <td>${escapar(v.dni_cliente)}</td>
            <td>${new Date(v.fecha_venta).toLocaleString('es-HN')}</td>
            <td>L. ${Number(v.total).toFixed(2)}</td>
            <td>${escapar(v.metodo_pago)}</td>
            <td><button class="btn btn-sm btn-success" data-factura="${v.id_venta}" type="button">Generar factura</button></td>
        </tr>`).join('');
}

$('medicamento').addEventListener('change', pintarPresentaciones);

$('agregarButton').addEventListener('click', () => {
    const med = catalogo.medicamentos.find((m) => m.id_medicamento === Number($('medicamento').value));
    const pres = catalogo.presentaciones.find((p) => p.id_presentacion === Number($('presentacion').value));
    const cantidad = Number($('cantidad').value);
    if (!med || !pres || !Number.isInteger(cantidad) || cantidad <= 0)
        return mostrarMensaje('Elegí un medicamento, una presentación y una cantidad válida.');
    $('message').className = 'alert d-none';
    carrito.push({
        id_presentacion: pres.id_presentacion, nombre: med.nombre, restriccion: med.restriccion,
        presentacion: pres.nombre_presentacion, precio: Number(pres.precio_venta), cantidad,
    });
    $('cantidad').value = 1;
    pintarCarrito();
});

$('carrito').addEventListener('click', (e) => {
    const n = e.target.dataset.quitar;
    if (n === undefined) return;
    carrito.splice(Number(n), 1);
    pintarCarrito();
});

$('tablaVentas').addEventListener('click', (e) => {
    const id = e.target.dataset.factura;
    if (id) window.location.href = 'facturas.html?id=' + id;
});

$('guardarButton').addEventListener('click', async () => {
    if (!carrito.length) return mostrarMensaje('Agregá al menos un medicamento.');
    const dni = $('dni').value.trim();

    // Si algún medicamento requiere receta, se exige el DNI antes de guardar.
    if (hayReceta() && !dni) {
        $('dni').classList.add('is-invalid');
        $('dni').focus();
        return mostrarMensaje('La venta incluye medicamentos con receta médica: ingresá el DNI del cliente.');
    }

    $('guardarButton').disabled = true;
    const r = await window.farmacia.guardarVenta({
        dni: dni || null,
        metodo_pago: $('metodoPago').value,
        items: carrito.map((i) => ({ id_presentacion: i.id_presentacion, cantidad: i.cantidad })),
    });
    $('guardarButton').disabled = false;
    if (r.error) return mostrarMensaje(r.error);

    mostrarMensaje('Venta registrada correctamente.', 'success');
    carrito = [];
    $('dni').value = '';
    pintarCarrito();
    await cargarTabla();
    await iniciarCatalogo(); // refresca existencias
});

async function iniciarCatalogo() {
    const r = await window.farmacia.cargarVentas();
    if (r.error) return mostrarMensaje(r.error);
    catalogo = r.datos;
    $('medicamento').innerHTML = catalogo.medicamentos
        .map((m) => `<option value="${m.id_medicamento}">${escapar(m.nombre)}</option>`).join('');
    pintarPresentaciones();
}

$('backButton').addEventListener('click', () => { window.location.href = 'index.html'; });
$('logoutButton').addEventListener('click', async () => {
    await window.farmacia.cerrarSesion();
    window.location.href = 'index.html';
});

(async function iniciar() {
    const s = await window.farmacia.obtenerSesion();
    if (!s.usuario) { window.location.href = 'index.html'; return; }
    $('sessionUser').textContent = s.usuario.nombre + ' ' + s.usuario.apellido;
    await iniciarCatalogo();
    await cargarTabla();
})();
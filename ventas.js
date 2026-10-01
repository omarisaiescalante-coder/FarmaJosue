
const dniInput = document.getElementById('dniCliente');
const metodoPago = document.getElementById('metodoPago');
const medicamentoSelect = document.getElementById('medicamento');
const presentacionSelect = document.getElementById('presentacion');
const cantidadInput = document.getElementById('cantidad');
const cartBody = document.getElementById('cartBody');
const salesBody = document.getElementById('salesBody');
const saleTotal = document.getElementById('saleTotal');
const message = document.getElementById('message');
const saleForm = document.getElementById('saleForm');
const addItemButton = document.getElementById('addItemButton');
const saveSaleButton = document.getElementById('saveSaleButton');
const clearSaleButton = document.getElementById('clearSaleButton');

let datos = {
    medicamentos: [],
    presentaciones: [],
    ventas: []
};

let carrito = [];

function escapar(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[caracter]);
}

function dinero(valor) {
    return 'L ' + Number(valor || 0).toLocaleString(
        'es-HN',
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );
}

function mostrarMensaje(texto, tipo = 'danger') {
    message.textContent = texto;
    message.className = `alert alert-${tipo}`;
}

function ocultarMensaje() {
    message.textContent = '';
    message.className = 'alert d-none';
}

function buscarMedicamento(id) {
    return datos.medicamentos.find(
        medicamento =>
            Number(medicamento.id_medicamento) === Number(id)
    );
}

function buscarPresentacion(id) {
    return datos.presentaciones.find(
        presentacion =>
            Number(presentacion.id_presentacion) === Number(id)
    );
}

function cargarOpcionesMedicamentos() {
    medicamentoSelect.innerHTML =
        '<option value="">Seleccione un medicamento</option>';

    datos.medicamentos
        .filter(m => m.estado === 'Disponible')
        .forEach(medicamento => {
            const option = document.createElement('option');

            option.value = medicamento.id_medicamento;
            option.textContent =
                `${medicamento.codigo} - ${medicamento.nombre}`;

            medicamentoSelect.appendChild(option);
        });

    cargarOpcionesPresentaciones();
}

function cargarOpcionesPresentaciones() {
    const idMedicamento = Number(medicamentoSelect.value);

    presentacionSelect.innerHTML =
        '<option value="">Seleccione...</option>';

    const presentaciones = datos.presentaciones.filter(
        p =>
            Number(p.id_medicamento) === idMedicamento &&
            Number(p.unidades_stock) > 0
    );

    presentaciones.forEach(presentacion => {
        const option = document.createElement('option');

        option.value = presentacion.id_presentacion;
        option.textContent =
            `${presentacion.nombre_presentacion} - ` +
            `${dinero(presentacion.precio_venta)}`;

        presentacionSelect.appendChild(option);
    });
}

function calcularUnidadesEnCarrito(idMedicamento) {
    return carrito.reduce((total, item) => {
        if (Number(item.id_medicamento) !== Number(idMedicamento)) {
            return total;
        }

        return total +
            item.cantidad * item.unidades_stock;
    }, 0);
}

function renderizarCarrito() {
    if (!carrito.length) {
        cartBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    No hay medicamentos agregados.
                </td>
            </tr>
        `;

        saleTotal.textContent = dinero(0);
        return;
    }

    cartBody.innerHTML = carrito.map((item, indice) => `
        <tr>
            <td>${escapar(item.nombre_medicamento)}</td>
            <td>${escapar(item.nombre_presentacion)}</td>
            <td>${item.cantidad}</td>
            <td>${dinero(item.precio_unitario)}</td>
            <td>${dinero(item.cantidad * item.precio_unitario)}</td>
            <td>
                <button
                    type="button"
                    class="btn btn-sm btn-danger"
                    data-remove="${indice}">
                    Quitar
                </button>
            </td>
        </tr>
    `).join('');

    const total = carrito.reduce(
        (suma, item) =>
            suma + item.cantidad * item.precio_unitario,
        0
    );

    saleTotal.textContent = dinero(total);
}

function agregarMedicamento() {
    ocultarMensaje();

    const medicamento = buscarMedicamento(
        medicamentoSelect.value
    );

    const presentacion = buscarPresentacion(
        presentacionSelect.value
    );

    const cantidad = Number(cantidadInput.value);

    if (!medicamento || !presentacion) {
        mostrarMensaje(
            'Selecciona un medicamento y su presentación.'
        );
        return;
    }

    if (
        !Number.isSafeInteger(cantidad) ||
        cantidad < 1
    ) {
        mostrarMensaje(
            'La cantidad debe ser un número entero positivo.'
        );
        return;
    }

    if (medicamento.estado !== 'Disponible') {
        mostrarMensaje('El medicamento no está disponible.');
        return;
    }

    const unidadesStock = Number(presentacion.unidades_stock);

    if (
        !Number.isSafeInteger(unidadesStock) ||
        unidadesStock < 1
    ) {
        mostrarMensaje('La presentación no es válida.');
        return;
    }

    if (
        Number(presentacion.id_medicamento) !==
        Number(medicamento.id_medicamento)
    ) {
        mostrarMensaje(
            'La presentación no corresponde al medicamento.'
        );
        return;
    }

    const unidadesEnCarrito = calcularUnidadesEnCarrito(
        medicamento.id_medicamento
    );

    if (
        unidadesEnCarrito + cantidad * unidadesStock >
        Number(medicamento.stock_total)
    ) {
        mostrarMensaje(
            'La cantidad supera las existencias disponibles.'
        );
        return;
    }

    carrito.push({
        id_medicamento: Number(medicamento.id_medicamento),
        id_presentacion: Number(presentacion.id_presentacion),
        nombre_medicamento: medicamento.nombre,
        nombre_presentacion: presentacion.nombre_presentacion,
        unidades_stock: unidadesStock,
        precio_unitario: Number(presentacion.precio_venta),
        cantidad
    });

    renderizarCarrito();

    // La receta también se comprueba nuevamente en el servicio.
    if (medicamento.restriccion === 'Con Receta Medica') {
        mostrarMensaje(
            'Este medicamento requiere receta médica. ' +
            'Se solicitará el DNI al guardar la venta.',
            'warning'
        );
    }

    cantidadInput.value = '1';
}

function renderizarVentas() {
    if (!datos.ventas.length) {
        salesBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    No hay ventas registradas.
                </td>
            </tr>
        `;
        return;
    }

    salesBody.innerHTML = datos.ventas.map(venta => `
        <tr>
            <td>${Number(venta.id_venta)}</td>

            <td>
                ${escapar(venta.dni_cliente || 'xxxxxxx')}
            </td>

            <td>
                ${venta.id_cliente == null
                    ? '—'
                    : Number(venta.id_cliente)}
            </td>

            <td>${escapar(venta.fecha_venta)}</td>

            <td>${dinero(venta.total)}</td>

            <td>
                <button
                    type="button"
                    class="btn btn-sm btn-success"
                    data-invoice="${Number(venta.id_venta)}">
                    Generar factura
                </button>
            </td>
        </tr>
    `).join('');
}

async function cargarDatos() {
    ocultarMensaje();

    const resultado = await window.farmacia.cargarVentas();

    if (resultado.error) {
        throw new Error(resultado.error);
    }

    datos = resultado.datos;

    cargarOpcionesMedicamentos();
    renderizarCarrito();
    renderizarVentas();
}

function limpiarFormulario() {
    carrito = [];

    dniInput.value = '';
    metodoPago.value = '';
    cantidadInput.value = '1';
    medicamentoSelect.value = '';

    cargarOpcionesPresentaciones();
    renderizarCarrito();
    ocultarMensaje();
}

async function guardarVenta(evento) {
    evento.preventDefault();
    ocultarMensaje();

    if (!carrito.length) {
        mostrarMensaje(
            'Agrega al menos un medicamento antes de guardar.'
        );
        return;
    }

    if (!metodoPago.value) {
        mostrarMensaje('Selecciona un método de pago.');
        return;
    }

    const contieneReceta = carrito.some(item => {
        const medicamento = buscarMedicamento(
            item.id_medicamento
        );

        return medicamento?.restriccion === 'Con Receta Medica';
    });

    if (contieneReceta && !dniInput.value.trim()) {
        mostrarMensaje(
            'Uno o más medicamentos requieren receta médica. ' +
            'Debes ingresar el DNI del cliente.'
        );

        dniInput.focus();
        return;
    }

    saveSaleButton.disabled = true;
    saveSaleButton.textContent = 'Guardando...';

    try {
        const resultado = await window.farmacia.guardarVenta({
            dni_cliente: dniInput.value.trim() || null,
            metodo_pago: metodoPago.value,
            items: carrito.map(item => ({
                id_presentacion: item.id_presentacion,
                cantidad: item.cantidad
            }))
        });

        if (resultado.error) {
            throw new Error(resultado.error);
        }

        const venta = resultado.datos;

        limpiarFormulario();

        await cargarDatos();

        mostrarMensaje(
            `Venta ${venta.numero_factura} registrada correctamente.`,
            'success'
        );

    } catch (error) {
        mostrarMensaje(
            error.message || 'No se pudo registrar la venta.'
        );
    } finally {
        saveSaleButton.disabled = false;
        saveSaleButton.textContent = 'Guardar venta';
    }
}

async function generarFactura(idVenta) {
    ocultarMensaje();

    try {
        const resultado =
            await window.farmacia.obtenerFacturaVenta(idVenta);

        if (resultado.error) {
            throw new Error(resultado.error);
        }

        const { venta, detalles } = resultado.datos;

        const invoice = document.getElementById('invoicePrint');

        invoice.innerHTML = `
            <div class="text-center mb-4">
                <h1>Farmacia Josue</h1>
                <h2>Factura de venta</h2>
                <p>${escapar(venta.numero_factura)}</p>
            </div>

            <p>
                <strong>Fecha:</strong>
                ${escapar(venta.fecha_venta)}
            </p>

            <p>
                <strong>Vendedor:</strong>
                ${escapar(
                    `${venta.nombre_usuario} ${venta.apellido_usuario}`
                )}
            </p>

            <p>
                <strong>DNI del cliente:</strong>
                ${escapar(venta.dni_cliente || 'xxxxxxx')}
            </p>

            <p>
                <strong>ID Cliente:</strong>
                ${venta.id_cliente == null
                    ? '—'
                    : Number(venta.id_cliente)}
            </p>

            <p>
                <strong>Método de pago:</strong>
                ${escapar(venta.metodo_pago)}
            </p>

            <table>
                <thead>
                    <tr>
                        <th>Medicamento</th>
                        <th>Presentación</th>
                        <th>Cantidad</th>
                        <th>Precio unitario</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>

                <tbody>
                    ${detalles.map(detalle => `
                        <tr>
                            <td>${escapar(detalle.medicamento)}</td>
                            <td>${escapar(detalle.presentacion)}</td>
                            <td>${Number(detalle.cantidad)}</td>
                            <td>${dinero(detalle.precio_unitario)}</td>
                            <td>${dinero(detalle.subtotal)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <h3 class="text-end mt-4">
                Total: ${dinero(venta.total)}
            </h3>

            <p class="text-center mt-5">
                Gracias por su compra.
            </p>
        `;

        invoice.hidden = false;
        document.body.classList.add('printing');

        window.onafterprint = () => {
            document.body.classList.remove('printing');
            invoice.hidden = true;
            window.onafterprint = null;
        };

        window.print();

    } catch (error) {
        mostrarMensaje(
            error.message || 'No se pudo generar la factura.'
        );
    }
}

addItemButton.addEventListener('click', agregarMedicamento);

medicamentoSelect.addEventListener(
    'change',
    cargarOpcionesPresentaciones
);

cartBody.addEventListener('click', evento => {
    const boton = evento.target.closest('[data-remove]');

    if (!boton) return;

    carrito.splice(Number(boton.dataset.remove), 1);

    renderizarCarrito();
    ocultarMensaje();
});

salesBody.addEventListener('click', evento => {
    const boton = evento.target.closest('[data-invoice]');

    if (!boton) return;

    generarFactura(Number(boton.dataset.invoice));
});

saleForm.addEventListener('submit', guardarVenta);

clearSaleButton.addEventListener('click', limpiarFormulario);

document.getElementById('backButton').addEventListener(
    'click',
    () => {
        window.location.href = 'index.html';
    }
);

document.getElementById('logoutButton').addEventListener(
    'click',
    async () => {
        await window.farmacia.cerrarSesion();
        window.location.href = 'index.html';
    }
);

async function iniciarModulo() {
    try {
        const sesion = await window.farmacia.obtenerSesion();

        if (sesion.error) {
            throw new Error(sesion.error);
        }

        if (!sesion.usuario) {
            window.location.href = 'index.html';
            return;
        }

        document.getElementById('sessionUser').textContent =
            `${sesion.usuario.nombre} ${sesion.usuario.apellido}`;

        await cargarDatos();

    } catch (error) {
        mostrarMensaje(
            error.message || 'No se pudo cargar el módulo de ventas.'
        );
    }
}

iniciarModulo();
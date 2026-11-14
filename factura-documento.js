(() => {
    const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const dinero = valor => 'L. ' + Number(valor ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fecha = valor => valor ? String(valor).slice(0, 10).split('-').reverse().join('/') : '—';
    const fila = (etiqueta, valor) => `<dt>${etiqueta}</dt><dd>${escapar(valor)}</dd>`;

    function renderizarArticulo(articulo) {
        return `
            <li class="factura-articulo">
                <div class="factura-articulo-cabecera">
                    <strong>${escapar(articulo.nombre)}</strong>
                    <strong>${dinero(articulo.subtotal)}</strong>
                </div>
                <p>${Number(articulo.cantidad)} × ${escapar(articulo.nombre_presentacion || 'Unidad')} · ${dinero(articulo.precio_unitario)} c/u</p>
            </li>`;
    }

    window.renderizarFactura = ({ venta, detalle }, id) => `
        <header class="factura-cabecera">
            <img src="assets/logo-farmajosue.png" alt="" width="48" height="48">
            <h1>Farmacia Josué</h1>
            <p class="factura-tipo">COMPROBANTE DE VENTA</p>
            <h2>${escapar(venta.numero_factura || ('Venta ' + id))}</h2>
            <p class="factura-no-fiscal">Comprobante interno · Sin validez fiscal</p>
        </header>
        <dl class="factura-datos">
            ${fila('Fecha', [fecha(venta.fecha_venta), String(venta.fecha_venta || '').slice(11, 19)].filter(Boolean).join(' '))}
            ${fila('Estado', venta.estado || '—')}
            ${venta.vendedor ? fila('Atendió', venta.vendedor) : ''}
            ${fila('DNI', venta.dni_cliente || 'Sin DNI registrado')}
            ${fila('Pago', venta.metodo_pago || '—')}
            ${Number(venta.requiere_receta) === 1 ? fila('Receta', 'Requerida') : ''}
        </dl>
        <section class="factura-seccion">
            <h3>Medicamentos</h3>
            <ul class="factura-articulos">${detalle.map(renderizarArticulo).join('')}</ul>
        </section>
        <section class="factura-seccion">
            <h3>Resumen del cobro</h3>
            <dl class="factura-datos factura-importes">
                ${fila('Subtotal', dinero(venta.subtotal))}
                ${fila('Descuento', dinero(venta.descuento))}
                ${fila('ISV cobrado', dinero(venta.impuesto))}
                <dt class="factura-total">Total</dt><dd class="factura-total">${dinero(venta.total)}</dd>
                ${venta.metodo_pago === 'Efectivo' && venta.monto_recibido != null
                    ? fila('Recibido', dinero(venta.monto_recibido)) + fila('Cambio', dinero(venta.cambio)) : ''}
            </dl>
        </section>
        <footer class="factura-pie">Gracias por su compra.</footer>`;
})();

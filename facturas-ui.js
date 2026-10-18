const $ = id => document.getElementById(id);
const setText = (id, valor) => { const elemento = $(id); if (elemento) elemento.textContent = valor; };
const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dinero = valor => 'L. ' + Number(valor || 0).toFixed(2);
let ventas = [];
function mensaje(texto) { setText('facturas-mensaje', texto); }
async function solicitar(promesa) { const r = await promesa; if (r.error) throw new Error(r.error); return r.datos; }
function pintar() {
    const buscar = $('buscar-factura').value.trim().toLowerCase();
    $('facturas-filas').innerHTML = ventas.filter(v => [String(v.id_venta), v.numero_factura, v.dni_cliente].some(x => String(x || '').toLowerCase().includes(buscar))).map(v => `<tr>
        <td>${Number(v.id_venta)}</td><td>${escapar(v.numero_factura)}</td><td>${escapar(v.dni_cliente || 'Sin DNI')}</td><td>${escapar(v.fecha_venta)}</td><td>${escapar(v.estado)}</td><td>${dinero(v.total)}</td>
        <td><button type="button" data-factura="${v.id_venta}">Ver factura</button></td></tr>`).join('') || '<tr><td colspan="7">No hay facturas para mostrar.</td></tr>';
}
async function cargar() { ventas = await solicitar(window.farmacia.listarVentas()); pintar(); }
async function mostrarFactura(id) {
    $('factura-detalle').hidden = true;
    const { venta, detalle } = await solicitar(window.farmacia.obtenerFactura(id));
    $('factura-documento').innerHTML = `
        <div class="factura-cabecera">
            <h1>Farmacia Josué</h1>
            <h2>Factura ${escapar(venta.numero_factura)}</h2>
            <p><strong>ID de venta:</strong> ${Number(venta.id_venta || id)}</p>
            <p>Fecha: ${escapar(venta.fecha_venta)} · Estado: ${escapar(venta.estado)}</p>
            <p>Método de pago: ${escapar(venta.metodo_pago)}</p>
            <p>DNI: ${escapar(venta.dni_cliente || 'Sin DNI registrado')}</p>
        </div>
        <table class="factura-tabla">
            <thead><tr><th>Medicamento</th><th>Presentación</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead>
            <tbody>${detalle.map(d => `<tr><td>${escapar(d.nombre)}</td><td>${escapar(d.nombre_presentacion)}</td><td>${Number(d.cantidad)}</td><td>${dinero(d.precio_unitario)}</td><td>${dinero(d.subtotal)}</td></tr>`).join('')}</tbody>
        </table>
        <div class="factura-resumen">
            <p>Subtotal: ${dinero(venta.subtotal)}</p>
            <p>Descuento: ${dinero(venta.descuento)}</p>
            <p>Impuesto: ${dinero(venta.impuesto || 0)}</p>
            <p>Total: ${dinero(venta.total)}</p>
            ${venta.metodo_pago === 'Efectivo' ? `<p>Recibido: ${dinero(venta.monto_recibido)}</p><p>Cambio: ${dinero(venta.cambio)}</p>` : ''}
        </div>`;
    $('factura-detalle').hidden = false;
}
$('buscar-factura').addEventListener('input', pintar);
$('facturas-filas').addEventListener('click', async e => {
    const boton = e.target.closest('[data-factura]');
    if (boton) { try { await mostrarFactura(Number(boton.dataset.factura)); mensaje(''); } catch (error) { mensaje(error.message); } }
});
$('imprimir').addEventListener('click', () => window.print());
$('salir').addEventListener('click', async () => { try { await window.farmacia.cerrarSesion(); window.location.href = 'index.html'; } catch (e) { mensaje(e.message); } });
(async () => {
    try {
        if (!window.farmacia) throw new Error('Abre la aplicación con npm start.');
        const s = await window.farmacia.obtenerSesion();
        if (s.error) throw new Error(s.error);
        if (!s.usuario || !['Administrador', 'Cajero'].includes(s.usuario.rol)) { window.location.replace('index.html'); return; }
        setText('sesion-nombre', s.usuario.nombre + ' ' + s.usuario.apellido);
        await cargar();
        $('pagina-facturas').hidden = false;
        mensaje('');
        const id = new URLSearchParams(window.location.search).get('id');
        if (id) await mostrarFactura(Number(id));
        window.addEventListener('focus', () => { cargar().catch(() => {}); });
        document.addEventListener('visibilitychange', () => { if (!document.hidden) { cargar().catch(() => {}); } });
        setInterval(() => { cargar().catch(() => {}); }, 5000);
    } catch (error) { mensaje(error.message); }
})();

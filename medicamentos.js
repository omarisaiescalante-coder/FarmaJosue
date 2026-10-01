const $ = id => document.getElementById(id);
$('volver-inicio').addEventListener('click', () => { window.location.href = 'index.html'; });
const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalogo = [];
function mensaje(texto) { $('medicamentos-mensaje').textContent = texto; }
async function solicitar(promesa) {
    const r = await promesa;
    if (r.error) throw new Error(r.error);
    return r.datos;
}
async function cargarMedicamentos() {
    catalogo = await solicitar(window.farmacia.listarMedicamentos());
    $('tablaMedicamentos').innerHTML = catalogo.map(m => `<tr>
        <td>${escapar(m.nombre)}</td><td>${escapar(m.categoria)}</td><td>${escapar(m.precios || 'Sin precios registrados')}</td><td>${Number(m.stock_total)}</td>
        <td><button type="button" data-editar="${m.id_medicamento}">Editar</button> <button type="button" data-lotes="${m.id_medicamento}">Lotes</button></td>
        </tr>`).join('') || '<tr><td colspan="5">No hay medicamentos registrados.</td></tr>';
}
$('tablaMedicamentos').addEventListener('click', async evento => {
    const boton = evento.target.closest('button');
    if (!boton) return;
    mensaje('');
    try {
        if (boton.dataset.editar) {
            const med = catalogo.find(m => m.id_medicamento === Number(boton.dataset.editar));
            $('id_medicamento').value = med.id_medicamento;
            $('nombre').value = med.nombre;
            $('categoria').value = med.categoria || '';
            $('restriccion').value = med.restriccion;
            $('editarMedicamento').hidden = false;
            $('nombre').focus();
        } else if (boton.dataset.lotes) {
            const filas = await solicitar(window.farmacia.verLotesMedicamento(Number(boton.dataset.lotes)));
            $('tablaLotes').innerHTML = filas.map(l => `<tr><td>${escapar(l.numero_lote)}</td><td>${escapar(l.fecha_vencimiento)}</td><td>${Number(l.cantidad_disponible)}</td><td>${l.precio_venta == null ? 'Sin precio por empaque' : 'L. ' + Number(l.precio_venta).toFixed(2)}</td></tr>`).join('') || '<tr><td colspan="4">No hay lotes registrados.</td></tr>';
            $('detalleLotes').hidden = false;
        }
    } catch (error) { mensaje(error.message); }
});
$('formEditar').addEventListener('submit', async evento => {
    evento.preventDefault();
    const boton = evento.currentTarget.querySelector('[type="submit"]');
    if (boton.disabled) return;
    boton.disabled = true;
    try {
        await solicitar(window.farmacia.actualizarMedicamento({ id: Number($('id_medicamento').value), nombre: $('nombre').value, categoria: $('categoria').value, restriccion: $('restriccion').value }));
        $('editarMedicamento').hidden = true;
        await cargarMedicamentos();
        mensaje('Medicamento actualizado.');
    } catch (error) { mensaje(error.message); }
    finally { boton.disabled = false; }
});
$('cancelar').addEventListener('click', () => { $('editarMedicamento').hidden = true; });
$('salir').addEventListener('click', async () => {
    try { await window.farmacia.cerrarSesion(); window.location.href = 'index.html'; }
    catch (error) { mensaje(error.message); }
});
(async () => {
    try {
        if (!window.farmacia) throw new Error('Abre la aplicación con npm start.');
        const s = await window.farmacia.obtenerSesion();
        if (s.error) throw new Error(s.error);
        if (!s.usuario) { window.location.replace('index.html'); return; }
        await cargarMedicamentos();
    } catch (error) { mensaje(error.message); }
})();

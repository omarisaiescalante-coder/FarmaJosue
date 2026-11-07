const $ = id => document.getElementById(id);
const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalogo = [];
function mensaje(texto) { $('medicamentos-mensaje').textContent = texto; }
async function solicitar(promesa) {
    const r = await promesa;
    if (r.error) throw new Error(r.error);
    return r.datos;
}

/* ---------- Utilidades de texto ---------- */
const dinero = n => 'L. ' + Number(n).toFixed(2);
const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

// Nombre de presentación para mostrar: "Blister" -> "blíster" / "blísteres"
function nombrePres(nombre, cantidad = 1) {
    let n = String(nombre || 'unidad').trim().toLowerCase();
    if (n.startsWith('blister')) n = 'blíster';
    if (cantidad === 1) return n;
    if (/[aeiou]$/.test(n)) return n + 's';
    return (n.endsWith('d') || n.endsWith('r') || n.endsWith('l') ? n + 'es' : n + 's');
}

/* ---------- Tiempo restante hasta el vencimiento ---------- */
function restante(fechaVenc) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const [y, m, d] = String(fechaVenc).split('-').map(Number);
    const fin = new Date(y, m - 1, d);
    if (fin < hoy) return { vencido: true, dias: -1 };
    let a = fin.getFullYear() - hoy.getFullYear();
    let me = fin.getMonth() - hoy.getMonth();
    let di = fin.getDate() - hoy.getDate();
    if (di < 0) { me--; di += new Date(fin.getFullYear(), fin.getMonth(), 0).getDate(); }
    if (me < 0) { a--; me += 12; }
    return { vencido: false, a, me, di, dias: Math.round((fin - hoy) / 864e5) };
}
function textoTiempo(r) {
    if (r.vencido) return 'Vencido';
    if (r.dias === 0) return 'Vence hoy';
    const partes = [
        r.a && plural(r.a, 'año', 'años'),
        r.me && plural(r.me, 'mes', 'meses'),
        r.di && plural(r.di, 'día', 'días'),
    ].filter(Boolean);
    return 'Vence en ' + partes.join(', ');
}

/* ---------- Precios y stock ---------- */
function htmlPrecios(pres) {
    const conPrecio = pres.filter(p => p.precio != null);
    if (!conPrecio.length) return '<span class="med-sin">Sin precios registrados</span>';
    return conPrecio.map(p => `<span class="med-precio">${p.desde ? 'Desde ' : ''}${dinero(p.precio)}<small>${escapar(nombrePres(p.nombre))}</small></span>`).join('');
}

function preciosResumen(presentaciones) {
    const porNombre = new Map();
    for (const { nombre, precio } of presentaciones) {
        if (precio == null) continue;
        const etiqueta = nombrePres(nombre);
        const precios = porNombre.get(etiqueta);
        if (precios) {
            precios.minimo = Math.min(precios.minimo, precio);
            precios.maximo = Math.max(precios.maximo, precio);
        } else {
            porNombre.set(etiqueta, { minimo: precio, maximo: precio });
        }
    }
    return [...porNombre].map(([nombre, precios]) => ({
        nombre, precio: precios.minimo, desde: precios.minimo !== precios.maximo,
    }));
}

function htmlLotes(m) {
    if (!m.lotes.length) return '<p class="med-sin">No hay lotes registrados.</p>';
    return m.lotes.map(l => {
        const presentaciones = m.presentaciones.filter(p => p.id_lote === l.id_lote ||
            (p.id_lote == null && !m.presentaciones.some(n => n.id_lote === l.id_lote)));
        const r = restante(l.fecha_vencimiento);
        const clase = r.vencido ? 'tiempo-vencido' : (r.dias <= 90 ? 'tiempo-pronto' : 'tiempo-ok');
        return `<div class="med-lote${r.vencido ? ' lote-vencido' : ''}">
            <div class="med-lote-fila"><strong>Lote ${escapar(l.numero_lote)}</strong><span class="tiempo ${clase}">${escapar(textoTiempo(r))}</span></div>
            <div class="med-stock">${escapar(window.textoStockEmpaque(l, l.cantidad))}</div>
            <div class="med-precios">${htmlPrecios(presentaciones)}</div>
        </div>`;
    }).join('');
}

/* ---------- Tarjetero ---------- */
async function cargarMedicamentos() {
    catalogo = await solicitar(window.farmacia.listarMedicamentos());
    $('tarjetero').innerHTML = catalogo.map(m => `<article class="med-card">
        <div class="med-head">
            <h3 class="med-nombre">${escapar(m.nombre)}</h3>
            <p class="med-cat">${escapar(m.categoria || 'Sin categoría')}</p>
        </div>
        <div class="med-resumen">
            <span class="med-existencias"><strong>${Number(m.stock_total || 0).toLocaleString('es-HN')}</strong> en inventario</span>
            <div class="med-precios" aria-label="Precios registrados">${htmlPrecios(preciosResumen(m.presentaciones))}</div>
        </div>
        <button type="button" class="med-editar" data-editar="${m.id_medicamento}">Editar</button>
        ${m.lotes.length ? `<details class="med-detalle">
            <summary>Ver lotes <span>${m.lotes.length}</span></summary>
            <div class="med-lista-lotes">${htmlLotes(m)}</div>
        </details>` : '<p class="med-sin">Sin lotes registrados</p>'}
    </article>`).join('') || '<p>No hay medicamentos registrados.</p>';
}

$('tarjetero').addEventListener('click', evento => {
    const boton = evento.target.closest('[data-editar]');
    if (!boton) return;
    const med = catalogo.find(m => m.id_medicamento === Number(boton.dataset.editar));
    if (!med) return;
    mensaje('');
    $('id_medicamento').value = med.id_medicamento;
    $('nombre').value = med.nombre;
    $('categoria').value = med.categoria || '';
    $('restriccion').value = med.restriccion;
    $('editarMedicamento').hidden = false;
    $('nombre').focus();
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

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

/* ---------- Precios ---------- */
function htmlPrecios(pres) {
    const conPrecio = pres.filter(p => p.precio != null);
    if (!conPrecio.length) return '<span class="med-sin">Sin precios registrados</span>';
    return conPrecio.map(p => `<span class="med-precio">${p.desde ? 'Desde ' : ''}${dinero(p.precio)}<small>${escapar(nombrePres(p.nombre))}</small></span>`).join('');
}

/* ---------- Forma de venta, lote próximo a vencer y semáforo ---------- */
// Números del semáforo (cámbialos si piden otros):
//   en cajas:    10 o más = verde, de 3 a 9 = amarillo, menos de 3 = rojo
//   en unidades: 50 o más = verde, de 20 a 49 = amarillo, menos de 20 = rojo
const SEMAFORO = {
    caja:   { verde: 10, amarillo: 3 },
    unidad: { verde: 50, amarillo: 20 }
};

function claveForma(nombre) {
    const n = String(nombre).toLowerCase();
    if (n.includes('caja')) return 'caja';
    if (n.includes('blister') || n.includes('blíster')) return 'blister';
    return 'unidad';
}

// Presentaciones registradas para el lote (si no tiene propias, las generales del medicamento).
function presLoteBase(m, l) {
    return m.presentaciones.filter(p => p.id_lote === l.id_lote ||
        (p.id_lote == null && !m.presentaciones.some(n => n.id_lote === l.id_lote)));
}

// Formas en que se vende el lote, según la forma de venta ingresada al principio.
function formasVenta(m, l) {
    const fuente = (String(l.modalidad || '') || presLoteBase(m, l).map(p => p.nombre).join(' ')).toLowerCase();
    const formas = new Set();
    if (fuente.includes('caja')) formas.add('caja');
    if (fuente.includes('blister') || fuente.includes('blíster')) formas.add('blister');
    if (fuente.includes('unidad') || fuente.includes('pastilla')) formas.add('unidad');
    return formas;
}

// Solo las presentaciones con las que se vende ese lote (si no tiene caja, no sale caja).
function presDeLote(m, l) {
    const formas = formasVenta(m, l);
    const base = presLoteBase(m, l);
    const filtradas = base.filter(p => formas.has(claveForma(p.nombre)));
    return filtradas.length ? filtradas : base;
}

// Stock del lote mostrado una sola vez, solo en las formas en que se vende.
function stockVenta(m, l) {
    const completo = String(window.textoStockEmpaque(l, l.cantidad));
    const formas = formasVenta(m, l);
    const partes = completo.split(' · ').filter(p => formas.has(claveForma(p.split('=')[0])));
    return partes.length ? partes.join(' · ') : completo;
}

// Stock para el semáforo: en cajas si se vende por caja, y en unidades si solo es unidad.
function stockNumero(m, l) {
    const tipo = formasVenta(m, l).has('caja') ? 'caja' : 'unidad';
    const parte = String(window.textoStockEmpaque(l, l.cantidad)).split(' · ')
        .find(p => claveForma(p.split('=')[0]) === tipo);
    const n = parte ? parseInt(String(parte.split('=')[1]).replace(/[^\d]/g, ''), 10) : NaN;
    return { tipo, valor: Number.isFinite(n) ? n : l.cantidad };
}

function puntoSemaforo(m, l) {
    const { tipo, valor } = stockNumero(m, l);
    const u = SEMAFORO[tipo];
    const color = valor >= u.verde ? 'verde' : valor >= u.amarillo ? 'amarillo' : 'rojo';
    const titulo = 'Quedan ' + (tipo === 'caja' ? plural(valor, 'caja', 'cajas') : plural(valor, 'unidad', 'unidades'));
    return `<span class="semaforo semaforo-${color}" title="${escapar(titulo)}" role="img" aria-label="${escapar(titulo)}"></span>`;
}

// Lote vigente (no vencido, con stock) que vence primero.
function loteProximo(m) {
    return m.lotes
        .filter(l => l.cantidad > 0 && !restante(l.fecha_vencimiento).vencido)
        .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0] || null;
}

function htmlLotes(m) {
    if (!m.lotes.length) return '<p class="med-sin">No hay lotes registrados.</p>';
    return m.lotes.map(l => {
        const r = restante(l.fecha_vencimiento);
        const clase = r.vencido ? 'tiempo-vencido' : (r.dias <= 90 ? 'tiempo-pronto' : 'tiempo-ok');
        return `<div class="med-lote${r.vencido ? ' lote-vencido' : ''}">
            <div class="med-lote-fila"><strong>Lote ${escapar(l.numero_lote)}</strong>${puntoSemaforo(m, l)}<span class="tiempo ${clase}">${escapar(textoTiempo(r))}</span></div>
            <div class="med-stock">${escapar(stockVenta(m, l))}</div>
            <div class="med-precios">${htmlPrecios(presDeLote(m, l))}</div>
        </div>`;
    }).join('');
}

/* ---------- Tarjetero ---------- */
async function cargarMedicamentos() {
    catalogo = await solicitar(window.farmacia.listarMedicamentos());
    $('tarjetero').innerHTML = catalogo.map(m => {
        const lp = loteProximo(m);
        const conReceta = m.restriccion === 'Con Receta Medica';
        return `<article class="med-card">
        <div class="med-head">
            <h3 class="med-nombre">${escapar(m.nombre)}</h3>
            <div class="med-sub">
                <p class="med-cat">${escapar(m.categoria || 'Sin categoría')}</p>
                <span class="med-receta ${conReceta ? 'receta-con' : 'receta-sin'}">${conReceta ? 'Con receta médica' : 'Sin receta médica'}</span>
            </div>
        </div>
        <div class="med-resumen">
            ${lp ? `<span class="med-existencias">Lote <strong>${escapar(lp.numero_lote)}</strong>${puntoSemaforo(m, lp)}</span>
            <div class="med-precios" aria-label="Precios del lote">${htmlPrecios(presDeLote(m, lp))}</div>`
                 : '<p class="med-sin">Sin lotes vigentes con stock</p>'}
        </div>
        <button type="button" class="med-editar" data-editar="${m.id_medicamento}">Editar</button>
        ${m.lotes.length ? `<details class="med-detalle">
            <summary>Ver lotes <span>${m.lotes.length}</span></summary>
            <div class="med-lista-lotes">${htmlLotes(m)}</div>
        </details>` : '<p class="med-sin">Sin lotes registrados</p>'}
    </article>`;
    }).join('') || '<p>No hay medicamentos registrados.</p>';
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

// Botón "Reportes": abre la pantalla del reporte de vencimientos.
$('abrir-reporte').addEventListener('click', () => { window.location.href = 'reporte-medicamentos.html'; });

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
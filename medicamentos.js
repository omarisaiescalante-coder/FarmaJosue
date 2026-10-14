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
    return [plural(r.a, 'año', 'años'), plural(r.me, 'mes', 'meses'), plural(r.di, 'día', 'días')].join(', ');
}

/* ---------- Precios y stock ---------- */
function htmlPrecios(pres) {
    const conPrecio = pres.filter(p => p.precio != null);
    if (!conPrecio.length) return '<span class="med-sin">Sin precios registrados</span>';
    if (pres.length === 1) return `<span class="med-precio">${dinero(conPrecio[0].precio)}<small>c/u</small></span>`;
    return conPrecio.map(p => `<span class="med-precio">${dinero(p.precio)}<small>${escapar(nombrePres(p.nombre))}</small></span>`).join('');
}

// Convierte la cantidad del lote en cajas / blísteres / unidades (solo si hay equivalencias registradas).
function textoStock(cantidad, pres) {
    const mayores = pres.filter(p => p.unidades > 1).sort((a, b) => b.unidades - a.unidades);
    const minima = pres.find(p => !(p.unidades > 1));
    const nombreMin = minima ? minima.nombre : 'unidad';
    if (!mayores.length) return plural(cantidad, nombrePres(nombreMin), nombrePres(nombreMin, 2));
    let resto = cantidad;
    const partes = mayores.map(p => {
        const n = Math.floor(resto / p.unidades);
        resto -= n * p.unidades;
        return plural(n, nombrePres(p.nombre), nombrePres(p.nombre, 2));
    });
    partes.push(plural(resto, nombrePres(nombreMin), nombrePres(nombreMin, 2)));
    return partes.join(' · ');
}

function htmlLotes(m) {
    if (!m.lotes.length) return '<p class="med-sin">No hay lotes registrados.</p>';
    return m.lotes.map(l => {
        const r = restante(l.fecha_vencimiento);
        const clase = r.vencido ? 'tiempo-vencido' : (r.dias <= 90 ? 'tiempo-pronto' : 'tiempo-ok');
        return `<div class="med-lote${r.vencido ? ' lote-vencido' : ''}">
            <div class="med-lote-fila"><strong>Lote ${escapar(l.numero_lote)}</strong><span class="tiempo ${clase}">${escapar(textoTiempo(r))}</span></div>
            <div class="med-stock">${escapar(textoStock(l.cantidad, m.presentaciones))}</div>
        </div>`;
    }).join('');
}

/* ---------- Tarjetero ---------- */
async function cargarMedicamentos() {
    catalogo = await solicitar(window.farmacia.listarMedicamentos());
    $('tarjetero').innerHTML = catalogo.map(m => `<article class="med-card" tabindex="0">
        <div class="med-head"><h3 class="med-nombre">${escapar(m.nombre)}</h3><p class="med-cat">${escapar(m.categoria || 'Sin categoría')}</p></div>
        <div class="med-detalle">
            <p class="med-sec">Precio</p><div class="med-precios">${htmlPrecios(m.presentaciones)}</div>
            <p class="med-sec">Lotes y stock</p>${htmlLotes(m)}
            <button type="button" class="med-editar" data-editar="${m.id_medicamento}">Editar</button>
        </div>
    </article>`).join('') || '<p>No hay medicamentos registrados.</p>';
}

$('tarjetero').addEventListener('click', evento => {
    const boton = evento.target.closest('[data-editar]');
    if (boton) {
        mensaje('');
        const med = catalogo.find(m => m.id_medicamento === Number(boton.dataset.editar));
        if (!med) return;
        $('id_medicamento').value = med.id_medicamento;
        $('nombre').value = med.nombre;
        $('categoria').value = med.categoria || '';
        $('restriccion').value = med.restriccion;
        $('editarMedicamento').hidden = false;
        $('nombre').focus();
        return;
    }
    // En pantallas táctiles (sin mouse) un toque abre o cierra la tarjeta
    const card = evento.target.closest('.med-card');
    if (card && window.matchMedia('(hover: none)').matches) card.classList.toggle('abierta');
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

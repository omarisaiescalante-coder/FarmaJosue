const $ = id => document.getElementById(id);
const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mensaje = texto => { $('rep-mensaje').textContent = texto; };
const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);
const iso = f => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

// Consulta los lotes y dibuja el reporte. Devuelve true si salió bien.
async function generar() {
    mensaje('');
    const boton = $('generar');
    boton.disabled = true;
    try {
        const r = await window.reportesMedicamentos.reporteVencimientos({ desde: $('desde').value, hasta: $('hasta').value });
        if (r.error) throw new Error(r.error);
        const { desde, hasta, filas } = r.datos;
        $('rep-desde').textContent = desde;
        $('rep-hasta').textContent = hasta;
        $('rep-cuerpo').innerHTML = filas.map(f => `<tr>
            <td>${escapar(f.codigo)}</td>
            <td>${escapar(f.medicamento)}</td>
            <td>${escapar(f.lote)}</td>
            <td>${Number(f.cantidad)}</td>
            <td>${escapar(f.vencimiento)}</td>
            <td><span class="sit ${f.situacion === 'Vencido' ? 'sit-vencido' : 'sit-porvencer'}">${escapar(f.situacion)}</span></td>
        </tr>`).join('') || '<tr><td colspan="6">No se encontraron lotes en este periodo.</td></tr>';
        const vencidos = filas.filter(f => f.situacion === 'Vencido').length;
        $('rep-resumen').textContent = filas.length
            ? `${plural(filas.length, 'lote', 'lotes')}: ${plural(vencidos, 'vencido', 'vencidos')} y ${filas.length - vencidos} por vencer.`
            : '';
        $('rep-periodo').hidden = false;
        $('rep-resultado').hidden = false;
        return true;
    } catch (error) {
        mensaje(error.message);
        return false;
    } finally { boton.disabled = false; }
}

// Genera el archivo PDF del reporte y deja elegir dónde guardarlo.
async function generarPdf() {
    const boton = $('pdf');
    boton.disabled = true;
    try {
        if (!(await generar())) return;
        const r = await window.reportesMedicamentos.reportePdf();
        if (r.error) throw new Error(r.error);
        if (!r.datos.cancelado) mensaje('PDF guardado en: ' + r.datos.ruta);
    } catch (error) { mensaje(error.message); }
    finally { boton.disabled = false; }
}

$('generar').addEventListener('click', generar);
$('pdf').addEventListener('click', generarPdf);
$('volver').addEventListener('click', () => { window.location.href = 'medicamentos.html'; });
$('salir').addEventListener('click', async () => {
    try { await window.farmacia.cerrarSesion(); window.location.href = 'index.html'; }
    catch (error) { mensaje(error.message); }
});

// Por defecto: del primer al último día del mes actual.
const hoy = new Date();
$('desde').value = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
$('hasta').value = iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));

(async () => {
    try {
        if (!window.farmacia || !window.reportesMedicamentos) throw new Error('Abre la aplicación con npm start.');
        const s = await window.farmacia.obtenerSesion();
        if (s.error) throw new Error(s.error);
        if (!s.usuario) { window.location.replace('index.html'); return; }
        await generar();
    } catch (error) { mensaje(error.message); }
})();
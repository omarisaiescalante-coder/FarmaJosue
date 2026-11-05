const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const { agruparReporte } = require('./compras-reporte');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    const ventana = new BrowserWindow({ show: false });
    try {
        const html = fs.readFileSync('compras.html', 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link\b[^>]*>/g, '');
        await ventana.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        await ventana.webContents.insertCSS(fs.readFileSync('compras-reporte.css', 'utf8'));
        const datos = agruparReporte([{ id_compra: 1, numero_factura: 'FAC#50', fecha_compra: '2026-11-04', proveedor: '<Proveedor>', id_lote: 1, numero_lote: 'LOT-555', medicamento: '<Medicamento>', cantidad_inicial: 10, precio_venta_unidad: 20, costo_total: '123.45', cantidad_empaques: 5, precio_empaque: '24.69' }], '2026-11-04', '2026-11-04');
        await ventana.webContents.executeJavaScript(`window.farmacia = { reporteCompras: async rango => { window.rango = rango; return { datos: ${JSON.stringify(datos)} }; } }; window.print = () => { window.impreso = true; }; void 0;`);
        await ventana.webContents.executeJavaScript(fs.readFileSync('compras-reporte-ui.js', 'utf8'));
        await ventana.webContents.executeJavaScript(`(async () => {
            const assert = (ok, texto) => { if (!ok) throw new Error(texto); };
            document.getElementById('abrirReporteCompras').click();
            const modal = document.querySelector('.reporte-compras-modal');
            assert(modal.open, 'Abre modal');
            const form = modal.querySelector('form');
            form.elements.desde.value = '2026-11-04'; form.elements.hasta.value = '2026-11-04';
            form.dispatchEvent(new Event('submit', {cancelable: true}));
            await new Promise(r => setTimeout(r, 20));
            assert(window.rango.desde === '2026-11-04', 'Envía rango');
            assert(modal.textContent.includes('FAC#50') && modal.textContent.includes('04/11/2026'), 'Encabezado de bloque');
            assert(modal.querySelector('thead').children[0].children.length === 5, 'Cinco columnas');
            assert(!modal.querySelector('thead').textContent.includes('Cantidad de stock'), 'No muestra columna de stock');
            assert(modal.querySelector('tbody').textContent.includes('LOT-555'), 'Código del lote');
            assert(modal.textContent.includes('<Medicamento>') && !modal.querySelector('medicamento'), 'Texto seguro');
            assert(modal.querySelector('.reporte-compras-total').textContent.includes('123.45'), 'Total general');
            const celdas = modal.querySelector('tbody tr').cells;
            assert(celdas[2].textContent.includes('24.69') && celdas[3].textContent === '5' && celdas[4].textContent.includes('123.45'), 'Precio por empaque, cantidad y total de compra');
            assert(document.getElementById('reporteComprasDocumento').lastElementChild.className === 'reporte-compras-total', 'Total en última fila');
            const imprimir = [...modal.querySelectorAll('button')].find(b => b.textContent.includes('Imprimir'));
            imprimir.click(); assert(window.impreso, 'Imprime reporte');
            const guardarPDF = [...modal.querySelectorAll('button')].find(b => b.textContent === 'Guardar PDF');
            window.farmacia.guardarReportePDF = async datos => { window.datosPDF = datos; return {datos:{cancelado:false,archivo:'reporte.pdf'}}; };
            guardarPDF.click(); await new Promise(r => setTimeout(r,20));
            assert(window.datosPDF.tipo === 'compras' && modal.textContent.includes('PDF guardado en: reporte.pdf'), 'Guarda con boton independiente');
            window.farmacia.guardarReportePDF = async () => ({datos:{cancelado:true}});
            guardarPDF.click(); await new Promise(r => setTimeout(r,20));
            assert(modal.textContent.includes('Guardado cancelado') && !guardarPDF.disabled, 'Cancelar permite volver a guardar');
            window.farmacia.guardarReportePDF = async () => ({error:'No se pudo guardar'});
            guardarPDF.click(); await new Promise(r => setTimeout(r,20));
            assert(modal.textContent.includes('No se pudo guardar') && !guardarPDF.disabled, 'Informa error de guardado');
            window.dispatchEvent(new Event('beforeprint')); assert(document.body.classList.contains('imprimiendo-reporte-compras'), 'Activa formato impresión');
            window.dispatchEvent(new Event('afterprint')); assert(!document.body.classList.contains('imprimiendo-reporte-compras'), 'Restaura pantalla');
            window.farmacia.reporteCompras = async () => ({error: 'Fallo simulado'});
            form.dispatchEvent(new Event('submit', {cancelable:true})); await new Promise(r => setTimeout(r, 20));
            assert(modal.textContent.includes('Fallo simulado') && imprimir.disabled, 'Error sin reporte anterior imprimible');
            window.farmacia.reporteCompras = async () => ({datos: {bloques: [{lotes: [{}]}]}});
            form.dispatchEvent(new Event('submit', {cancelable:true})); await new Promise(r => setTimeout(r, 20));
            assert(modal.textContent.includes('versión anterior') && imprimir.disabled, 'Detecta servicio anterior sin datos de empaques');
            window.farmacia.reporteCompras = async rango => ({datos: {...rango, bloques: [], totalCentavos: 0}});
            form.dispatchEvent(new Event('submit', {cancelable:true})); await new Promise(r => setTimeout(r, 20));
            assert(modal.textContent.includes('No hay compras'), 'Período vacío');
            [...modal.querySelectorAll('button')].find(b => b.textContent === 'Cerrar').click();
            assert(!modal.open && document.activeElement.id === 'abrirReporteCompras', 'Cierra y devuelve foco');
            document.getElementById('vistaInventarioLotes').hidden = false;
            window.farmacia.reporteLotes = async rango => ({datos: {...rango, lotes: [{numero_lote:'LOT-PRUEBA', numero_factura:'FAC#99', medicamento:'<Suero>', cajas: null, blisteres: null, unidades: 0, fecha_fabricacion: '2026-11-04', fecha_vencimiento: null}], medicamentos: [{puesto:1, nombre:'Suero', unidades_vendidas:20}, {puesto:null, nombre:'Sin ventas', unidades_vendidas:0}]}});
            document.getElementById('abrirReporteCompras').click();
            assert(form.elements.tipo.value === 'lotes', 'Abre reporte de lotes desde su inventario');
            form.dispatchEvent(new Event('submit', {cancelable:true})); await new Promise(r => setTimeout(r, 20));
            const documento = document.getElementById('reporteComprasDocumento');
            assert(documento.textContent.includes('Número de lote: LOT-PRUEBA') && documento.textContent.includes('Factura: FAC#99'), 'Encabezado por lote y factura');
            const filaLote = documento.querySelector('tbody tr').cells;
            assert(filaLote[4].textContent === '04/11/2026' && documento.querySelector('thead').textContent.includes('fabricaci\u00f3n'), 'Muestra fecha de fabricacion');
            assert(filaLote[1].textContent === '—' && filaLote[2].textContent === '—' && filaLote[3].textContent === '0', 'Rayas y stock agotado');
            assert(documento.textContent.includes('<Suero>') && !documento.querySelector('suero'), 'Nombre de medicamento seguro');
            assert(!documento.querySelector('.reporte-lotes-vendidos') && !documento.textContent.includes('Medicamentos más vendidos'), 'No muestra clasificación de ventas');
            assert(!modal.textContent.includes('clasificación por unidades vendidas') && !modal.textContent.includes('1 lotes creados'), 'No muestra resumen de lotes');
        })()`);
        for (const ancho of [1280, 720, 390]) {
            ventana.setContentSize(ancho, 900);
            await ventana.webContents.executeJavaScript(`document.getElementById('abrirReporteCompras').click(); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
            const valido = await ventana.webContents.executeJavaScript(`(() => { const d = document.querySelector('.reporte-compras-modal'); const r = d.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && d.scrollWidth <= d.clientWidth; })()`);
            if (!valido) throw new Error('Modal fuera de pantalla en ancho ' + ancho);
        }
        await ventana.webContents.executeJavaScript(`window.dispatchEvent(new Event('beforeprint')); void 0;`);
        const pdf = await ventana.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
        if (pdf.length < 1000 || pdf.subarray(0, 4).toString() !== '%PDF') throw new Error('No genera PDF válido');
        const carpeta = fs.mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'farma-pdf-'));
        const archivo = require('node:path').join(carpeta, 'reporte-lotes.pdf');
        try {
            await require('./reporte-pdf').guardarReportePDF({sender:ventana.webContents, ventana,
                directorioDocumentos:carpeta, dialog:{showSaveDialog:async()=>({canceled:false,filePath:archivo})},
                writeFile:require('node:fs/promises').writeFile}, {tipo:'lotes',desde:'2026-11-04',hasta:'2026-11-04'});
            if (fs.readFileSync(archivo).subarray(0,4).toString() !== '%PDF') throw new Error('No guarda archivo PDF valido');
        } finally { if(fs.existsSync(archivo)) fs.unlinkSync(archivo); fs.rmdirSync(carpeta); }
        await ventana.webContents.executeJavaScript(`window.dispatchEvent(new Event('afterprint')); void 0;`);
        console.log('Reporte de compras: modal, fechas, tablas, totales, impresión y móvil OK');
        ventana.destroy(); app.exit(0);
    } catch (error) { console.error(error); ventana.destroy(); app.exit(1); }
});

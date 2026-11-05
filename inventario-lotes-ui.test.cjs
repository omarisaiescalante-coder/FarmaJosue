// Verifica el modal con datos simulados, sin MySQL ni recursos de red.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    const ventana = new BrowserWindow({ show: false });
    try {
        await ventana.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<button id="abrir">Inventario</button>
            <h1 id="pageTitle"></h1><p id="pageDescription"></p>
            <button id="irInventarioCompras"></button><button id="verLotesRegistrados"></button>
            <section id="vistaRegistroCompras"><input id="borrador" value="Compra pendiente"></section>
            <section id="vistaInventarioCompras" hidden><h2 id="historialComprasTitulo" tabindex="-1"></h2></section>
            <section id="vistaInventarioLotes" hidden></section>`));
        await ventana.webContents.executeJavaScript(fs.readFileSync('inventario-compras.js', 'utf8'));
        await ventana.webContents.executeJavaScript(fs.readFileSync('stock-empaques.js', 'utf8'));
        await ventana.webContents.executeJavaScript(fs.readFileSync('inventario-lotes.js', 'utf8'));
        await ventana.webContents.executeJavaScript(`(async () => {
            const assert = (v, texto) => { if (!v) throw new Error(texto); };
            window.farmacia = { listarLotesCompra: async () => ({ datos: [{
                numero_lote: '<LOTE-1>', medicamento: 'Paracetamol', presentacion_ingreso: 'Caja',
                cantidad_empaques: 2, cantidad_disponible: 20, precio_empaque: 50, precio_venta: 75
            }] }) };
            document.getElementById('abrir').focus();
            await window.inventarioLotes.abrir([{ id_compra: 1, fecha_compra: '2026-10-19', nombre_distribuidor: 'Proveedor' }], 'Lotes', { isModalMode: true });
            const modal = document.querySelector('dialog');
            assert(modal.open, 'No abre modal');
            assert(modal.querySelector('.inventario-card-numero').textContent === 'Lote <LOTE-1>', 'No conserva texto seguro');
            assert(!modal.querySelector('table'), 'Muestra tablas en vez de tarjetas');
            assert(modal.querySelector('.inventario-lote-card').textContent.includes('Paracetamol'), 'No muestra medicamento');
            assert(modal.querySelector('.inventario-card-precios').textContent.includes('50.00'), 'No muestra precio del lote');
            await window.inventarioLotes.abrir([
                { id_compra: 1, fecha_compra: '2026-10-19' }, { id_compra: 2 }
            ], 'Compra seleccionada', { isModalMode: true, compraId: 1, expandir: true });
            assert(modal.querySelector('.inventario-lote-card').dataset.compraId === '1', 'No muestra compra contextual');
            assert(modal.querySelectorAll('[data-numero-lote]').length === 1, 'No filtra por compra');
            const consultas = [];
            window.farmacia.listarLotesCompra = async id => {
                consultas.push(id);
                return { datos: [{ numero_lote: 'SOLO-ESTE', medicamento: 'Paracetamol', tipo_medicamento: 'Pastilla', modalidad_venta: 'Caja',
                    cantidad_empaques: 3, cantidad_disponible: 2, paquetes_por_caja: 1, precio_empaque: 90, precio_venta: 120 }] };
            };
            await window.inventarioLotes.abrir([{id_compra: 1}, {id_compra: 2}], 'Compra seleccionada', {isModalMode:true, compraId:1});
            assert(consultas.join(',') === '1', 'Consulta otras compras del mismo medicamento');
            assert(modal.querySelectorAll('.inventario-lote-card').length === 1, 'Mezcla lotes');
            const texto = modal.querySelector('.inventario-lote-card').textContent;
            assert(texto.includes('SOLO-ESTE') && texto.includes('Caja = 2') && texto.includes('Unidad = 2'), 'Stock de caja incorrecto');
            modal.close();
            await new Promise(r => setTimeout(r, 30));
            assert(document.activeElement.id === 'abrir', 'No devuelve foco');
            let registro = { id_lote: 10, revision: 0, numero_lote: 'EDITABLE', medicamento: 'Original', tipo_medicamento: 'Pastilla', modalidad_venta: 'Caja y unidad',
                presentacion_ingreso: 'Caja', cantidad_empaques: 2, cantidad_inicial: 200, cantidad_disponible: 180,
                paquetes_por_caja: 10, unidades_por_blister: 10, precio_empaque: 100, precio_compra_contenido: 10, precio_compra_unidad: 1,
                precio_venta: 200, precio_venta_contenido: 20, precio_venta_unidad: 2 };
            window.farmacia.listarLotesCompra = async () => ({datos: [registro]});
            let fallar = true, recibido;
            window.farmacia.editarLoteCompra = async datos => {
                recibido = datos;
                if (fallar) return {error: 'Error simulado'};
                registro = {...registro, medicamento: datos.nombre, razon_edicion: datos.razon_edicion, revision: 2, fecha_edicion: '2026-10-28 15:30:00',
                    historial_ediciones: [
                        {id_edicion: 2, revision: 2, fecha_edicion: '2026-10-28 15:30:00', razon_edicion: datos.razon_edicion},
                        {id_edicion: 1, revision: 1, fecha_edicion: '2026-10-27 14:00:00', razon_edicion: 'Primera correccion'}]};
                return {datos: {id_lote: 10}};
            };
            await window.inventarioLotes.abrir([{id_compra: 1}], 'Inventario');
            const pagina = document.getElementById('vistaInventarioLotes');
            [...pagina.querySelectorAll('button')].find(b => b.textContent === 'Ver medicamentos').click();
            assert(pagina.querySelectorAll('.inventario-medicamentos .inventario-lote-card').length === 1, 'No muestra tarjeta dentro del lote');
            assert(!pagina.querySelector('.inventario-medicamentos table'), 'Sigue mostrando tabla de medicamentos');
            let editor = pagina.querySelector('.inventario-editor');
            assert(!editor.querySelector('[name="empaque"]'), 'Conserva el input de tipo de empaque');
            assert(editor.elements.razon_edicion.value === 'Sin edición' && editor.elements.nombre.readOnly, 'Estado inicial incorrecto');
            [...editor.querySelectorAll('button')].find(b => b.textContent === 'Editar').click();
            assert(!editor.elements.nombre.readOnly && !modal.open, 'Edicion no es en la tarjeta');
            assert(editor.elements.razon_edicion.required && !editor.elements.razon_edicion.value, 'No exige razon nueva');
            editor.elements.nombre.value = 'Corregido'; editor.elements.razon_edicion.value = 'Corregir nombre';
            const guardarLote = window.farmacia.editarLoteCompra;
            window.farmacia.editarLoteCompra = async () => { throw new Error("No handler registered for 'compras:editarLote'"); };
            editor.dispatchEvent(new Event('submit', {cancelable:true}));
            await new Promise(r => setTimeout(r, 30));
            assert(editor.textContent.includes('npm start') && !editor.elements.nombre.disabled, 'No explica como activar la edicion');
            window.farmacia.editarLoteCompra = guardarLote;
            editor.dispatchEvent(new Event('submit', {cancelable:true}));
            await new Promise(r => setTimeout(r, 30));
            assert(editor.textContent.includes('Error simulado') && !editor.elements.nombre.disabled, 'No recupera edicion fallida');
            fallar = false;
            editor.dispatchEvent(new Event('submit', {cancelable:true}));
            await new Promise(r => setTimeout(r, 30));
            editor = pagina.querySelector('.inventario-editor');
            assert(recibido.id_lote === 10 && recibido.revision === 0, 'Edita otro lote');
            assert(editor.elements.nombre.value === 'Corregido' && editor.elements.nombre.readOnly, 'No conserva nombre guardado');
            assert(editor.elements.razon_edicion.value === 'Corregir nombre' && editor.elements.fecha_edicion.selectedOptions[0].textContent.includes('15:30'), 'No muestra razon y fecha');
            assert(editor.elements.fecha_edicion.tagName === 'SELECT' && !editor.elements.fecha_edicion.disabled, 'No habilita selector de historial');
            editor.elements.fecha_edicion.value = '1'; editor.elements.fecha_edicion.dispatchEvent(new Event('change'));
            assert(editor.elements.razon_edicion.value === 'Primera correccion' && editor.elements.razon_edicion.readOnly, 'No cambia razon segun fecha');
            [...editor.querySelectorAll('button')].find(b => b.textContent === 'Editar').click();
            assert(editor.elements.fecha_edicion.disabled && !editor.elements.razon_edicion.value, 'Mezcla historial con una nueva edicion');
            editor.elements.nombre.value = 'Cancelar este cambio';
            [...editor.querySelectorAll('button')].find(b => b.textContent === 'Cancelar').click();
            assert(pagina.querySelector('[name="nombre"]').value === 'Corregido', 'Cancelar pierde datos guardados');
            await window.inventarioLotes.abrir([], 'Lotes', { isModalMode: true });
            assert(modal.textContent.includes('No hay lotes registrados'), 'Sin estado vacío');
            window.farmacia.listarLotesCompra = async () => ({ error: 'Sin conexión' });
            await window.inventarioLotes.abrir([{ id_compra: 1 }], 'Lotes', { isModalMode: true });
            assert(modal.textContent.includes('Sin conexión') && modal.textContent.includes('Reintentar'), 'Sin recuperación de error');
        })()`);
        console.log('Inventario: tarjetas por lote, filtro de compra, precios, stock, texto seguro, foco y errores verificados.');
        app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
});

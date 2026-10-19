// Verifica el modal con datos simulados, sin MySQL ni recursos de red.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    const ventana = new BrowserWindow({ show: false });
    try {
        await ventana.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<button id="abrir">Inventario</button>
            <h1 id="pageTitle"></h1><p id="pageDescription"></p>
            <button id="irInventarioCompras"></button><button id="regresarRegistroCompras"></button>
            <section id="vistaRegistroCompras"><input id="borrador" value="Compra pendiente"></section>
            <section id="vistaInventarioCompras" hidden><h2 id="historialComprasTitulo" tabindex="-1"></h2></section>
            <section id="vistaInventarioLotes" hidden></section>`));
        await ventana.webContents.executeJavaScript(fs.readFileSync('inventario-compras.js', 'utf8'));
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
            assert(modal.querySelector('tbody tr td').textContent === '<LOTE-1>', 'No conserva texto seguro');
            const boton = [...modal.querySelectorAll('button')].find(b => b.textContent === 'Ver medicamentos');
            boton.click();
            assert(boton.getAttribute('aria-expanded') === 'true', 'No expande');
            assert(modal.querySelector('.inventario-acordeon.abierto') && !modal.querySelector('.inventario-acordeon').inert, 'Detalle inaccesible');
            assert(modal.querySelector('.inventario-medicamentos').textContent.includes('Paracetamol'), 'No muestra medicamento');
            boton.click();
            assert(boton.getAttribute('aria-expanded') === 'false' && modal.querySelector('.inventario-acordeon').inert, 'No colapsa');
            await window.inventarioLotes.abrir([
                { id_compra: 1, fecha_compra: '2026-10-19' }, { id_compra: 2 }
            ], 'Compra seleccionada', { isModalMode: true, compraId: 1, expandir: true });
            assert(modal.querySelector('.inventario-lote-destacado').dataset.compraId === '1', 'No resalta compra contextual');
            assert(modal.querySelectorAll('[data-numero-lote]').length === 1, 'No filtra por compra');
            assert(modal.querySelector('.inventario-acordeon.abierto'), 'No despliega medicamentos contextuales');
            modal.close();
            await new Promise(r => setTimeout(r, 30));
            assert(document.activeElement.id === 'abrir', 'No devuelve foco');
            await window.inventarioLotes.abrir([], 'Lotes', { isModalMode: true });
            assert(modal.textContent.includes('No hay lotes registrados'), 'Sin estado vacío');
            window.farmacia.listarLotesCompra = async () => ({ error: 'Sin conexión' });
            await window.inventarioLotes.abrir([{ id_compra: 1 }], 'Lotes', { isModalMode: true });
            assert(modal.textContent.includes('Sin conexión') && modal.textContent.includes('Reintentar'), 'Sin recuperación de error');
        })()`);
        console.log('Inventario: apertura, texto seguro, acordeón, foco, vacío y error verificados.');
        app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
});

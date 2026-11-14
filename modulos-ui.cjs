// Ejecutar con Electron; verifica las pantallas reales con datos controlados, sin MySQL.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    const ventana = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
    const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'farma-ui-'));
    const errores = [];
    ventana.webContents.on('console-message', (_e, nivel, mensaje) => { if (nivel === 3) errores.push(mensaje); });
    async function cargar(html, script, simulacion) {
        const texto = fs.readFileSync(html, 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
        const pagina = path.join(temporal, path.basename(html));
        fs.writeFileSync(pagina, texto);
        await ventana.loadFile(pagina);
        await ventana.webContents.executeJavaScript(simulacion);
        for (const archivo of Array.isArray(script) ? script : [script])
            await ventana.webContents.executeJavaScript(fs.readFileSync(archivo, 'utf8'));
    }
    try {
        await cargar('ventas.html', ['calculos-venta.js', 'stock-empaques.js', 'factura-documento.js', 'venta-pantallas.js'], `
            window.guardados = 0;
            window.farmacia = {
                obtenerSesion: async () => ({usuario:{id_usuario:1, nombre:'Prueba', apellido:'UI', rol:'Cajero'}}),
                cargarVentas: async () => ({datos:{medicamentos:[{id_medicamento:1,nombre:'Prueba',restriccion:'Sin Receta',stock_total:5}],presentaciones:[{id_presentacion:1,id_medicamento:1,nombre_presentacion:'Unidad',unidades_stock:1,precio_venta:3,cantidad_disponible:5}]}}),
                listarVentas: async () => ({datos:[]}),
                guardarVenta: async () => { window.guardados++; throw new Error('Fallo de conexión simulado'); }
            }; void 0;`);
        await ventana.webContents.executeJavaScript(`(async () => {
            const assert = (v, texto) => { if (!v) throw new Error(texto); };
            await new Promise(r => setTimeout(r, 30));
            document.querySelector('[data-mas="1"]').click();
            assert(document.querySelector('[data-cantidad-venta]'), 'No agrega venta');
            document.getElementById('buscarMedicamento').value = 'Prueba';
            document.getElementById('buscarMedicamento').dispatchEvent(new Event('input'));
            document.getElementById('dni').value = '0801199012345';
            document.getElementById('dni').dispatchEvent(new Event('input'));
            document.getElementById('recibido').value = '3';
            document.getElementById('recibido').dispatchEvent(new Event('input'));
            document.getElementById('metodoPago').value = 'Tarjeta';
            document.getElementById('metodoPago').dispatchEvent(new Event('change'));
            document.getElementById('limpiarVentaButton').click();
            assert(!document.querySelector('[data-cantidad-venta]'), 'Limpiar conserva los medicamentos');
            assert(document.getElementById('buscarMedicamento').value === '', 'Limpiar conserva la búsqueda');
            assert(document.getElementById('dni').value === '' && document.getElementById('edad').value === '', 'Limpiar conserva los datos del cliente');
            assert(document.getElementById('recibido').value === '', 'Limpiar conserva el pago recibido');
            assert(document.getElementById('metodoPago').value === 'Efectivo', 'Limpiar no restablece el método de pago');
            assert(document.getElementById('resTotal').textContent === 'L. 0.00', 'Limpiar no restablece el total');
            document.querySelector('[data-mas="1"]').click();
            document.getElementById('recibido').value = '3';
            document.getElementById('recibido').dispatchEvent(new Event('input'));
            document.getElementById('guardarButton').click();
            document.getElementById('continuarVenta').click();
            await new Promise(r => setTimeout(r, 30));
            assert(window.guardados === 1, 'No intenta guardar la venta');
            assert(document.getElementById('errorConfirmacionVenta').textContent.includes('Fallo de conexión'), 'No muestra fallo de venta');
        })()`);
        console.log('Limpieza de venta verificada.');
        await cargar('facturas.html', ['factura-documento.js', 'facturas-ui.js'], `
            window.farmacia = {
                obtenerSesion: async () => ({usuario:{nombre:'Prueba',apellido:'UI',rol:'Cajero'}}),
                listarVentas: async () => ({datos:[{id_venta:1,numero_factura:'FAC-000001',fecha_venta:'2026-09-30',total:6,estado:'Completada'}]}),
                obtenerFactura: async () => ({datos:{venta:{numero_factura:'FAC-000001',fecha_venta:'2026-09-30',vendedor:'Prueba UI',metodo_pago:'Efectivo',total:6,subtotal:6,estado:'Completada'},detalle:[{nombre:'Prueba',nombre_presentacion:'Unidad',cantidad:2,precio_unitario:3,subtotal:6,lotes:[{numero_lote:'L-1',vence_lote:'2099-01-01',cantidad_unidades:2}]}]}})
            };
            window.print = () => { window.impreso = true; }; void 0;`);
        await ventana.webContents.executeJavaScript(`(async () => {
            const assert = (v, texto) => { if (!v) throw new Error(texto); };
            assert(!document.getElementById('pagina-facturas').hidden, 'Facturas permanece oculta');
            document.querySelector('[data-factura]').click();
            await new Promise(r => setTimeout(r, 30));
            assert(document.getElementById('factura-documento').textContent.includes('FAC-000001'), 'No carga factura');
            assert(document.getElementById('factura-documento').textContent.includes('Sin DNI registrado'), 'No admite venta histórica');
            assert(!document.getElementById('factura-documento').textContent.includes('Lote'), 'La factura muestra lotes');
            document.getElementById('imprimir').click();
            assert(window.impreso, 'No permite imprimir');
        })()`);
        console.log('Factura sin lotes verificada.');
        await cargar('medicamentos.html', ['stock-empaques.js', 'medicamentos.js'], `
            window.farmacia = {
                obtenerSesion: async () => ({usuario: {id_usuario: 1}}),
                listarMedicamentos: async () => ({datos: [{id_medicamento: 1, nombre: '<Medicamento>', categoria: 'Prueba', restriccion: 'Con Receta Medica', presentaciones: [{nombre:'Unidad',precio:3}], lotes: [{id_lote:1,numero_lote:'L-1',fecha_vencimiento:'2099-01-01',cantidad:10}], stock_total: 10}]}),
                actualizarMedicamento: async datos => { window.editado = datos; return {error: 'Error de prueba'}; },
            }; void 0;`);
        await ventana.webContents.executeJavaScript(`(async () => {
            const assert = (v, texto) => { if (!v) throw new Error(texto); };
            assert(document.getElementById('tarjetero').textContent.includes('L. 3.00'), 'No muestra precios');
            assert(!document.querySelector('medicamento'), 'No escapa HTML del nombre');
            document.querySelector('.med-detalle summary').click();
            assert(document.querySelector('.med-lista-lotes').textContent.includes('Lote L-1'), 'No muestra el lote');
        })()`);
        console.log('Interfaz de medicamentos verificada.');
        if (errores.length) throw new Error(errores.join('\n'));
        console.log('Pantallas verificadas: Medicamentos, Ventas y Facturas.');
        fs.rmSync(temporal, { recursive: true, force: true });
        app.exit(0);
    } catch (error) {
        console.error(error.stack || error);
        fs.rmSync(temporal, { recursive: true, force: true });
        app.exit(1);
    }
});

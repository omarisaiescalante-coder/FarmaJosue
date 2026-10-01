// Ejecutar con Electron; verifica las pantallas reales con datos controlados, sin MySQL.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    const ventana = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
    const errores = [];
    ventana.webContents.on('console-message', (_e, nivel, mensaje) => { if (nivel === 3) errores.push(mensaje); });
    async function cargar(html, script, simulacion) {
        const texto = fs.readFileSync(html, 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
        await ventana.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(texto));
        await ventana.webContents.executeJavaScript(simulacion);
        await ventana.webContents.executeJavaScript(fs.readFileSync(script, 'utf8'));
    }
    try {
        await cargar('medicamentos.html', 'medicamentos.js', `
            window.farmacia = {
                obtenerSesion: async () => ({usuario: {id_usuario: 1}}),
                listarMedicamentos: async () => ({datos: [{id_medicamento: 1, nombre: '<Medicamento>', categoria: 'Prueba', restriccion: 'Con Receta Medica', precios: 'Unidad: L. 3.00', stock_total: 10}]}),
                actualizarMedicamento: async datos => { window.editado = datos; return {error: 'Error de prueba'}; },
                verLotesMedicamento: async () => ({datos: [{numero_lote:'L-1', fecha_vencimiento:'2099-01-01', cantidad_disponible:10, precio_venta:null}]})
            }; void 0;`);
        await ventana.webContents.executeJavaScript(`(async () => {
            const assert = (v, texto) => { if (!v) throw new Error(texto); };
            assert(document.getElementById('tablaMedicamentos').textContent.includes('Unidad: L. 3.00'), 'No muestra precios');
            assert(!document.querySelector('medicamento'), 'No escapa HTML del nombre');
            document.querySelector('[data-editar]').click();
            assert(document.getElementById('nombre').value === '<Medicamento>', 'No precarga nombre');
            assert(document.getElementById('restriccion').value === 'Con Receta Medica', 'No precarga restricción');
            document.getElementById('formEditar').dispatchEvent(new Event('submit', {cancelable:true}));
            await new Promise(r => setTimeout(r, 30));
            assert(!document.getElementById('editarMedicamento').hidden, 'Oculta edición fallida');
            assert(document.getElementById('medicamentos-mensaje').textContent === 'Error de prueba', 'No informa error');
            document.querySelector('[data-lotes]').click();
            await new Promise(r => setTimeout(r, 30));
            assert(document.getElementById('tablaLotes').textContent.includes('Sin precio por empaque'), 'Precio nulo incorrecto');
        })()`);
        await cargar('ventas.html', 'venta-pantallas.js', `
            window.guardados = 0;
            window.farmacia = {
                obtenerSesion: async () => ({usuario:{id_usuario:1, nombre:'Prueba', apellido:'UI'}}),
                cargarVentas: async () => ({datos:{medicamentos:[{id_medicamento:1,nombre:'Prueba',restriccion:'Con Receta Medica',stock_total:5}],presentaciones:[{id_presentacion:1,id_medicamento:1,nombre_presentacion:'Unidad',unidades_stock:1,precio_venta:3}]}}),
                listarVentas: async () => ({datos:[]}),
                guardarVenta: async () => { window.guardados++; throw new Error('Fallo de conexión simulado'); }
            }; void 0;`);
        await ventana.webContents.executeJavaScript(`(async () => {
            const assert = (v, texto) => { if (!v) throw new Error(texto); };
            document.getElementById('cantidad').value = 6;
            document.getElementById('agregarButton').click();
            assert(!document.getElementById('carrito').children.length, 'Permite superar stock');
            document.getElementById('cantidad').value = 2;
            document.getElementById('agregarButton').click();
            assert(document.getElementById('carrito').children.length === 1, 'No agrega venta');
            document.getElementById('guardarButton').click();
            assert(window.guardados === 0, 'Permite receta sin DNI');
            document.getElementById('dni').value = '12345';
            document.getElementById('guardarButton').click();
            await new Promise(r => setTimeout(r, 30));
            assert(!document.getElementById('guardarButton').disabled, 'Botón bloqueado tras error');
            assert(document.getElementById('message').textContent.includes('Fallo de conexión'), 'No muestra fallo de venta');
        })()`);
        await cargar('facturas.html', 'facturas-ui.js', `
            window.farmacia = {
                obtenerSesion: async () => ({usuario:{nombre:'Prueba',apellido:'UI'}}),
                listarVentas: async () => ({datos:[{id_venta:1,numero_factura:'FAC-000001',fecha_venta:'2026-09-30',total:6,estado:'Completada'}]}),
                obtenerFactura: async () => ({datos:{venta:{numero_factura:'FAC-000001',fecha_venta:'2026-09-30',vendedor:'Prueba UI',metodo_pago:'Efectivo',total:6,subtotal:6,estado:'Completada'},detalle:[{nombre:'Prueba',nombre_presentacion:'Unidad',cantidad:2,precio_unitario:3,subtotal:6}]}})
            };
            window.print = () => { window.impreso = true; }; void 0;`);
        await ventana.webContents.executeJavaScript(`(async () => {
            const assert = (v, texto) => { if (!v) throw new Error(texto); };
            assert(!document.getElementById('pagina-facturas').hidden, 'Facturas permanece oculta');
            document.querySelector('[data-factura]').click();
            await new Promise(r => setTimeout(r, 30));
            assert(document.getElementById('factura-documento').textContent.includes('FAC-000001'), 'No carga factura');
            assert(document.getElementById('factura-documento').textContent.includes('Sin DNI registrado'), 'No admite venta histórica');
            document.getElementById('imprimir').click();
            assert(window.impreso, 'No permite imprimir');
        })()`);
        if (errores.length) throw new Error(errores.join('\n'));
        console.log('Pantallas verificadas: Medicamentos, Ventas y Facturas.');
        app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
});

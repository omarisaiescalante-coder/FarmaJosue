// Prueba de interfaz en una ventana invisible de Electron, sin conexión a MySQL.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    const ventana = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
    try {
        ventana.setContentSize(1280, 1000);
        const html = fs.readFileSync('compras.html', 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link\b[^>]*>/g, '');
        await ventana.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        await ventana.webContents.insertCSS(fs.readFileSync('styles.css', 'utf8'));
        await ventana.webContents.insertCSS(fs.readFileSync('compras-flujo.css', 'utf8'));
        const config = require('./compras');
        await ventana.webContents.executeJavaScript(`
            window.farmacia = {
                obtenerSesion: async () => ({ usuario: { id_usuario: 1, nombre: 'Prueba', apellido: 'Usuario', rol: 'Administrador' } }),
                cargarCompras: async () => ({ datos: { config: ${JSON.stringify(config)}, siguienteFactura: 'FAC#230', compras: [], proveedores: [
                    { id_distribuidor: 1, nombre: 'Laboratorio de prueba', telefono: '9999-9999', correo: 'a@example.com' },
                    { id_distribuidor: 2, nombre: 'Laboratorio actualizado', telefono: '8888-8888', correo: 'b@example.com' }
                ],
                    medicamentos: [{ id_medicamento: 1, codigo: 'MED-1', nombre: 'Existente', stock_total: 3, forma_venta: 'Frasco', precio_venta: 10 }] } }),
                registrarMedicamento: async datos => { window.ultimoMedicamento = datos; return { datos: { ...datos, id_medicamento: 2, codigo: 'MED-2', stock_total: 0 } }; },
                listarProveedores: async () => ({ datos: window.proveedoresPrueba || (await window.farmacia.cargarCompras()).datos.proveedores }),
                guardarProveedor: async datos => {
                    const p = { ...datos, id_distribuidor: Number(datos.id_distribuidor) || 3 };
                    const filas = (await window.farmacia.listarProveedores()).datos;
                    window.proveedoresPrueba = [...filas.filter(f => f.id_distribuidor !== p.id_distribuidor), p];
                    return { datos: p };
                },
                eliminarProveedor: async id => { window.proveedoresPrueba = (await window.farmacia.listarProveedores()).datos.filter(p => p.id_distribuidor !== id); return { datos: { id_distribuidor: id } }; },
                guardarCompra: async datos => { window.ultimaCompra = datos; return { error: 'Error simulado para revisar la recuperación del formulario' }; }
            }; void 0;`);
        await ventana.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, 'proveedores-ui.js'), 'utf8'));
        await ventana.webContents.executeJavaScript(fs.readFileSync('equivalencias-lote.js', 'utf8'));
        await ventana.webContents.executeJavaScript(fs.readFileSync('inventario-compras.js', 'utf8'));
        await ventana.webContents.executeJavaScript(fs.readFileSync('stock-empaques.js', 'utf8'));
        await ventana.webContents.executeJavaScript(fs.readFileSync('inventario-lotes.js', 'utf8'));
        await ventana.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, 'tabla.js'), 'utf8'));

        await ventana.webContents.executeJavaScript(`(async () => {
            await new Promise(r => setTimeout(r, 50));
            const assert = (ok, text) => { if (!ok) throw new Error(text); };
            form.elements.id_distribuidor.value = 'Laboratorio de prueba';
            form.elements.id_distribuidor.dispatchEvent(new Event('input'));
            const lote = document.querySelector('[data-lote]');
            const campo = n => lote.querySelector('[data-campo="' + n + '"]');
            campo('nombre_medicamento').value = 'Exis'; campo('nombre_medicamento').dispatchEvent(new Event('input'));
            assert(lote.querySelector('.medicamentos-sugerencias').textContent.includes('Existente'), 'Sugerencias');
            lote.querySelector('.medicamentos-sugerencias button').click();
            assert(!campo('tipo_medicamento').parentElement.hidden, 'Como entra visible en segunda fila');
            campo('tipo_medicamento').value = 'Pastilla'; campo('tipo_medicamento').dispatchEvent(new Event('change'));
            const agregar = [...lote.querySelectorAll('button')].find(b => b.textContent.includes('+ Otra'));
            agregar.click();
            lote.querySelectorAll('[data-forma-venta] select')[1].value = 'Blister';
            lote.querySelectorAll('[data-forma-venta] select')[1].dispatchEvent(new Event('change'));
            assert(!campo('tipo_medicamento').parentElement.hidden, 'Como entra visible con blister');
            const rect = elemento => elemento.getBoundingClientRect();
            const nombreRect = rect(campo('nombre_medicamento'));
            const botonRect = rect(lote.querySelector('.btn-warning'));
            assert(Math.abs(nombreRect.top - botonRect.top) < 2 && botonRect.left > nombreRect.right, 'Nombre y boton en la misma fila: ' + JSON.stringify({nombreRect,botonRect}));
            const numeroRect = rect(campo('numero_lote'));
            const cantidadRect = rect(campo('cantidad'));
            const precioRect = rect(campo('precio'));
            assert(Math.abs(nombreRect.top - numeroRect.top) < 2 && numeroRect.left > botonRect.right, 'Nombre, Nuevo y lote en la primera fila');
            const entradaRect = rect(campo('tipo_medicamento'));
            const formaRect = rect(lote.querySelector('[data-forma-venta] select'));
            const ventaRect = rect(lote.querySelector('[data-forma-venta] input'));
            assert(Math.abs(cantidadRect.top - precioRect.top) < 2 && Math.abs(cantidadRect.top - entradaRect.top) < 2 && cantidadRect.left < precioRect.left && precioRect.left < entradaRect.left, 'Paquetes, precio y como entra en segunda fila');
            const eqRect = rect(lote.querySelector('[data-equivalencia]'));
            for (const [arriba, abajo] of [[cantidadRect, formaRect], [precioRect, ventaRect], [entradaRect, eqRect]]) {
                assert(Math.abs(arriba.left - abajo.left) < 1 && Math.abs(arriba.right - abajo.right) < 1, 'Bordes de los inputs alineados entre filas');
            }
            assert(Math.abs(formaRect.top - ventaRect.top) < 2 && Math.abs(formaRect.top - eqRect.top) < 2 && formaRect.left < ventaRect.left && ventaRect.left < eqRect.left, 'Forma, precio y cantidad alineados');
            const fabricacion = rect(campo('fecha_fabricacion')), vencimiento = rect(campo('fecha_vencimiento'));
            assert(Math.abs(fabricacion.top - vencimiento.top) < 2 && fabricacion.width > 0, 'Fechas visibles en paralelo');
            assert(getComputedStyle(lote.querySelector('.btn-warning')).backgroundColor === 'rgb(255, 193, 7)', 'Boton amarillo');
            let filas = [...lote.querySelectorAll('[data-forma-venta]')];
            filas[1].querySelector('select').value = 'Unidad'; filas[1].querySelector('select').dispatchEvent(new Event('change'));
            assert(!campo('tipo_medicamento').parentElement.hidden, 'Como entra permanece visible');
            filas[1].querySelector('select').value = 'Blister'; filas[1].querySelector('select').dispatchEvent(new Event('change'));
            agregar.click();
            lote.querySelectorAll('[data-forma-venta] select')[2].value = 'Unidad';
            lote.querySelectorAll('[data-forma-venta] select')[2].dispatchEvent(new Event('change'));
            filas = [...lote.querySelectorAll('[data-forma-venta]')];
            filas.forEach((f,i) => { f.querySelector('[data-precio-venta]').value = [100,20,2][i]; f.querySelector('[data-equivalencia]').value = [5,5,10][i]; });
            campo('cantidad').value = 2; campo('precio').value = 50; campo('cantidad').dispatchEvent(new Event('input', {bubbles:true}));
            assert(campo('paquetes_por_caja').value === '5' && campo('unidades_por_blister').value === '10', 'Calcula equivalencias desde las filas');
            assert(lote.querySelector('[data-unidades-lote]').textContent.includes('Caja = 10') && lote.querySelector('[data-unidades-lote]').textContent.endsWith('500'), 'Multiplica paquetes por su contenido');
            campo('fecha_fabricacion').value = '2025-01-01'; campo('fecha_vencimiento').value = '2099-01-01';
            const datos = datosLote(lote);
            assert(datos.formas_venta.length === 3 && !('precio_compra_unidad' in datos), 'Payload limpio');
            lote.querySelector('[data-guardar-lote]').click();
            assert(lotesAgregados.length === 1, 'Guarda lote');
            assert(lote.querySelectorAll('[data-forma-venta]').length === 1, 'Limpia filas');
            document.querySelector('.compras-lote-compacto').click();
            assert(lote.querySelectorAll('[data-forma-venta]').length === 3, 'Restaura formas');
            lote.querySelectorAll('[data-forma-venta]')[1].querySelector('button').click();
            lote.querySelector('[data-guardar-lote]').click();
            assert(lotesAgregados[0].datos.formas_venta.length === 2, 'Elimina forma del borrador');
            campo('nombre_medicamento').value = 'Existente'; campo('nombre_medicamento').dispatchEvent(new Event('input'));
            campo('tipo_medicamento').value = 'Frasco'; campo('tipo_medicamento').dispatchEvent(new Event('change'));
            const soloUnidad = lote.querySelector('[data-forma-venta]');
            soloUnidad.querySelector('select').value = 'Unidad'; soloUnidad.querySelector('select').dispatchEvent(new Event('change'));
            campo('cantidad').value = 5;
            soloUnidad.querySelector('[data-equivalencia]').value = 100;
            soloUnidad.querySelector('[data-equivalencia]').dispatchEvent(new Event('input', {bubbles: true}));
            assert(lote.querySelector('[data-unidades-lote]').textContent === 'Stock = Unidad = 500', 'Solo muestra stock de las formas de venta seleccionadas');
            assert(soloUnidad.querySelector('[data-titulo-cantidad]').textContent === 'Cantidad de unidades', 'Etiqueta de cantidad por forma de venta');
            assert(soloUnidad.querySelector('[data-precio-venta]').parentElement.textContent.includes('Precio de venta por unidad'), 'Etiqueta de precio de venta');
            campo('nombre_medicamento').value = 'Nuevo'; campo('nombre_medicamento').dispatchEvent(new Event('input'));
            assert(!lote.querySelector('.lote-buscador p').hidden, 'Aviso medicamento inexistente');
            assert(!lote.querySelector('dialog').open, 'No abre modal automaticamente');
            const comprasBoton = document.getElementById('irInventarioCompras');
            const lotesBoton = document.getElementById('verLotesRegistrados');
            assert(document.querySelectorAll('.compras-accesos button').length === 2, 'Solo dos accesos');
            comprasBoton.click();
            assert(comprasBoton.textContent === 'Inicio de compras' && lotesBoton.textContent === 'Inventario de Lotes', 'Accesos desde inventario de compras');
            lotesBoton.click();
            await new Promise(r => setTimeout(r, 20));
            assert(lotesBoton.textContent === 'Inicio de compras' && comprasBoton.textContent === 'Inventario de Compras', 'Accesos desde inventario de lotes');
            lotesBoton.click();
            assert(!document.getElementById('vistaRegistroCompras').hidden && lotesBoton.textContent === 'Inventario de Lotes', 'Regresa a registro desde lotes');
            lotesBoton.click(); await new Promise(r => setTimeout(r, 20));
            comprasBoton.click();
            assert(!document.getElementById('vistaInventarioCompras').hidden && comprasBoton.textContent === 'Inicio de compras' && lotesBoton.textContent === 'Inventario de Lotes', 'Cambia directamente de lotes a compras');
            comprasBoton.click();
            assert(!document.getElementById('vistaRegistroCompras').hidden && campo('nombre_medicamento').value === 'Nuevo', 'Volver a inicio conserva borrador');
            lote.querySelector('.btn-warning').click();
            const registro = lote.querySelector('.registro-medicamento');
            const botonesRegistro = [...registro.querySelectorAll('.registro-medicamento-acciones button')];
            assert(botonesRegistro.every(b => b.getBoundingClientRect().height <= 33), 'Botones de medicamento compactos');
            assert(Math.abs(botonesRegistro[0].getBoundingClientRect().top - botonesRegistro[1].getBoundingClientRect().top) < 1, 'Acciones de medicamento en una fila');
            botonesRegistro[1].click();
        })()`);
        if (process.env.CAPTURA_LOTES) {
            ventana.setContentSize(1280, 1500);
            await ventana.webContents.executeJavaScript('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
            fs.writeFileSync(process.env.CAPTURA_LOTES, (await ventana.webContents.capturePage()).toPNG());
        }
        for (const ancho of [1000, 720, 390]) {
            ventana.setContentSize(ancho, 1000);
            await ventana.webContents.executeJavaScript('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
            const desborde = await ventana.webContents.executeJavaScript('document.documentElement.scrollWidth > innerWidth');
            if (desborde) throw new Error('Desborde en ancho ' + ancho);
        }
        console.log('Ingreso flexible y distribucion del cuaderno: OK');
    } catch (error) { console.error(error); process.exitCode = 1; }
    finally { ventana.destroy(); app.exit(process.exitCode || 0); }
});

// Prueba de interfaz en una ventana invisible de Electron, sin conexión a MySQL.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    const ventana = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
    try {
        await ventana.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><form id="recordForm"></form>
            <button id="saveButton"></button><button id="clearButton"></button><button id="backButton"></button>
            <button id="logoutButton"></button><span id="sessionUser"></span><div id="message"></div>
            <div id="tableContainer"></div><div id="lotesSection"></div><div id="lotesTitle"></div><div id="lotesContainer"></div>`));
        const config = require('./compras');
        await ventana.webContents.executeJavaScript(`
            window.farmacia = {
                obtenerSesion: async () => ({ usuario: { id_usuario: 1, nombre: 'Prueba', apellido: '' } }),
                cargarCompras: async () => ({ datos: { config: ${JSON.stringify(config)}, compras: [], proveedores: [],
                    medicamentos: [{ id_medicamento: 1, codigo: 'MED-1', nombre: 'Existente', stock_total: 3, forma_venta: 'Frasco', precio_venta: 10 }] } }),
                registrarMedicamento: async datos => { window.ultimoMedicamento = datos; return { datos: { ...datos, id_medicamento: 2, codigo: 'MED-2', stock_total: 0 } }; },
                guardarCompra: async datos => { window.ultimaCompra = datos; return { error: 'Error simulado para revisar la recuperación del formulario' }; }
            }; void 0;`);
        await ventana.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, 'tabla.js'), 'utf8'));
        const resultado = await ventana.webContents.executeJavaScript(`(async () => {
            const assert = (valor, texto) => { if (!valor) throw new Error(texto); };
            await new Promise(resolve => setTimeout(resolve, 20));
            form.elements.id_distribuidor.value = 'Laboratorio de prueba';
            form.elements.id_distribuidor.dispatchEvent(new Event('input'));
            agregarLote();
            const lote = document.querySelector('[data-lote]');
            const campo = nombre => lote.querySelector('[data-campo="' + nombre + '"]');
            const cambiar = (nombre, valor) => { campo(nombre).value = valor; campo(nombre).dispatchEvent(new Event('change')); };
            assert(!lote.disabled, 'Lote bloqueado');
            assert([...lote.querySelectorAll('input')].every(i => !i.readOnly), 'Hay campos de lote de solo lectura');
            assert([...campo('presentacion_ingreso').options].map(o => o.value).filter(Boolean).join(',') === 'Caja,Frasco,Ampolla,Suero', 'Empaques incorrectos');
            cambiar('nombre_medicamento', 'Existente');
            assert(campo('id_medicamento').value === '1', 'No encuentra medicamento existente');
            assert(campo('laboratorio').value === 'Laboratorio de prueba' && campo('laboratorio').type === 'hidden', 'Laboratorio del lote incorrecto');
            cambiar('presentacion_ingreso', 'Caja');
            assert(!campo('contenido_caja').disabled && campo('paquetes_por_caja').disabled, 'Caja sin contenido muestra cantidades');
            cambiar('contenido_caja', 'Blister');
            assert(!campo('unidades_por_blister').disabled && !campo('precio_venta_unidad').disabled, 'Campos de blíster bloqueados');
            cambiar('contenido_caja', 'Sobre');
            assert(campo('unidades_por_blister').disabled && campo('unidades_por_blister').parentElement.hidden, 'Pide pastillas para sobres');
            assert(!campo('paquetes_por_caja').disabled && !campo('precio_venta_contenido').disabled, 'Campos de sobres bloqueados');
            cambiar('presentacion_ingreso', 'Suero');
            assert(campo('contenido_caja').disabled && campo('precio_venta').required, 'Suero no pide precio unitario');
            cambiar('nombre_medicamento', 'Nuevo medicamento');
            const panel = lote.querySelector('fieldset');
            const modal = lote.querySelector('dialog');
            assert(modal.open && panel.disabled, 'No muestra confirmación flotante antes del registro');
            const aceptar = [...modal.querySelectorAll('button')].find(b => b.textContent === 'Continuar');
            assert(!aceptar.hidden, 'No ofrece registrar el medicamento');
            aceptar.click();
            assert(modal.open && !panel.hidden && !panel.disabled, 'No abre ventana de registro al confirmar');
            assert(panel.querySelector('[id$="-nuevo-nombre"]').value === 'Nuevo medicamento', 'No copia el nombre');
            assert(panel.querySelector('[data-laboratorio-medicamento]').type === 'hidden', 'Laboratorio visible en medicamento');
            form.elements.id_distribuidor.value = 'Laboratorio actualizado';
            form.elements.id_distribuidor.dispatchEvent(new Event('input'));
            panel.querySelector('select').value = 'Sin Receta Medica';
            panel.querySelector('button').click();
            await new Promise(resolve => setTimeout(resolve, 20));
            assert(window.ultimoMedicamento.laboratorio === 'Laboratorio actualizado', 'No hereda laboratorio del encabezado');
            assert(panel.hidden && campo('id_medicamento').value === '2', 'No selecciona medicamento recién registrado');
            cambiar('presentacion_ingreso', 'Caja'); cambiar('contenido_caja', 'Sobre');
            cambiar('numero_lote', 'LOTE-MANUAL'); cambiar('paquetes_por_caja', '10'); cambiar('cantidad', '2');
            cambiar('precio_venta_contenido', '8'); cambiar('fecha_fabricacion', '2025-01-01');
            cambiar('fecha_vencimiento', '2099-01-01'); cambiar('precio', '50');
            form.elements.telefono_distribuidor.value = '9999-9999'; form.elements.correo_distribuidor.value = 'a@example.com';
            actualizarTotales();
            assert(form.reportValidity(), 'Formulario no válido con campos completos');
            lote.querySelector('[data-guardar-lote]').click();
            assert(lote.querySelector('[data-detalle-lote]').hidden, 'No pliega el lote guardado');
            assert(lote.querySelector('legend button').textContent === 'Nuevo medicamento', 'No muestra nombre al plegar');
            lote.querySelector('legend button').click();
            assert(!lote.querySelector('[data-detalle-lote]').hidden && campo('cantidad').value === '2', 'No conserva datos al editar');
            lote.querySelector('[data-guardar-lote]').click();
            agregarLote();
            const segundo = document.querySelectorAll('[data-lote]')[1];
            const nombreSegundo = segundo.querySelector('[data-campo="nombre_medicamento"]');
            nombreSegundo.value = 'Otro nuevo'; nombreSegundo.dispatchEvent(new Event('input'));
            assert(!segundo.querySelector('dialog').open, 'Interrumpe mientras escribe el nombre');
            nombreSegundo.dispatchEvent(new Event('change'));
            assert(segundo.querySelector('dialog').open, 'No muestra aviso flotante en segundo lote');
            [...segundo.querySelectorAll('dialog button')].find(b => b.textContent === 'Cancelar' && !b.hidden).click();
            assert(!segundo.querySelector('dialog').open && nombreSegundo.value === 'Otro nuevo', 'Cancelar aviso pierde el nombre');
            nombreSegundo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            [...segundo.querySelectorAll('button')].find(b => b.textContent === 'Continuar').click();
            assert(segundo.querySelector('dialog').open, 'No abre registro en segundo lote');
            [...segundo.querySelectorAll('fieldset button')].find(b => b.textContent === 'Cancelar').click();
            assert(!segundo.querySelector('dialog').open, 'No cierra el registro cancelado');
            segundo.remove();
            form.dispatchEvent(new Event('submit', { cancelable: true }));
            await new Promise(resolve => setTimeout(resolve, 20));
            assert(window.ultimaCompra.lotes[0].numero_lote === 'LOTE-MANUAL' && !window.ultimaCompra.lotes[0].numero_automatico, 'No envía número manual');
            assert(!lote.disabled && !campo('cantidad').disabled && !campo('precio').disabled, 'Campos bloqueados tras error');
            assert(panel.disabled && campo('unidades_por_blister').disabled, 'Campos ocultos activados tras error');
            return 'Interfaz verificada: escritura, cuatro empaques, blísteres/sobres, alta automática, laboratorio y recuperación tras error.';
        })()`);
        console.log(resultado);
        app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
});

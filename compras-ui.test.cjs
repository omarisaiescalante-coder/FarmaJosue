// Prueba de interfaz en una ventana invisible de Electron, sin conexión a MySQL.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    const ventana = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
    try {
        await ventana.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><section id="comprasEncabezado" class="compras-encabezado"></section><form id="recordForm"></form>
            <section id="comprasResumen"></section><button id="saveButton"></button><button id="clearButton"></button><button id="backButton"></button>
            <button id="logoutButton"></button><span id="sessionUser"></span><div id="message"></div>
            <div id="tableContainer"></div><div id="lotesSection"></div><div id="lotesTitle"></div><div id="lotesContainer"></div>`));
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
        await ventana.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, 'tabla.js'), 'utf8'));
        const resultado = await ventana.webContents.executeJavaScript(`(async () => {
            const assert = (valor, texto) => { if (!valor) throw new Error(texto); };
            await new Promise(resolve => setTimeout(resolve, 20));
            assert(!form.elements.numero_factura && !form.elements.id_usuario, 'Factura y usuario siguen siendo inputs');
            assert(document.getElementById('id_usuario').textContent === 'Prueba Usuario', 'No muestra el nombre autenticado');
            assert(document.getElementById('numero_factura').textContent === 'FAC#230', 'Factura inicial incorrecta');
            const cargarOriginal = window.farmacia.cargarCompras;
            window.farmacia.cargarCompras = async () => {
                const respuesta = await cargarOriginal();
                delete respuesta.datos.siguienteFactura;
                respuesta.datos.compras = [{ id_compra: 229 }];
                return respuesta;
            };
            await cargar();
            assert(document.getElementById('numero_factura').textContent === 'FAC#230', 'Factura vacía con servicio anterior');
            window.farmacia.cargarCompras = cargarOriginal;
            await cargar();
            assert(!form.contains(document.querySelector('.compras-encabezado')), 'Encabezado dentro del formulario');
            assert(form.elements.id_distribuidor.tagName === 'SELECT' && form.elements.id_distribuidor.options.length === 3, 'No carga el selector de proveedores');
            assert(document.querySelector('.compras-encabezado').children.length === 4, 'Encabezado incompleto');
            assert(form.elements.telefono_distribuidor.type === 'hidden' && form.elements.correo_distribuidor.type === 'hidden', 'Contactos visibles');
            form.elements.id_distribuidor.value = 'Laboratorio de prueba';
            form.elements.id_distribuidor.dispatchEvent(new Event('input'));
            assert(form.elements.telefono_distribuidor.value === '9999-9999' && form.elements.correo_distribuidor.value === 'a@example.com', 'No conserva contactos del proveedor');
            agregarLote();
            const lote = document.querySelector('[data-lote]');
            const campo = nombre => lote.querySelector('[data-campo="' + nombre + '"]');
            const cambiar = (nombre, valor) => { campo(nombre).value = valor; campo(nombre).dispatchEvent(new Event('change')); };
            assert(!lote.disabled, 'Lote bloqueado');
            assert([...lote.querySelectorAll('input')].every(i => !i.readOnly), 'Hay campos de lote de solo lectura');
            assert([...campo('presentacion_ingreso').options].map(o => o.value).filter(Boolean).join(',') === 'Caja,Frasco,Ampolla,Suero,Sueros por caja', 'Empaques incorrectos');
            cambiar('nombre_medicamento', 'Existente');
            assert(campo('id_medicamento').value === '1', 'No encuentra medicamento existente');
            assert(campo('laboratorio').value === 'Laboratorio de prueba' && campo('laboratorio').type === 'hidden', 'Laboratorio del lote incorrecto');
            cambiar('presentacion_ingreso', 'Caja');
            assert(campo('contenido_caja').parentElement.hidden && campo('contenido_caja').value === 'Blister', 'No configura pastillas automáticamente');
            assert(!campo('unidades_por_blister').disabled && !campo('precio_venta_unidad').disabled, 'Campos de blíster bloqueados');
            cambiar('presentacion_ingreso', 'Sueros por caja');
            assert(campo('unidades_por_blister').disabled && campo('unidades_por_blister').parentElement.hidden, 'Pide pastillas para sobres');
            assert(!campo('paquetes_por_caja').disabled && !campo('precio_venta_contenido').disabled, 'Campos de sueros bloqueados');
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
            cambiar('presentacion_ingreso', 'Sueros por caja');
            cambiar('numero_lote', 'LOTE-MANUAL'); cambiar('paquetes_por_caja', '10'); cambiar('cantidad', '2');
            cambiar('precio_venta_contenido', '8'); cambiar('fecha_fabricacion', '2025-01-01');
            cambiar('fecha_vencimiento', '2099-01-01'); cambiar('precio', '50');
            const buscarProveedor = document.getElementById('buscarProveedor');
            buscarProveedor.value = 'Farinter Premium'; buscarProveedor.dispatchEvent(new Event('input'));
            assert(buscarProveedor.value === 'Farinter Premium', 'Pierde texto al buscar proveedor');
            assert(!form.reportValidity(), 'Permite comprar con proveedor sin registrar');
            const crearProveedor = [...document.querySelectorAll('#opcionesProveedores button')].find(b => b.textContent === '+ Crear nuevo proveedor');
            assert(crearProveedor, 'No ofrece creación rápida'); crearProveedor.click();
            await new Promise(resolve => setTimeout(resolve, 20));
            const proveedorModal = document.getElementById('proveedoresModal');
            const proveedorForm = document.getElementById('proveedorForm');
            assert(proveedorModal.open && proveedorForm.elements.nombre.value === 'Farinter Premium', 'No precarga nombre en modal');
            proveedorForm.elements.telefono.value = '7777-7777'; proveedorForm.elements.correo.value = 'premium@example.com';
            proveedorForm.dispatchEvent(new Event('submit', { cancelable: true }));
            await new Promise(resolve => setTimeout(resolve, 20));
            assert(proveedorModal.open && form.elements.id_distribuidor.value === 'Farinter Premium', 'No mantiene modal abierto y selecciona proveedor creado');
            assert(!proveedorForm.elements.nombre.value && !proveedorForm.elements.telefono.value && !proveedorForm.elements.correo.value && !proveedorForm.elements.id_distribuidor.value, 'No limpia formulario después de guardar');
            assert(!proveedorModal.querySelector('[data-nuevo]'), 'Sigue mostrando Nuevo proveedor');
            proveedorModal.querySelector('[data-cerrar]').click();
            assert(form.elements.telefono_distribuidor.value === '7777-7777', 'No actualiza contactos del proveedor nuevo');
            assert(campo('cantidad').value === '2' && campo('precio').value === '50', 'Crear proveedor pierde datos del lote');
            document.querySelector('.proveedores-acceso').click(); await new Promise(resolve => setTimeout(resolve, 20));
            const filaProveedor = [...proveedorModal.querySelectorAll('tbody tr')].find(f => f.firstChild.textContent === 'Farinter Premium');
            [...filaProveedor.querySelectorAll('button')].find(b => b.textContent === 'Editar').click();
            const cancelarEdicion = proveedorModal.querySelector('[data-cancelar-edicion]');
            assert(!cancelarEdicion.hidden, 'No muestra Cancelar edición');
            proveedorForm.elements.nombre.value = 'Cambio descartado';
            cancelarEdicion.click();
            assert(cancelarEdicion.hidden && !proveedorForm.elements.id_distribuidor.value && !proveedorForm.elements.nombre.value, 'No cancela y limpia la edición');
            assert(form.elements.id_distribuidor.value === 'Farinter Premium', 'Cancelar cambia el proveedor de la compra');
            [...filaProveedor.querySelectorAll('button')].find(b => b.textContent === 'Editar').click();
            proveedorForm.elements.nombre.value = 'Farinter Editado';
            proveedorForm.dispatchEvent(new Event('submit', { cancelable: true })); await new Promise(resolve => setTimeout(resolve, 20));
            assert(form.elements.id_distribuidor.value === 'Farinter Editado', 'No actualiza el proveedor editado en la compra');
            proveedorModal.querySelector('[data-cerrar]').click();
            document.querySelector('.proveedores-acceso').click(); await new Promise(resolve => setTimeout(resolve, 20));
            const confirmarAnterior = window.confirm; window.confirm = () => true;
            const filaEditada = [...proveedorModal.querySelectorAll('tbody tr')].find(f => f.firstChild.textContent === 'Farinter Editado');
            [...filaEditada.querySelectorAll('button')].find(b => b.textContent === 'Eliminar').click();
            await new Promise(resolve => setTimeout(resolve, 20)); window.confirm = confirmarAnterior;
            assert(![...form.elements.id_distribuidor.options].some(o => o.value === 'Farinter Editado'), 'Proveedor eliminado sigue en selector');
            proveedorModal.querySelector('[data-cerrar]').click();
            form.elements.id_distribuidor.value = 'Laboratorio actualizado'; form.elements.id_distribuidor.dispatchEvent(new Event('input'));
            actualizarTotales();
            assert(lote.querySelector('[data-unidades-lote]').textContent.endsWith('20'), 'No calcula unidades de sueros');
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

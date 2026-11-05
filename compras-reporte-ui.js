(() => {
    const acceso = document.getElementById('abrirReporteCompras');
    if (!acceso) return;
    const crear = (tag, texto, clase) => {
        const nodo = document.createElement(tag);
        if (texto !== undefined) nodo.textContent = texto;
        if (clase) nodo.className = clase;
        return nodo;
    };
    const modal = crear('dialog', undefined, 'reporte-compras-modal');
    modal.setAttribute('aria-labelledby', 'reporteComprasTitulo');
    const cabecera = crear('header', undefined, 'reporte-compras-controles reporte-compras-cabecera');
    const titulo = crear('h2', 'Reporte de Compras'); titulo.id = 'reporteComprasTitulo';
    const cerrar = crear('button', 'Cerrar', 'btn btn-outline-secondary'); cerrar.type = 'button';
    cerrar.onclick = () => { modal.close(); acceso.focus(); }; cabecera.append(titulo, cerrar);
    const filtros = crear('form', undefined, 'reporte-compras-controles reporte-compras-filtros');
    const etiquetaTipo = crear('label', 'Tipo de reporte:');
    const tipo = crear('select', undefined, 'form-select'); tipo.name = 'tipo';
    tipo.add(new Option('Compras', 'compras')); tipo.add(new Option('Lotes', 'lotes'));
    etiquetaTipo.append(tipo); filtros.append(etiquetaTipo);
    const campos = {};
    const hoy = new Date();
    const fechaLocal = dia => `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
    for (const [nombre, etiqueta, valor] of [['desde', 'Desde:', fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1))], ['hasta', 'Hasta:', fechaLocal(hoy)]]) {
        const label = crear('label', etiqueta);
        const input = crear('input', undefined, 'form-control'); input.type = 'date'; input.required = true; input.name = nombre; input.value = valor;
        campos[nombre] = input; label.append(input); filtros.append(label);
    }
    const generar = crear('button', 'Generar Reporte', 'btn btn-success'); generar.type = 'submit';
    const imprimir = crear('button', 'Imprimir', 'btn btn-outline-success'); imprimir.type = 'button'; imprimir.disabled = true;
    const guardarPDF = crear('button', 'Guardar PDF', 'btn btn-success'); guardarPDF.type = 'button'; guardarPDF.disabled = true;
    filtros.append(generar, imprimir, guardarPDF);
    const estado = crear('p', '', 'reporte-compras-controles'); estado.setAttribute('role', 'status');
    const resultado = crear('section'); resultado.id = 'reporteComprasDocumento'; resultado.setAttribute('aria-label', 'Reporte de compras generado');
    modal.append(cabecera, filtros, estado, resultado); document.body.append(modal);
    let version = 0;
    let reporteGenerado = null;
    let exportando = false;
    modal.addEventListener('cancel', evento => { if (exportando) evento.preventDefault(); });
    const actualizarTipo = () => {
        version++; generar.disabled = false; imprimir.disabled = guardarPDF.disabled = true; reporteGenerado = null;
        resultado.replaceChildren(); resultado.removeAttribute('aria-busy');
        titulo.textContent = tipo.value === 'lotes' ? 'Reporte de Lotes' : 'Reporte de Compras';
        estado.textContent = '';
        resultado.setAttribute('aria-label', tipo.value === 'lotes' ? 'Reporte de lotes generado' : 'Reporte de compras generado');
    };
    tipo.onchange = actualizarTipo;
    acceso.onclick = () => {
        const vista = document.getElementById('vistaInventarioLotes');
        const nuevoTipo = vista && !vista.hidden ? 'lotes' : 'compras';
        if (tipo.value !== nuevoTipo) { tipo.value = nuevoTipo; actualizarTipo(); }
        if (!modal.open) modal.showModal(); campos.desde.focus();
    };
    modal.addEventListener('close', () => { version++; generar.disabled = false; resultado.removeAttribute('aria-busy'); acceso.focus(); });
    const fecha = valor => valor ? valor.split('-').reverse().join('/') : '—';
    const dinero = centavos => 'L. ' + (centavos / 100).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    function pintar(datos) {
        const documento = document.createDocumentFragment();
        const encabezado = crear('header', undefined, 'reporte-compras-titulo');
        encabezado.append(crear('p', 'Farmacia Josué'), crear('h2', 'Reporte de Compras'), crear('p', `Desde: ${fecha(datos.desde)}   Hasta: ${fecha(datos.hasta)}`));
        documento.append(encabezado);
        if (!datos.bloques.length) documento.append(crear('p', 'No hay compras registradas en el período seleccionado.', 'reporte-compras-vacio'));
        for (const bloque of datos.bloques) {
            const seccion = crear('section', undefined, 'reporte-compras-bloque');
            seccion.append(crear('h3', `${fecha(bloque.fecha)} · Factura: ${bloque.factura} · ${bloque.proveedor || 'Proveedor sin nombre'}`));
            const desplazamiento = crear('div', undefined, 'reporte-compras-tabla-contenedor');
            const tabla = crear('table');
            const caption = crear('caption', `Lotes de la factura ${bloque.factura}`, 'reporte-compras-solo-lector'); tabla.append(caption);
            const columnas = crear('colgroup');
            for (const ancho of ['13%', '35%', '18%', '15%', '19%']) { const col = crear('col'); col.style.width = ancho; columnas.append(col); }
            tabla.append(columnas);
            const titulos = tabla.createTHead().insertRow();
            ['Código', 'Descripción', 'Precio de compra por empaque', 'Cantidad de empaques', 'Precio Total del Lote'].forEach(texto => { const th = crear('th', texto); th.scope = 'col'; titulos.append(th); });
            const cuerpo = tabla.createTBody();
            for (const lote of bloque.lotes) {
                const fila = cuerpo.insertRow();
                [lote.codigo, lote.descripcion, lote.precioEmpaqueCentavos == null ? '—' : dinero(lote.precioEmpaqueCentavos), lote.cantidadEmpaques == null ? '—' : String(lote.cantidadEmpaques), dinero(lote.totalLoteCentavos)]
                    .forEach((valor, i) => { const celda = fila.insertCell(); celda.textContent = valor; if (i >= 2) celda.className = 'reporte-compras-numero'; });
            }
            if (!bloque.lotes.length) { const celda = cuerpo.insertRow().insertCell(); celda.colSpan = 5; celda.textContent = 'Compra sin lotes registrados.'; }
            const subtotal = tabla.createTFoot().insertRow();
            const etiqueta = crear('th', 'Subtotal de la compra'); etiqueta.colSpan = 4; etiqueta.scope = 'row';
            const valor = crear('td', dinero(bloque.subtotalCentavos), 'reporte-compras-numero'); subtotal.append(etiqueta, valor);
            desplazamiento.append(tabla); seccion.append(desplazamiento); documento.append(seccion);
        }
        const totales = crear('table', undefined, 'reporte-compras-total');
        const fila = totales.createTBody().insertRow();
        const etiqueta = crear('th', 'Precio total de todos los lotes'); etiqueta.scope = 'row';
        fila.append(etiqueta, crear('td', dinero(datos.totalCentavos), 'reporte-compras-numero'));
        documento.append(totales); resultado.replaceChildren(documento);
    }
    function pintarLotes(datos) {
        const documento = document.createDocumentFragment();
        const encabezado = crear('header', undefined, 'reporte-compras-titulo');
        encabezado.append(crear('p', 'Farmacia Josué'), crear('h2', 'Reporte de Lotes'), crear('p', `Desde: ${fecha(datos.desde)}   Hasta: ${fecha(datos.hasta)}`), crear('p', 'Stock disponible actual'));
        documento.append(encabezado);
        const tabla = (encabezados, filas) => {
            const contenedor = crear('div', undefined, 'reporte-compras-tabla-contenedor');
            const nodo = crear('table'); const titulos = nodo.createTHead().insertRow();
            encabezados.forEach(texto => { const th = crear('th', texto); th.scope = 'col'; titulos.append(th); });
            const cuerpo = nodo.createTBody();
            filas.forEach(valores => { const fila = cuerpo.insertRow(); valores.forEach((valor, i) => { const celda = fila.insertCell(); celda.textContent = valor ?? '—'; if (i > 0 && typeof valor === 'number') celda.className = 'reporte-compras-numero'; }); });
            contenedor.append(nodo); return contenedor;
        };
        if (!datos.lotes.length) documento.append(crear('p', 'No hay lotes en el período seleccionado.', 'reporte-compras-vacio'));
        for (const lote of datos.lotes) {
            const bloque = crear('section', undefined, 'reporte-compras-bloque');
            bloque.append(crear('h3', `Número de lote: ${lote.numero_lote} · Factura: ${lote.numero_factura || '—'}`));
            bloque.append(tabla(['Medicamento', 'Stock por caja', 'Stock por blíster', 'Stock individual', 'Fecha de fabricación', 'Fecha de vencimiento'],
                [[lote.medicamento, lote.cajas, lote.blisteres, lote.unidades, fecha(lote.fecha_fabricacion), fecha(lote.fecha_vencimiento)]]));
            documento.append(bloque);
        }
        resultado.replaceChildren(documento);
    }
    filtros.onsubmit = async evento => {
        evento.preventDefault();
        campos.hasta.setCustomValidity(campos.desde.value > campos.hasta.value ? 'Hasta debe ser igual o posterior a Desde.' : '');
        if (!filtros.reportValidity()) return;
        const actual = ++version;
        const esLotes = tipo.value === 'lotes';
        generar.disabled = imprimir.disabled = guardarPDF.disabled = true; reporteGenerado = null;
        estado.textContent = 'Generando reporte…'; resultado.replaceChildren(); resultado.setAttribute('aria-busy', 'true');
        try {
            const operacion = esLotes ? 'reporteLotes' : 'reporteCompras';
            if (!window.farmacia?.[operacion]) throw new Error('Cerrá la aplicación y abrila nuevamente con npm start para activar los reportes.');
            const respuesta = await window.farmacia[operacion]({ desde: campos.desde.value, hasta: campos.hasta.value });
            if (actual !== version) return;
            if (respuesta.error) throw new Error(respuesta.error);
            if (!esLotes && respuesta.datos.bloques.some(bloque => bloque.lotes.some(lote =>
                !Object.hasOwn(lote, 'cantidadEmpaques') || !Object.hasOwn(lote, 'precioEmpaqueCentavos')))) {
                throw new Error('El servicio de reportes sigue ejecutando una versión anterior y no envía los datos de empaques. Cerrá completamente la aplicación y abrila nuevamente con npm start.');
            }
            if (esLotes) pintarLotes(respuesta.datos); else pintar(respuesta.datos);
            imprimir.disabled = guardarPDF.disabled = false;
            reporteGenerado = { tipo: esLotes ? 'lotes' : 'compras', desde: respuesta.datos.desde, hasta: respuesta.datos.hasta };
            estado.textContent = esLotes ? '' : `${respuesta.datos.bloques.length} compras en el período seleccionado.`;
        } catch (error) {
            if (actual !== version) return;
            estado.textContent = /No handler registered/.test(error.message) ? 'Cerrá la aplicación y abrila nuevamente con npm start para activar Reportes de Compras.' : error.message;
        } finally {
            if (actual === version) { generar.disabled = false; resultado.removeAttribute('aria-busy'); }
        }
    };
    filtros.oninput = () => { campos.hasta.setCustomValidity(''); };
    imprimir.onclick = () => window.print();
    guardarPDF.onclick = async () => {
        if (!reporteGenerado || exportando) return;
        const controles = [...filtros.elements, cerrar].map(input => [input, input.disabled]);
        controles.forEach(([input]) => { input.disabled = true; }); exportando = true;
        estado.textContent = 'Guardando PDF…';
        try {
            if (!window.farmacia?.guardarReportePDF) throw new Error('Cerrá la aplicación y abrila nuevamente con npm start para activar Guardar PDF.');
            const respuesta = await window.farmacia.guardarReportePDF(reporteGenerado);
            if (respuesta.error) throw new Error(respuesta.error);
            estado.textContent = respuesta.datos.cancelado ? 'Guardado cancelado.' : `PDF guardado en: ${respuesta.datos.archivo}`;
        } catch (error) {
            estado.textContent = /No handler registered/.test(error.message) ? 'Cerrá la aplicación y abrila nuevamente con npm start para activar Guardar PDF.' : error.message;
        } finally {
            exportando = false; controles.forEach(([input, disabled]) => { input.disabled = disabled; });
        }
    };
    window.addEventListener('beforeprint', () => { if (modal.open && resultado.children.length) document.body.classList.add('imprimiendo-reporte-compras'); });
    window.addEventListener('afterprint', () => document.body.classList.remove('imprimiendo-reporte-compras'));
})();

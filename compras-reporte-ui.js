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
    const cabecera = crear('header', undefined, 'reporte-compras-controles reporte-ventas-cabecera');
    const encabezado = crear('div');
    const titulo = crear('h2', 'Reporte de Compras'); titulo.id = 'reporteComprasTitulo';
    encabezado.append(crear('p', 'FARMACIA JOSUÉ', 'reporte-ventas-etiqueta'), titulo,
        crear('p', 'Consultá y exportá el reporte del período que necesités.'));
    const cerrar = crear('button', '×', 'reporte-ventas-cerrar'); cerrar.type = 'button';
    cerrar.setAttribute('aria-label', 'Cerrar reporte');
    cerrar.onclick = () => { modal.close(); acceso.focus(); };
    cabecera.append(encabezado, cerrar);

    const cuerpo = crear('div', undefined, 'reporte-ventas-cuerpo');
    const filtros = crear('form', undefined, 'reporte-compras-controles reporte-ventas-filtros reporte-compras-filtros');
    const agregarFiltro = (nombre, etiqueta, control) => {
        const grupo = crear('div');
        const label = crear('label', etiqueta, 'form-label');
        control.id = 'reporte-compras-' + nombre; control.name = nombre; label.htmlFor = control.id;
        grupo.append(label, control); filtros.append(grupo);
    };
    const tipo = crear('select', undefined, 'form-select');
    tipo.add(new Option('Compras', 'compras')); tipo.add(new Option('Lotes', 'lotes'));
    agregarFiltro('tipo', 'Tipo de reporte', tipo);
    const periodo = crear('select', undefined, 'form-select');
    for (const [valor, etiqueta] of [['hoy', 'Hoy'], ['semana', 'Últimos 7 días'], ['mes', 'Este mes'], ['personalizado', 'Rango de fechas']]) {
        periodo.add(new Option(etiqueta, valor));
    }
    agregarFiltro('periodo', 'Período', periodo);
    const campos = {};
    for (const [nombre, etiqueta] of [['desde', 'Desde'], ['hasta', 'Hasta']]) {
        const input = crear('input', undefined, 'form-control'); input.type = 'date'; input.required = true;
        campos[nombre] = input; agregarFiltro(nombre, etiqueta, input);
    }
    const generar = crear('button', 'Consultar', 'btn btn-outline-primary'); generar.type = 'submit';
    filtros.append(generar);
    const estado = crear('p', '', 'reporte-compras-controles reporte-ventas-estado'); estado.setAttribute('role', 'status');
    const resultado = crear('section'); resultado.id = 'reporteComprasDocumento'; resultado.setAttribute('aria-label', 'Reporte de compras generado');
    cuerpo.append(filtros, estado, resultado);
    const pie = crear('footer', undefined, 'reporte-compras-controles reporte-ventas-pie');
    const imprimir = crear('button', 'Imprimir', 'btn btn-outline-primary'); imprimir.type = 'button'; imprimir.disabled = true;
    const guardarPDF = crear('button', 'Guardar PDF', 'btn btn-warning'); guardarPDF.type = 'button'; guardarPDF.disabled = true;
    pie.append(imprimir, guardarPDF);
    modal.append(cabecera, cuerpo, pie); document.body.append(modal);

    let version = 0;
    let reporteGenerado = null;
    let exportando = false;
    modal.addEventListener('cancel', evento => { if (exportando) evento.preventDefault(); });
    const prepararReporte = mensaje => {
        version++;
        generar.disabled = false; imprimir.disabled = guardarPDF.disabled = true; reporteGenerado = null;
        resultado.replaceChildren(); resultado.removeAttribute('aria-busy');
        campos.hasta.setCustomValidity('');
        estado.textContent = mensaje;
    };
    const actualizarTipo = () => {
        const esLotes = tipo.value === 'lotes';
        titulo.textContent = esLotes ? 'Reporte de Lotes' : 'Reporte de Compras';
        resultado.setAttribute('aria-label', esLotes ? 'Reporte de lotes generado' : 'Reporte de compras generado');
    };
    const fechaLocal = dia => `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
    const aplicarPeriodo = () => {
        const hoy = new Date();
        const inicio = new Date(hoy);
        if (periodo.value === 'semana') inicio.setDate(hoy.getDate() - 6);
        if (periodo.value === 'mes') inicio.setDate(1);
        campos.desde.value = fechaLocal(inicio);
        campos.hasta.value = fechaLocal(hoy);
    };
    const consultar = () => {
        prepararReporte('');
        filtros.requestSubmit();
    };
    tipo.onchange = () => { actualizarTipo(); consultar(); };
    periodo.onchange = () => {
        if (periodo.value === 'personalizado') {
            prepararReporte('Elegí las fechas y pulsá Consultar.');
            campos.desde.focus();
        } else {
            aplicarPeriodo();
            consultar();
        }
    };
    for (const campo of Object.values(campos)) {
        campo.oninput = () => {
            periodo.value = 'personalizado';
            prepararReporte('Pulsá Consultar para actualizar el reporte.');
        };
    }
    acceso.onclick = () => {
        if (modal.open) return;
        if (acceso.hidden) return;
        tipo.value = 'compras';
        actualizarTipo();
        periodo.value = 'hoy';
        aplicarPeriodo();
        modal.showModal();
        periodo.focus();
        consultar();
    };
    modal.addEventListener('close', () => {
        if (!modal.open) { prepararReporte(''); acceso.focus(); }
    });
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
    imprimir.onclick = () => window.print();
    guardarPDF.onclick = async () => {
        if (!reporteGenerado || exportando) return;
        const controles = [...filtros.elements, cerrar, imprimir, guardarPDF].map(input => [input, input.disabled]);
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

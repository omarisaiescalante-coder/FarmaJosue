// Navegación por estado local: cambiar de vista conserva los campos de la compra sin guardar.
(() => {
    const registro = document.getElementById('vistaRegistroCompras');
    const historial = document.getElementById('vistaInventarioCompras');
    const paginaLotes = document.getElementById('vistaInventarioLotes');
    const acceso = document.getElementById('irInventarioCompras');
    const regreso = document.getElementById('regresarRegistroCompras');
    if (!registro || !historial || !acceso || !regreso) return;
    const titulo = document.getElementById('pageTitle');
    const descripcion = document.getElementById('pageDescription');
    let abrirLotes;
    let compras = [];
    let posicion = 0;
    function cambiarVista(mostrarHistorial) {
        if (paginaLotes) paginaLotes.hidden = true;
        registro.hidden = mostrarHistorial;
        historial.hidden = !mostrarHistorial;
        titulo.textContent = mostrarHistorial ? 'Inventario de Compras' : 'Compras';
        descripcion.textContent = mostrarHistorial
            ? 'Consulta las compras registradas y los lotes asociados.'
            : 'Registro de compras de medicamentos a laboratorios.';
        acceso.setAttribute('aria-expanded', String(mostrarHistorial));
        if (mostrarHistorial) {
            document.getElementById('historialComprasTitulo').focus();
        } else {
            acceso.focus({ preventScroll: true });
            window.scrollTo(0, posicion);
        }
    }
    acceso.setAttribute('aria-controls', historial.id);
    acceso.setAttribute('aria-expanded', 'false');
    acceso.onclick = () => {
        if (!historial.hidden) return;
        posicion = window.scrollY;
        cambiarVista(true);
    };
    regreso.onclick = () => cambiarVista(false);
    const dinero = valor => new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(Number(valor || 0));
    window.inventarioCompras = {
        // Navegaci?n interna sin recargar: conserva borrador, tablas y sus posiciones.
        mostrarRegistro() { cambiarVista(false); },
        mostrarLotes() {
            if (paginaLotes && !paginaLotes.hidden) return;
            if (!registro.hidden) posicion = window.scrollY;
            registro.hidden = true;
            historial.hidden = true;
            paginaLotes.hidden = false;
            titulo.textContent = 'Inventario de Lotes';
            descripcion.textContent = 'Inventario general de lotes y sus medicamentos.';
            acceso.setAttribute('aria-expanded', 'false');
        },
        actualizar(filas, accionLotes) {
            compras = filas;
            abrirLotes = accionLotes;
            const contenedor = document.getElementById('historialComprasTabla');
            const resumen = document.getElementById('historialComprasResumen');
            resumen.textContent = `${compras.length} compras registradas · Total: ${dinero(compras.reduce((suma, c) => suma + Number(c.total || 0), 0))}`;
            contenedor.replaceChildren();
            acceso.disabled = false;
            if (!compras.length) {
                contenedor.textContent = 'No hay compras registradas.';
                return;
            }
            const tabla = document.createElement('table');
            tabla.className = 'table table-hover align-middle';
            const encabezado = tabla.createTHead().insertRow();
            ['Factura', 'Fecha de compra', 'Proveedor / Laboratorio', 'Total', 'Método de pago', 'Condición', 'Acciones'].forEach(texto => {
                const th = document.createElement('th'); th.scope = 'col'; th.textContent = texto; encabezado.append(th);
            });
            const cuerpo = tabla.createTBody();
            compras.forEach(compra => {
                const fila = cuerpo.insertRow();
                [compra.numero_factura, compra.fecha_compra, compra.nombre_distribuidor || compra.laboratorio,
                    dinero(compra.total), compra.metodo_pago, compra.estado].forEach(valor => {
                    fila.insertCell().textContent = valor ?? '—';
                });
                const boton = document.createElement('button');
                boton.type = 'button'; boton.className = 'btn btn-outline-success btn-sm';
                boton.textContent = 'Ver Lote de esta Compra';
                // El ID de compra identifica de manera inequívoca el conjunto de lotes asociado.
                boton.dataset.compraId = compra.id_compra;
                boton.onclick = () => abrirLotes(compra);
                fila.insertCell().append(boton);
            });
            contenedor.append(tabla);
        }
    };
})();

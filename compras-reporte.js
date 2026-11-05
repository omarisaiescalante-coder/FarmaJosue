// Una línea por lote: las formas de venta son equivalencias del mismo inventario.
function agruparReporte(filas, desde, hasta) {
    const bloques = new Map();
    let totalCentavos = 0;
    for (const fila of filas) {
        if (!bloques.has(fila.id_compra)) bloques.set(fila.id_compra, {
            id_compra: fila.id_compra, factura: fila.numero_factura, fecha: fila.fecha_compra,
            proveedor: fila.proveedor, lotes: [], subtotalCentavos: 0,
        });
        if (fila.id_lote == null) continue;
        const bloque = bloques.get(fila.id_compra);
        const stock = Number(fila.cantidad_inicial || 0);
        const blister = fila.tipo_medicamento === 'Pastilla' || fila.contenido_caja === 'Blister';
        const porBlister = Number(fila.unidades_por_blister || 1);
        const porCaja = Number(fila.paquetes_por_caja || 1) * (blister ? porBlister : 1);
        const formas = [
            { nombre: 'Caja', plural: 'cajas', factor: porCaja, precio: fila.precio_venta },
            { nombre: 'Blíster', plural: 'blísteres', factor: porBlister, precio: blister ? fila.precio_venta_contenido : null },
            { nombre: 'Unidad', plural: 'unidades', factor: 1, precio: fila.precio_venta_unidad },
        ].filter(f => f.precio != null && Number(f.precio) > 0);
        const principal = formas.find(f => stock % f.factor === 0) || { nombre: 'Unidad', plural: 'unidades', factor: 1 };
        const cantidad = stock / principal.factor;
        const equivalencias = formas.filter(f => f !== principal).map(f => `${stock / f.factor} ${f.plural}`);
        const cantidadEmpaques = Number.isSafeInteger(Number(fila.cantidad_empaques)) && Number(fila.cantidad_empaques) > 0 ? Number(fila.cantidad_empaques) : null;
        const precioEmpaqueCentavos = fila.precio_empaque != null ? Math.round(Number(fila.precio_empaque) * 100) : null;
        if (precioEmpaqueCentavos !== null && (!Number.isSafeInteger(precioEmpaqueCentavos) || precioEmpaqueCentavos < 0)) throw new Error('El precio de compra del empaque no es válido.');
        const costoCentavos = cantidadEmpaques !== null && precioEmpaqueCentavos !== null ? cantidadEmpaques * precioEmpaqueCentavos : Math.round(Number(fila.costo_total || 0) * 100);
        if (!Number.isSafeInteger(costoCentavos) || costoCentavos < 0) throw new Error('El costo de un lote no es válido para el reporte.');
        bloque.lotes.push({ id_lote: fila.id_lote, codigo: fila.numero_lote,
            descripcion: `${fila.medicamento} — ${cantidad} ${principal.plural}${equivalencias.length ? ` (equivalente a ${equivalencias.join(', ')})` : ''}`,
            cantidad, forma: principal.nombre, cantidadEmpaques, precioEmpaqueCentavos, costoCentavos, totalLoteCentavos: costoCentavos });
        bloque.subtotalCentavos += costoCentavos;
        totalCentavos += costoCentavos;
        if (!Number.isSafeInteger(totalCentavos)) throw new Error('El total del reporte excede el rango permitido.');
    }
    return { desde, hasta, bloques: [...bloques.values()], totalCentavos };
}
module.exports = { agruparReporte };

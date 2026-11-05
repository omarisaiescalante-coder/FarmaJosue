function prepararReporteLotes(filas, medicamentos, desde, hasta) {
    const lotes = filas.map(lote => {
        const disponible = Number(lote.cantidad_disponible || 0);
        const pastilla = lote.tipo_medicamento === 'Pastilla' || lote.contenido_caja === 'Blister';
        const porBlister = Number(lote.unidades_por_blister || 1);
        const porCaja = Number(lote.paquetes_por_caja || 1) * (pastilla ? porBlister : 1);
        const existe = precio => precio != null && Number(precio) > 0;
        return { id_lote: lote.id_lote, numero_lote: lote.numero_lote, numero_factura: lote.numero_factura, medicamento: lote.medicamento,
            cajas: existe(lote.precio_venta) ? Math.floor(disponible / porCaja) : null,
            blisteres: pastilla && existe(lote.precio_venta_contenido) ? Math.floor(disponible / porBlister) : null,
            unidades: existe(lote.precio_venta_unidad) ? disponible : null,
            fecha_fabricacion: lote.fecha_fabricacion, fecha_vencimiento: lote.fecha_vencimiento };
    });
    const ordenados = medicamentos.map(m => ({ id_medicamento: m.id_medicamento, nombre: m.nombre, unidades_vendidas: Number(m.unidades_vendidas || 0) }))
        .sort((a, b) => b.unidades_vendidas - a.unidades_vendidas || a.nombre.localeCompare(b.nombre, 'es') || a.id_medicamento - b.id_medicamento);
    let puesto = 0, anterior = null;
    ordenados.forEach(m => {
        if (m.unidades_vendidas > 0 && m.unidades_vendidas !== anterior) puesto++;
        m.puesto = m.unidades_vendidas > 0 ? puesto : null;
        anterior = m.unidades_vendidas;
    });
    return { desde, hasta, lotes, medicamentos: ordenados };
}
module.exports = { prepararReporteLotes };

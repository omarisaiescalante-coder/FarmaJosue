(function (root) {
    // Cajona -> cajitas -> blísteres -> unidades. Cada fila describe el siguiente nivel.
    function equivalenciasLote(lote) {
        const filas = lote.formas_venta;
        const entero = valor => Number.isSafeInteger(Number(valor)) && Number(valor) > 0 && Number(valor) <= 2147483647;
        if (!Array.isArray(filas) || !filas.length || filas.some(f => !f || !entero(f.cantidad)))
            throw new Error('Ingresá una cantidad entera positiva para cada forma de venta.');
        const pastilla = lote.tipo_medicamento === 'Pastilla';
        const caja = filas.find(f => f.nombre === 'Caja');
        const blister = filas.find(f => f.nombre === 'Blister');
        if (blister && !pastilla) throw new Error('Solo las pastillas admiten venta por blíster.');
        const unidad = filas.find(f => f.nombre === 'Unidad');
        const cajasPorPaquete = Number(caja?.cantidad || lote.cajas_por_paquete || 1);
        const paquetes = pastilla ? Number(blister?.cantidad || lote.paquetes_por_caja || 1) : Number(unidad?.cantidad || lote.paquetes_por_caja || 1);
        const unidades = pastilla ? Number(unidad?.cantidad || lote.unidades_por_blister || 1) : 1;
        const factorCaja = paquetes * unidades;
        const factor = cajasPorPaquete * factorCaja;
        const blisteresPorPaquete = pastilla ? cajasPorPaquete * paquetes : null;
        if (![cajasPorPaquete, paquetes, unidades, factor].every(entero))
            throw new Error('Las cantidades y el contenido total de la cajona deben ser enteros positivos y no superar el inventario permitido.');
        return { factor, factorCaja, paquetes, unidades,
            cajasPorPaquete, blisteresPorPaquete, unidadesPorPaquete: factor };
    }
    if (typeof module !== 'undefined') module.exports = { equivalenciasLote };
    else root.equivalenciasLote = equivalenciasLote;
})(typeof window !== 'undefined' ? window : globalThis);

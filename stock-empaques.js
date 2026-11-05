// Las cantidades son equivalencias del mismo stock, no existencias que se suman.
(function (root) {
    function textoStockEmpaque(lote, cantidad = lote.cantidad_disponible) {
        const stock = Number(cantidad || 0);
        const blister = lote.tipo_medicamento === 'Pastilla' || lote.contenido_caja === 'Blister';
        const unidades = Number(lote.unidades_por_blister || 1);
        const factor = Number(lote.paquetes_por_caja || 1) * (blister ? unidades : 1);
        return `Caja = ${Math.floor(stock / factor)}${blister ? ` · Blíster = ${Math.floor(stock / unidades)}` : ''} · Unidad = ${stock}`;
    }
    if (typeof module !== 'undefined') module.exports = { textoStockEmpaque };
    else root.textoStockEmpaque = textoStockEmpaque;
})(typeof window !== 'undefined' ? window : globalThis);

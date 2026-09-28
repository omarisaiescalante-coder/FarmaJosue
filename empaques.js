const FORMAS = ['Caja', 'Frasco', 'Ampolla', 'Suero'];
function entero(valor, nombre) {
    const n = Number(valor);
    if (!Number.isSafeInteger(n) || n < 1 || n > 2147483647) throw new Error(`Revisá ${nombre}.`);
    return n;
}
function dinero(valor) {
    if (!/^\d+(\.\d{1,2})?$/.test(String(valor)) || Number(valor) <= 0 || Number(valor) > 99999999.99)
        throw new Error('Revisá los precios de venta.');
    return Number(valor).toFixed(2);
}
function validarEmpaque(lote) {
    const forma = lote.presentacion_ingreso || 'Unidad';
    if (Object.hasOwn(lote, 'presentacion_ingreso') && !FORMAS.includes(lote.presentacion_ingreso)) throw new Error('Presentación de ingreso inválida.');
    let contenido = null, paquetes = null, unidades = null, factor = 1;
    if (forma === 'Caja') {
        contenido = lote.contenido_caja;
        if (!['Blister', 'Sobre'].includes(contenido)) throw new Error('Elegí blísteres o sobres por caja.');
        paquetes = entero(lote.paquetes_por_caja, 'la cantidad de blísteres o sobres por caja');
        unidades = contenido === 'Blister' ? entero(lote.unidades_por_blister, 'las unidades por blíster') : 1;
        factor = entero(paquetes * unidades, 'el contenido total de la caja');
    }
    const precios = [];
    if (lote.presentacion_ingreso) {
        const agregarPrecio = (nombre, valor, unidades) => {
            if (valor !== undefined && valor !== null && valor !== '') precios.push({ nombre, precio: dinero(valor), unidades });
        };
        agregarPrecio(forma, lote.precio_venta, factor);
        if (forma === 'Caja') {
            agregarPrecio(contenido, lote.precio_venta_contenido, unidades);
            if (contenido === 'Blister') agregarPrecio('Unidad', lote.precio_venta_unidad, 1);
        }
        if (!precios.length) throw new Error('Ingresá al menos un precio de venta.');
    }
    return { forma, contenido, paquetes, unidades, factor, precios };
}
module.exports = { validarEmpaque };

const FORMAS = ['Caja', 'Frasco', 'Ampolla', 'Suero', 'Sueros por caja'];
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
    if (Object.hasOwn(lote, 'tipo_medicamento') || Object.hasOwn(lote, 'modalidad_venta')) return validarModalidad(lote);
    const forma = lote.presentacion_ingreso || 'Unidad';
    if (Object.hasOwn(lote, 'presentacion_ingreso') && !FORMAS.includes(lote.presentacion_ingreso)) throw new Error('Presentación de ingreso inválida.');
    let contenido = null, paquetes = null, unidades = null, factor = 1;
    if (forma === 'Caja' || forma === 'Sueros por caja') {
        contenido = forma === 'Sueros por caja' ? 'Suero' : lote.contenido_caja;
        if (!['Blister', 'Sobre', 'Suero'].includes(contenido) || (forma === 'Caja' && contenido === 'Suero')) throw new Error('Elegí blísteres o sobres por caja.');
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
        if (forma === 'Caja' || forma === 'Sueros por caja') {
            agregarPrecio(contenido, lote.precio_venta_contenido, unidades);
            if (contenido === 'Blister') agregarPrecio('Unidad', lote.precio_venta_unidad, 1);
        }
        if (!precios.length) throw new Error('Ingresá al menos un precio de venta.');
    }
    return { forma, contenido, paquetes, unidades, factor, precios };
}
module.exports = { validarEmpaque };

function validarModalidad(lote) {
    const tipo = lote.tipo_medicamento, modalidad = lote.modalidad_venta;
    if (!['Pastilla', 'Frasco', 'Ampolla', 'Suero'].includes(tipo) || !['Caja', 'Caja y unidad'].includes(modalidad))
        throw new Error('Seleccioná el tipo de medicamento y la restricción de venta.');
    const pastilla = tipo === 'Pastilla', individual = modalidad === 'Caja y unidad';
    // Sin venta individual, cada caja de pastillas es una unidad interna de stock.
    const paquetes = pastilla && !individual ? 1 : entero(lote.paquetes_por_caja, 'el contenido por caja');
    const unidades = pastilla && individual ? entero(lote.unidades_por_blister, 'las pastillas por blíster') : 1;
    const factor = entero(paquetes * unidades, 'el contenido total de la caja');
    const precios = [{ nombre: 'Caja', precio: dinero(lote.precio_venta), unidades: factor }];
    const compras = { contenido: null, unidad: null };
    if (individual) {
        if (pastilla) {
            precios.push({ nombre: 'Blister', precio: dinero(lote.precio_venta_contenido), unidades });
            compras.contenido = dinero(lote.precio_compra_contenido);
        }
        precios.push({ nombre: pastilla ? 'Pastilla' : 'Unidad', precio: dinero(lote.precio_venta_unidad), unidades: 1 });
        compras.unidad = dinero(lote.precio_compra_unidad);
    }
    return { forma: 'Caja', contenido: pastilla ? 'Blister' : tipo, paquetes, unidades, factor, precios, compras, tipo, modalidad };
}

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reporte } = require('./compras-servicio');
const { agruparReporte } = require('./compras-reporte');
const fila = { id_compra: 1, numero_factura: 'FAC#1', fecha_compra: '2026-11-04', proveedor: 'Proveedor',
    id_lote: 1, numero_lote: 'LOT-1', medicamento: 'Medicamento', cantidad_inicial: 480, cantidad_disponible: 1,
    tipo_medicamento: 'Pastilla', paquetes_por_caja: 10, unidades_por_blister: 8,
    precio_venta: 35, precio_venta_contenido: 45, precio_venta_unidad: 5, costo_total: '15000.11' };
test('Agrupa por compra, usa stock adquirido y suma cada lote una sola vez', () => {
    const datos = agruparReporte([fila, { ...fila, id_lote: 2, numero_lote: 'LOT-2', costo_total: '0.09' }, { ...fila, id_compra: 2, id_lote: 3, costo_total: '2.01' }], '2026-11-01', '2026-11-04');
    assert.equal(datos.bloques.length, 2);
    assert.equal(datos.bloques[0].lotes.length, 2);
    assert.equal(datos.bloques[0].lotes[0].cantidad, 6);
    assert.match(datos.bloques[0].lotes[0].descripcion, /6 cajas.*60 blísteres.*480 unidades/);
    assert.equal(datos.bloques[0].lotes[0].codigo, 'LOT-1');
    assert.equal(datos.bloques[0].subtotalCentavos, 1500020);
    assert.equal(datos.totalCentavos, 1500221);
});
test('Venta solo por unidad y período vacío', () => {
    const datos = agruparReporte([{ ...fila, tipo_medicamento: 'Frasco', precio_venta: null, precio_venta_contenido: null }], '2026-11-04', '2026-11-04');
    assert.equal(datos.bloques[0].lotes[0].cantidad, 480);
    assert.equal(datos.bloques[0].lotes[0].forma, 'Unidad');
    assert.deepEqual(agruparReporte([], '2026-11-04', '2026-11-04').bloques, []);
    assert.equal(agruparReporte([], '2026-11-04', '2026-11-04').totalCentavos, 0);
});
test('Usa el precio y la cantidad de empaques de compra para calcular el total', () => {
    const datos = agruparReporte([{ ...fila, cantidad_empaques: 5, precio_empaque: '1700.25', costo_total: '0.00' }], '2026-11-04', '2026-11-04');
    const lote = datos.bloques[0].lotes[0];
    assert.equal(lote.cantidadEmpaques, 5);
    assert.equal(lote.precioEmpaqueCentavos, 170025);
    assert.equal(lote.totalLoteCentavos, 850125);
    assert.equal(datos.totalCentavos, 850125);
    assert.equal(lote.cantidad, 6, 'El stock y los empaques son cantidades diferentes');
});
test('Cinco empaques de cinco cajas son 25 cajas y conservan el precio de compra del empaque', () => {
    const datos = agruparReporte([{ ...fila, tipo_medicamento: 'Suero', cantidad_inicial: 450,
        paquetes_por_caja: 18, unidades_por_blister: null, precio_venta_contenido: null,
        cantidad_empaques: 5, precio_empaque: '45.00', costo_total: '225.00' }], '2026-11-04', '2026-11-04');
    const lote = datos.bloques[0].lotes[0];
    assert.equal(lote.cantidad, 25);
    assert.equal(lote.cantidadEmpaques, 5);
    assert.equal(lote.precioEmpaqueCentavos, 4500);
    assert.equal(lote.totalLoteCentavos, 22500);
});
test('Autoriza en el servidor, valida fechas reales y filtra ambos extremos mediante parámetros', async () => {
    const consultas = [];
    const db = { execute: async (sql, params) => {
        consultas.push([sql, params]);
        return sql.includes('FROM usuarios') ? [[{ id_usuario: 1 }]] : [[fila]];
    } };
    await assert.rejects(reporte(db, null, {}), /sesión/);
    for (const rango of [{}, { desde: '2026-02-30', hasta: '2026-03-01' }, { desde: '2026-11-05', hasta: '2026-11-04' }]) {
        await assert.rejects(reporte(db, { id_usuario: 1 }, rango), /rango de fechas/);
    }
    assert(!consultas.some(([sql]) => sql.includes('FROM compras c')));
    const datos = await reporte(db, { id_usuario: 1 }, { desde: '2026-11-04', hasta: '2026-11-04' });
    assert.equal(datos.totalCentavos, 1500011);
    assert.deepEqual(consultas.at(-1)[1], ['2026-11-04', '2026-11-04']);
    assert.match(consultas.at(-1)[0], /DATE_ADD\(\?, INTERVAL 1 DAY\)/);
    assert.match(consultas.at(-1)[0], /l\.cantidad_empaques, l\.precio_empaque/);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepararReporteLotes } = require('./lotes-reporte');
const { reporteLotes } = require('./compras-servicio');
const lote = { id_lote: 1, numero_lote: 'LOT-1', numero_factura: 'FAC#12', medicamento: 'Pastillas', tipo_medicamento: 'Pastilla',
    cantidad_disponible: 95, paquetes_por_caja: 3, unidades_por_blister: 8,
    precio_venta: 50, precio_venta_contenido: 10, precio_venta_unidad: 2, fecha_fabricacion: '2026-11-04', fecha_vencimiento: '2027-01-01' };
test('Stock disponible de cajitas, blísteres e individuales; ausentes son null y agotados cero', () => {
    const datos = prepararReporteLotes([lote, { ...lote, id_lote: 2, cantidad_disponible: 0 },
        { ...lote, id_lote: 3, tipo_medicamento: 'Suero', precio_venta: null, precio_venta_contenido: null }], [], '2026-11-01', '2026-11-04');
    assert.deepEqual([datos.lotes[0].cajas, datos.lotes[0].blisteres, datos.lotes[0].unidades], [3, 11, 95]);
    assert.deepEqual([datos.lotes[1].cajas, datos.lotes[1].blisteres, datos.lotes[1].unidades], [0, 0, 0]);
    assert.deepEqual([datos.lotes[2].cajas, datos.lotes[2].blisteres, datos.lotes[2].unidades], [null, null, 95]);
});
test('Incluye medicamentos sin ventas y asigna la misma posición a los empates', () => {
    const datos = prepararReporteLotes([], [{ id_medicamento: 1, nombre: 'Sin ventas', unidades_vendidas: '0' },
        { id_medicamento: 2, nombre: 'B', unidades_vendidas: '12' }, { id_medicamento: 3, nombre: 'A', unidades_vendidas: '12' },
        { id_medicamento: 4, nombre: 'Otro', unidades_vendidas: '5' }], '2026-11-01', '2026-11-04');
    assert.deepEqual(datos.medicamentos.map(m => m.puesto), [1, 1, 2, null]);
    assert.deepEqual(datos.medicamentos.map(m => m.nombre), ['A', 'B', 'Otro', 'Sin ventas']);
});
test('Valida permisos y fechas y consulta ventas completadas usando unidades históricas', async () => {
    const consultas = [];
    const db = { execute: async (sql, params) => {
        consultas.push([sql, params]);
        return [sql.includes('FROM usuarios') ? [{id_usuario: 1}] : sql.includes('FROM lote l') ? [lote] : []];
    } };
    await assert.rejects(reporteLotes(db, null, {}), /sesión/);
    await assert.rejects(reporteLotes(db, {id_usuario: 1}, {desde: '2026-02-30', hasta: '2026-03-01'}), /rango/);
    const datos = await reporteLotes(db, {id_usuario: 1}, {desde: '2026-11-04', hasta: '2026-11-04'});
    assert.equal(datos.lotes.length, 1);
    assert.equal(datos.lotes[0].numero_factura, 'FAC#12');
    assert.equal(datos.lotes[0].fecha_fabricacion, '2026-11-04');
    assert.match(consultas.at(-2)[0], /l\.fecha_fabricacion/);
    assert.match(consultas.at(-2)[0], /c\.numero_factura/);
    assert.match(consultas.at(-2)[0], /l\.fecha_ingreso >= \?/);
    assert.match(consultas.at(-1)[0], /v\.estado = 'Completada'/);
    assert.match(consultas.at(-1)[0], /SUM\(dl\.cantidad_unidades\)/);
    assert.deepEqual(consultas.at(-1)[1], ['2026-11-04', '2026-11-04']);
});

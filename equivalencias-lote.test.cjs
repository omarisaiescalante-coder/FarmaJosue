const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarEmpaque } = require('./empaques');
const datos = () => ({ tipo_medicamento: 'Pastilla', formas_venta: [
    { nombre: 'Caja', precio: 100, cantidad: 5 },
    { nombre: 'Blister', precio: 10, cantidad: 5 },
    { nombre: 'Unidad', precio: 2, cantidad: 10 },
] });
test('El ejemplo de 34 cajonas, 20 cajitas, 3 blísteres y 8 unidades no compara cantidades entre niveles', () => {
    const lote = datos();
    lote.formas_venta.forEach((fila, i) => { fila.cantidad = [20, 3, 8][i]; });
    const empaque = validarEmpaque(lote);
    assert.equal(empaque.factor, 480);
    assert.equal(34 * empaque.contenidoPaquete.cajas, 680);
    assert.equal(34 * empaque.contenidoPaquete.blisteres, 2040);
    assert.equal(34 * empaque.contenidoPaquete.unidades, 16320);
    assert.deepEqual(empaque.precios.map(p => p.unidades), [24, 8, 1]);
});
test('Las cantidades de las filas determinan el stock y las equivalencias de venta', () => {
    const empaque = validarEmpaque({ ...datos(), paquetes_por_caja: 99, unidades_por_blister: 99 });
    assert.equal(empaque.factor, 250);
    assert.equal(empaque.paquetes, 5);
    assert.equal(empaque.unidades, 10);
    assert.deepEqual(empaque.precios.map(p => p.unidades), [50, 10, 1]);
    assert.deepEqual(empaque.contenidoPaquete, { cajas: 5, blisteres: 25, unidades: 250 });
});
test('Quitar un precio conserva el contenido físico de la caja', () => {
    const lote = datos();
    lote.formas_venta.splice(0, 1);
    const empaque = validarEmpaque({ ...lote, cajas_por_paquete: 5, blisteres_por_paquete: 25, unidades_por_paquete: 250 });
    assert.equal(empaque.factor, 250);
    assert.deepEqual(empaque.precios.map(p => p.nombre), ['Blister', 'Unidad']);
});
test('Un paquete de cinco cajitas se registra aunque solo se venda por caja', () => {
    const lote = { tipo_medicamento: 'Pastilla', cajas_por_paquete: '', blisteres_por_paquete: '', unidades_por_paquete: '',
        formas_venta: [{ nombre: 'Caja', precio: 100, cantidad: 5 }] };
    const empaque = validarEmpaque(lote);
    assert.equal(empaque.factor, 5);
    assert.equal(empaque.precios[0].unidades, 1);
    assert.equal(empaque.contenidoPaquete.cajas, 5);
});
test('Rechaza equivalencias incompletas, fracciones, excedentes y cantidades incompatibles', () => {
    for (const cantidad of ['', 0, -1, .5, 2147483648]) {
        const lote = datos(); lote.formas_venta[1].cantidad = cantidad;
        assert.throws(() => validarEmpaque(lote), /cantidad|cantidades|contenido del paquete/);
    }

    assert.throws(() => validarEmpaque({ ...datos(), tipo_medicamento: 'Frasco' }), /pastillas/);
});

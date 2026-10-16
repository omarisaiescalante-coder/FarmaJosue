const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./calculos-venta');

test('formatea el DNI automáticamente', () => {
    assert.equal(C.formatearDni('0801199012345'), '0801-1990-12345');
    assert.equal(C.formatearDni('0801-1990-123'), '0801-1990-123');
    assert.equal(C.formatearDni('08011'), '0801-1');
    assert.equal(C.formatearDni('abc'), '');
});
test('valida la estructura del DNI', () => {
    const hoy = new Date(2026, 9, 16);
    assert(C.dniValido('0801-1990-12345', hoy));
    assert(!C.dniValido('0801-1990-1234', hoy));
    assert(!C.dniValido('9901-1990-12345', hoy));
    assert(!C.dniValido('0801-2090-12345', hoy));
    assert.equal(C.edadDesdeDni('0801-1960-12345', hoy), 66);
});
test('descuentos por edad no se acumulan', () => {
    assert.equal(C.porcentajeDescuento(59), 0);
    assert.equal(C.porcentajeDescuento(60), 25);
    assert.equal(C.porcentajeDescuento(79), 25);
    assert.equal(C.porcentajeDescuento(80), 30);
    assert.equal(C.porcentajeDescuento(null), 0);
});
test('calcula descuento, ISV y total', () => {
    const lineas = [{ precio: 10000, cantidad: 2, aplicaIsv: true }, { precio: 5000, cantidad: 1, aplicaIsv: false }];
    const sin = C.calcularVenta(lineas, 30);
    assert.deepEqual([sin.subtotal, sin.descuento, sin.isv, sin.total], [25000, 0, 3000, 28000]);
    const tercera = C.calcularVenta(lineas, 65);
    assert.deepEqual([tercera.descuento, tercera.isv, tercera.total], [6250, 2250, 21000]);
    const cuarta = C.calcularVenta(lineas, 85);
    assert.deepEqual([cuarta.descuento, cuarta.isv, cuarta.total], [7500, 2100, 19600]);
});
test('calcula el cambio y detecta pago insuficiente', () => {
    assert.deepEqual(C.calcularCambio(2300, 5000), { suficiente: true, cambio: 2700, faltante: 0 });
    assert.deepEqual(C.calcularCambio(2300, 2000), { suficiente: false, cambio: 0, faltante: 300 });
});
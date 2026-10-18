const test = require('node:test');
const assert = require('node:assert/strict');
const ventas = require('./ventas-servicios');

function escenario() {
    const consultas = [];
    let rollback = false, commit = false, liberada = false;
    const db = {
        async execute(sql, args) {
            consultas.push({ sql, args });
            if (sql.includes('FROM usuarios')) return [[{ id_usuario: 1 }]];
            if (sql.includes('FROM medicamentos WHERE')) return [[{ id_medicamento: 1, aplica_isv: 1 }]];
            if (sql.includes('FROM medicamento_presentaciones') && !sql.includes('JOIN')) return [[]];
            if (sql.includes('FOR UPDATE') && sql.includes('JOIN medicamentos')) return [[{
                id_presentacion: 1, id_medicamento: 1, nombre: 'Ejemplo', nombre_presentacion: 'Unidad',
                unidades_stock: 1, stock_total: 10, precio_venta: '100.00', aplica_isv: 1,
                estado_medicamento: 'Disponible', estado: 'Activa', restriccion: 'Venta Libre',
            }]];
            if (sql.includes('FROM lote')) return [[{ id_lote: 1, cantidad_disponible: 10 }]];
            return [{ insertId: 1, affectedRows: 1 }];
        },
        async getConnection() { return {
            execute: db.execute, async beginTransaction() {},
            async commit() { commit = true; }, async rollback() { rollback = true; },
            release() { liberada = true; },
        }; },
    };
    return { db, consultas, estado: () => ({ rollback, commit, liberada }) };
}
const datos = { edad: 65, metodo_pago: 'Efectivo', monto_recibido: 200, items: [{ id_presentacion: 1, cantidad: 2 }] };

test('el catálogo incluye el indicador de ISV', async () => {
    const e = escenario();
    const catalogo = await ventas.cargar(e.db, { id_usuario: 1 });
    assert.equal(catalogo.medicamentos[0].aplica_isv, 1);
    assert.match(e.consultas.find(c => c.sql.includes('FROM medicamentos WHERE')).sql, /aplica_isv/);
});

test('guarda el mismo descuento, impuesto, total y cambio que la pantalla', async () => {
    const e = escenario();
    const resultado = await ventas.guardar(e.db, { id_usuario: 1 }, datos);
    const insert = e.consultas.find(c => c.sql.startsWith('INSERT INTO ventas'));
    assert.deepEqual(insert.args.slice(3), ['200.00', '50.00', '22.50', '172.50', 'Efectivo', 0, '200.00', '27.50']);
    assert.equal(resultado.cambio, '27.50');
    assert.equal(resultado.total, '172.50');
    assert.deepEqual(e.estado(), { rollback: false, commit: true, liberada: true });
});

test('rechaza pago insuficiente sin registrar venta y revierte la transacción', async () => {
    const e = escenario();
    await assert.rejects(ventas.guardar(e.db, { id_usuario: 1 }, { ...datos, monto_recibido: 100 }), /Pago insuficiente/);
    assert(!e.consultas.some(c => c.sql.startsWith('INSERT')));
    assert.deepEqual(e.estado(), { rollback: true, commit: false, liberada: true });
});

test('valida edad y DNI en el servidor', async () => {
    for (const cambios of [{ edad: -1 }, { edad: 121 }, { dni: 'invalido' }]) {
        const e = escenario();
        await assert.rejects(ventas.guardar(e.db, { id_usuario: 1 }, { ...datos, ...cambios }));
        assert(!e.consultas.some(c => c.sql.startsWith('INSERT')));
    }
});

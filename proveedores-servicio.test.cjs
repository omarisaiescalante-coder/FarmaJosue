const { test } = require('node:test');
const assert = require('node:assert/strict');
const servicio = require('./proveedores-servicio');
function escenario() {
    const consultas = [];
    return { consultas, db: {
        query: async () => [[]],
        execute: async (sql, args) => { consultas.push({ sql, args });
            if (sql.startsWith('SELECT')) return [[{ id_usuario: 1, id_distribuidor: 3 }]];
            return [{ insertId: 3, affectedRows: 1 }];
        },
    } };
}
const datos = { nombre: 'Farinter Premium', telefono: '9999-9999', correo: 'p@example.com' };
test('Crea y edita proveedor con parámetros SQL', async () => {
    const e = escenario();
    const creado = await servicio.guardar(e.db, { id_usuario: 1 }, datos);
    assert.equal(creado.id_distribuidor, 3);
    await servicio.guardar(e.db, { id_usuario: 1 }, { ...datos, id_distribuidor: 3 });
    assert.deepEqual(e.consultas.find(c => c.sql.startsWith('INSERT')).args, ['Farinter Premium', '9999-9999', 'p@example.com']);
    assert.equal(e.consultas.find(c => c.sql.startsWith('UPDATE')).args.at(-1), 3);
});
test('Rechaza datos inválidos sin escribir y exige sesión activa', async () => {
    for (const cambio of [{ nombre: '' }, { telefono: '123' }, { correo: 'no' }, { id_distribuidor: -1 }]) {
        const e = escenario(); await assert.rejects(servicio.guardar(e.db, { id_usuario: 1 }, { ...datos, ...cambio }));
        assert(e.consultas.every(c => c.sql.startsWith('SELECT')));
    }
    for (const operacion of Object.values(servicio)) await assert.rejects(operacion(escenario().db, null), /sesión/);
});
test('No elimina proveedores asociados a compras', async () => {
    const e = escenario(); e.db.execute = async sql => {
        if (sql.startsWith('SELECT')) return [[{ id_usuario: 1 }]];
        throw Object.assign(new Error('FK'), { code: 'ER_ROW_IS_REFERENCED_2' });
    };
    await assert.rejects(servicio.eliminar(e.db, { id_usuario: 1 }, 3), /compras asociadas/);
});
test('Traduce nombres duplicados y elimina proveedores sin relaciones', async () => {
    const e = escenario(); await servicio.eliminar(e.db, { id_usuario: 1 }, 3);
    assert.deepEqual(e.consultas.find(c => c.sql.startsWith('DELETE')).args, [3]);
    e.db.execute = async sql => { if (sql.startsWith('SELECT')) return [[{ id_usuario: 1 }]]; throw Object.assign(new Error('Duplicado'), { code: 'ER_DUP_ENTRY' }); };
    await assert.rejects(servicio.guardar(e.db, { id_usuario: 1 }, datos), /Ya existe/);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const servicio = require('./compras-servicio');

function escenario(fallarLote = false) {
    const consultas = [];
    const pasos = [];
    const conexion = {
        beginTransaction: async () => pasos.push('inicio'),
        execute: async (sql, args) => {
            consultas.push({ sql, args });
            if (sql.startsWith('SELECT stock_total')) return [[{ stock_total: 5, estado: 'Disponible' }]];
            if (sql.startsWith('SELECT id_distribuidor')) return [[{ id_distribuidor: 3 }]];
            if (sql.startsWith('INSERT INTO compras')) return [{ insertId: 20 }];
            if (sql.startsWith('INSERT INTO medicamentos')) return [{ insertId: 10 }];
            if (sql.startsWith('INSERT INTO lote') && fallarLote) {
                const error = new Error('Duplicado');
                error.code = 'ER_DUP_ENTRY';
                throw error;
            }
            return [{ insertId: 25 }];
        },
        commit: async () => pasos.push('commit'),
        rollback: async () => pasos.push('rollback'),
        release: () => pasos.push('release'),
    };
    const db = { execute: async () => [[{ id_usuario: 1 }]], getConnection: async () => conexion };
    const datos = {
        id_distribuidor: 'Proveedor', telefono_distribuidor: '9999-9999', correo_distribuidor: 'p@example.com',
        fecha_compra: '2026-01-01', total: '99999', metodo_pago: 'Efectivo', estado: 'Cancelado',
        lotes: [
            { id_medicamento: '1', numero_lote: 'A', cantidad: '3', fecha_vencimiento: '2099-01-01', precio: '0.10' },
            { id_medicamento: '1', numero_lote: 'B', cantidad: '2', fecha_vencimiento: '2099-01-01', precio: '12.35' },
        ],
    };
    return { db, datos, consultas, pasos };
}

test('Guarda varios lotes, calcula el total en centavos y actualiza el inventario', async () => {
    const e = escenario();
    await servicio.guardar(e.db, { id_usuario: 1 }, e.datos);
    assert.equal(e.consultas.find(c => c.sql.startsWith('INSERT INTO compras')).args[4], '25.00');
    const lotes = e.consultas.filter(c => c.sql.startsWith('INSERT INTO lote'));
    assert.equal(lotes.length, 2);
    assert.deepEqual(lotes[0].args, [20, 1, 'A', 3, 3, '2099-01-01', '0.30']);
    assert.equal(e.consultas.filter(c => c.sql.startsWith('UPDATE medicamentos')).length, 2);
    assert.deepEqual(e.pasos, ['inicio', 'commit', 'release']);
});

test('Un lote duplicado revierte la compra completa', async () => {
    const e = escenario(true);
    await assert.rejects(servicio.guardar(e.db, { id_usuario: 1 }, e.datos), /ya está registrado/);
    assert.deepEqual(e.pasos, ['inicio', 'rollback', 'release']);
});

test('Rechaza compras sin lotes y valores inválidos antes de guardar', async () => {
    for (const cambio of [
        { cantidad: '1.5' }, { cantidad: '0' }, { precio: '-1' }, { precio: '0.001' },
        { fecha_vencimiento: '2099-02-30' }, { fecha_vencimiento: '2020-01-01' },
        { id_medicamento: '' }, { numero_lote: '' }, { cantidad: '2147483647', precio: '99999999.99' },
    ]) {
        const e = escenario();
        e.datos.lotes[0] = { ...e.datos.lotes[0], ...cambio };
        await assert.rejects(servicio.guardar(e.db, { id_usuario: 1 }, e.datos));
        assert.deepEqual(e.pasos, []);
    }
    const e = escenario();
    e.datos.lotes = [];
    await assert.rejects(servicio.guardar(e.db, { id_usuario: 1 }, e.datos), /al menos un lote/);
});

test('Rechaza números repetidos dentro de la compra', async () => {
    const e = escenario();
    e.datos.lotes[1].numero_lote = ' a ';
    await assert.rejects(servicio.guardar(e.db, { id_usuario: 1 }, e.datos), /repetidos/);
});

test('Rechaza una compra sin sesión', async () => {
    const e = escenario();
    await assert.rejects(servicio.guardar(e.db, null, e.datos), /sesión/);
});

test('Caja con blísteres conserva costo por caja y convierte existencias a unidades', async () => {
    const e = escenario();
    e.datos.lotes = [{ ...e.datos.lotes[0], numero_automatico: true, presentacion_ingreso: 'Caja',
        contenido_caja: 'Blister', paquetes_por_caja: '2', unidades_por_blister: '10',
        precio: '100', precio_venta: '150', precio_venta_contenido: '80', precio_venta_unidad: '9',
        fecha_fabricacion: '2025-01-01' }];
    await servicio.guardar(e.db, { id_usuario: 1 }, e.datos);
    const alta = e.consultas.find(c => c.sql.startsWith('INSERT INTO lote'));
    assert.equal(alta.args[3], 60);
    assert.equal(alta.args[6], '300.00');
    const detalle = e.consultas.find(c => c.sql.startsWith('UPDATE lote'));
    assert.equal(detalle.args[0], 'LOT-000025');
    assert.deepEqual(detalle.args.slice(1, 8), ['2025-01-01', 'Caja', 'Blister', 2, 10, 3, '100.00']);
    const presentaciones = e.consultas.filter(c => c.sql.startsWith('INSERT INTO medicamento_presentaciones'));
    assert.deepEqual(presentaciones.map(c => c.args.slice(1)), [['Caja', '150.00', 20], ['Blister', '80.00', 10], ['Unidad', '9.00', 1]]);
});

test('Caja con sobres no requiere unidades por blíster ni precio de unidad', async () => {
    const e = escenario();
    e.datos.lotes = [{ ...e.datos.lotes[0], presentacion_ingreso: 'Caja', contenido_caja: 'Sobre',
        paquetes_por_caja: '12', precio_venta: '50', precio_venta_contenido: '5', fecha_fabricacion: '2025-01-01' }];
    await servicio.guardar(e.db, { id_usuario: 1 }, e.datos);
    assert.equal(e.consultas.find(c => c.sql.startsWith('INSERT INTO lote')).args[3], 36);
    const detalle = e.consultas.find(c => c.sql.startsWith('UPDATE lote'));
    assert.equal(detalle.args[5], null);
    assert.equal(e.consultas.filter(c => c.sql.startsWith('INSERT INTO medicamento_presentaciones')).length, 2);
});

test('Rechaza empaques, precios y fechas inválidos sin iniciar transacción', async () => {
    for (const cambio of [
        { contenido_caja: 'Frasco' }, { paquetes_por_caja: 0 }, { paquetes_por_caja: '1.5' },
        { unidades_por_blister: 0 }, { precio_venta: 0 }, { precio_venta_contenido: '-1' },
        { precio_venta_unidad: '0.001' }, { fecha_fabricacion: '2025-02-30' },
        { fecha_fabricacion: '2027-01-01' }, { fecha_fabricacion: '' }, { presentacion_ingreso: 'Otro' },
        { paquetes_por_caja: 2147483647 },
    ]) {
        const e = escenario();
        e.datos.lotes = [{ ...e.datos.lotes[0], presentacion_ingreso: 'Caja', contenido_caja: 'Blister',
            paquetes_por_caja: 2, unidades_por_blister: 10, precio_venta: 100,
            precio_venta_contenido: 60, precio_venta_unidad: 8, fecha_fabricacion: '2025-01-01', ...cambio }];
        await assert.rejects(servicio.guardar(e.db, { id_usuario: 1 }, e.datos));
        assert.deepEqual(e.pasos, []);
    }
});

test('Registra medicamento sin añadir existencias y genera código', async () => {
    const e = escenario();
    const medicamento = await servicio.registrarMedicamento(e.db, { id_usuario: 1 },
        { nombre: 'Prueba', laboratorio: 'Laboratorio', categoria: '', restriccion: 'Con Receta Medica' });
    assert.equal(medicamento.codigo, 'MED-000010');
    assert.equal(medicamento.stock_total, 0);
    assert.deepEqual(e.pasos, ['inicio', 'commit', 'release']);
});

test('Rechaza registro de medicamento incompleto o sin sesión', async () => {
    const e = escenario();
    await assert.rejects(servicio.registrarMedicamento(e.db, { id_usuario: 1 }, { nombre: 'Prueba' }));
    await assert.rejects(servicio.registrarMedicamento(e.db, null, {}), /sesión/);
    assert.deepEqual(e.pasos, []);
});

test('Solo admite caja, frasco, ampolla y suero como empaques nuevos', async () => {
    for (const forma of ['', 'Unidad', 'Blister', 'Sobre']) {
        const e = escenario();
        e.datos.lotes[0].presentacion_ingreso = forma;
        await assert.rejects(servicio.guardar(e.db, { id_usuario: 1 }, e.datos), /Presentación/);
        assert.deepEqual(e.pasos, []);
    }
    for (const forma of ['Frasco', 'Ampolla', 'Suero']) {
        const e = escenario();
        e.datos.lotes = [{ ...e.datos.lotes[0], presentacion_ingreso: forma, precio_venta: '25', fecha_fabricacion: '2025-01-01' }];
        await servicio.guardar(e.db, { id_usuario: 1 }, e.datos);
        assert.equal(e.consultas.find(c => c.sql.startsWith('INSERT INTO lote')).args[3], 3);
    }
});

test('Permite precio solo por pastilla sin guardarlo como precio de caja', async () => {
    const e = escenario();
    e.datos.lotes = [{ ...e.datos.lotes[0], presentacion_ingreso: 'Caja', contenido_caja: 'Blister',
        paquetes_por_caja: 2, unidades_por_blister: 10, precio_venta_unidad: '5', fecha_fabricacion: '2025-01-01' }];
    await servicio.guardar(e.db, { id_usuario: 1 }, e.datos);
    const detalle = e.consultas.find(c => c.sql.startsWith('UPDATE lote'));
    assert.deepEqual(detalle.args.slice(8, 11), [null, null, '5.00']);
    assert.deepEqual(e.consultas.find(c => c.sql.startsWith('INSERT INTO medicamento_presentaciones')).args, [1, 'Unidad', '5.00', 1]);
});

test('Exige al menos un precio para caja', async () => {
    const e = escenario();
    e.datos.lotes = [{ ...e.datos.lotes[0], presentacion_ingreso: 'Caja', contenido_caja: 'Sobre',
        paquetes_por_caja: 10, fecha_fabricacion: '2025-01-01' }];
    await assert.rejects(servicio.guardar(e.db, { id_usuario: 1 }, e.datos), /al menos un precio/);
});

test('Guarda lote manual y toma laboratorio de la compra en las tres tablas', async () => {
    const e = escenario();
    e.datos.laboratorio = 'Valor alterado';
    e.datos.lotes[0].laboratorio = 'Otro valor alterado';
    await servicio.guardar(e.db, { id_usuario: 1 }, e.datos);
    assert.equal(e.consultas.find(c => c.sql.startsWith('UPDATE compras')).args[1], 'Proveedor');
    assert.equal(e.consultas.find(c => c.sql.startsWith('UPDATE lote')).args[11], 'Proveedor');
    assert.equal(e.consultas.find(c => c.sql.startsWith('UPDATE medicamentos')).args[1], 'Proveedor');
    assert.equal(e.consultas.find(c => c.sql.startsWith('INSERT INTO lote')).args[2], 'A');
});

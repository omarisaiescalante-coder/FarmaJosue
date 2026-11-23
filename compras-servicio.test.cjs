const { test } = require('node:test');
const assert = require('node:assert/strict');
const servicio = require('./compras-servicio');
const { limitesFechasLote } = require('./fechas-lote');
const { hoy, fabricacionMin, vencimientoMin } = limitesFechasLote();

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
        fecha_compra: hoy, total: '99999', metodo_pago: 'Efectivo', estado: 'Cancelado',
        lotes: [
            { id_medicamento: '1', numero_lote: 'A', cantidad: '3', fecha_vencimiento: '2099-01-01', precio: '0.10' },
            { id_medicamento: '1', numero_lote: 'B', cantidad: '2', fecha_vencimiento: '2099-01-01', precio: '12.35' },
        ],
    };
    return { db, datos, consultas, pasos };
}

test('Guarda varios lotes, calcula el total en centavos y actualiza el inventario', async () => {
    const e = escenario();
    const resultado = await servicio.guardar(e.db, { id_usuario: 1 }, e.datos);
    assert.equal(resultado.numero_factura, 'FAC#20');
    assert.equal(e.consultas.find(c => c.sql.startsWith('UPDATE compras')).args[0], 'FAC#20');
    assert.equal(e.consultas.find(c => c.sql.startsWith('INSERT INTO compras')).args[4], '25.00');
    const lotes = e.consultas.filter(c => c.sql.startsWith('INSERT INTO lote'));
    assert.equal(lotes.length, 2);
    assert.deepEqual(lotes[0].args, [20, 1, 'A', 3, 3, '2099-01-01', '0.30']);
    assert.equal(e.consultas.filter(c => c.sql.startsWith('UPDATE medicamentos')).length, 2);
    assert.deepEqual(e.pasos, ['inicio', 'commit', 'release']);
});

test('Acumula dos entradas del mismo medicamento con factores de empaque distintos', async () => {
    const e = escenario();
    const conexion = await e.db.getConnection();
    const ejecutar = conexion.execute;
    let stock = 5;
    conexion.execute = async (sql, args) => {
        if (sql.startsWith('SELECT stock_total')) return [[{ stock_total: stock, estado: 'Disponible' }]];
        const resultado = await ejecutar(sql, args);
        if (sql.startsWith('UPDATE medicamentos SET stock_total = COALESCE')) stock += args[0];
        return resultado;
    };
    const guardarEntrada = (numero, cantidad, factores) => servicio.guardar(e.db, { id_usuario: 1 }, {
        ...e.datos,
        lotes: [{ ...e.datos.lotes[0], numero_lote: numero, cantidad, tipo_medicamento: 'Pastilla',
            presentacion_ingreso: 'Paquete', fecha_fabricacion: hoy,
            formas_venta: ['Caja', 'Blister', 'Unidad'].map((nombre, i) => ({ nombre, precio: 10, cantidad: factores[i] })) }],
    });
    await guardarEntrada('A', 3, [10, 5, 4]);
    assert.equal(stock, 605);
    await guardarEntrada('B', 2, [3, 2, 5]);
    assert.equal(stock, 665);
    const lotes = e.consultas.filter(c => c.sql.startsWith('INSERT INTO lote'));
    assert.deepEqual(lotes.map(lote => lote.args.slice(3, 5)), [[600, 600], [60, 60]]);
    const contenidos = e.consultas.filter(c => c.sql.startsWith('UPDATE lote SET cajas_por_paquete'));
    assert.deepEqual(contenidos.map(lote => lote.args.slice(0, 3)), [[10, 50, 200], [3, 6, 30]]);
});

test('Aplica los límites de fabricación y vencimiento al guardar un lote', async () => {
    const e = escenario();
    const lote = { ...e.datos.lotes[0], fecha_fabricacion: fabricacionMin, fecha_vencimiento: vencimientoMin };
    const guardar = cambios => servicio.guardar(e.db, { id_usuario: 1 }, { ...e.datos, lotes: [{ ...lote, ...cambios }] });
    const diaAnterior = fecha => new Date(Date.parse(fecha) - 86400000).toISOString().slice(0, 10);
    await assert.rejects(guardar({ fecha_fabricacion: diaAnterior(fabricacionMin) }), /dos meses/);
    await assert.rejects(guardar({ fecha_fabricacion: vencimientoMin }), /fabricaci/);
    await assert.rejects(guardar({ fecha_vencimiento: diaAnterior(vencimientoMin) }), /al menos un a/);
    assert.deepEqual(e.pasos, []);
    await guardar({});
    assert.deepEqual(e.pasos, ['inicio', 'commit', 'release']);
    assert.deepEqual(limitesFechasLote(new Date(2024, 1, 29)), {
        hoy: '2024-02-29', fabricacionMin: '2023-12-29', vencimientoMin: '2025-02-28',
    });
});

test('Consulta el siguiente correlativo real sin modificar compras existentes', async () => {
    const consultas = [];
    const db = {
        execute: async () => [[{ id_usuario: 1 }]],
        query: async sql => {
            consultas.push(sql);
            if (sql.includes('information_schema.TABLES')) return [[{ siguiente: 230 }]];
            return [[]];
        },
    };
    const datos = await servicio.cargar(db, { id_usuario: 1 });
    assert.equal(datos.siguienteFactura, 'FAC#230');
    assert(consultas.every(sql => sql.trim().startsWith('SELECT')));
});

test('Un lote duplicado revierte la compra completa', async () => {
    const e = escenario(true);
    await assert.rejects(servicio.guardar(e.db, { id_usuario: 1 }, e.datos), /ya está registrado/);
    assert.deepEqual(e.pasos, ['inicio', 'rollback', 'release']);
});

test('Sueros por caja convierte cajas a sueros y conserva costo y precios de venta', async () => {
    const e = escenario();
    e.datos.lotes = [{ ...e.datos.lotes[0], presentacion_ingreso: 'Sueros por caja',
        cantidad: '2', paquetes_por_caja: '12', precio: '100', precio_venta: '150',
        precio_venta_contenido: '15', fecha_fabricacion: hoy }];
    await servicio.guardar(e.db, { id_usuario: 1 }, e.datos);
    const alta = e.consultas.find(c => c.sql.startsWith('INSERT INTO lote'));
    assert.equal(alta.args[3], 24);
    assert.equal(alta.args[6], '200.00');
    const precios = e.consultas.filter(c => c.sql.startsWith('INSERT INTO medicamento_presentaciones'));
    assert.deepEqual(precios.map(c => c.args.slice(1)), [['Sueros por caja', '150.00', 12], ['Suero', '15.00', 1]]);
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
        fecha_fabricacion: hoy }];
    await servicio.guardar(e.db, { id_usuario: 1 }, e.datos);
    const alta = e.consultas.find(c => c.sql.startsWith('INSERT INTO lote'));
    assert.equal(alta.args[3], 60);
    assert.equal(alta.args[6], '300.00');
    const detalle = e.consultas.find(c => c.sql.startsWith('UPDATE lote'));
    assert.equal(detalle.args[0], 'LOT-000025');
    assert.deepEqual(detalle.args.slice(1, 8), [hoy, 'Caja', 'Blister', 2, 10, 3, '100.00']);
    const presentaciones = e.consultas.filter(c => c.sql.startsWith('INSERT INTO medicamento_presentaciones'));
    assert.deepEqual(presentaciones.map(c => c.args.slice(1)), [['Caja', '150.00', 20], ['Blister', '80.00', 10], ['Unidad', '9.00', 1]]);
});

test('Caja con sobres no requiere unidades por blíster ni precio de unidad', async () => {
    const e = escenario();
    e.datos.lotes = [{ ...e.datos.lotes[0], presentacion_ingreso: 'Caja', contenido_caja: 'Sobre',
        paquetes_por_caja: '12', precio_venta: '50', precio_venta_contenido: '5', fecha_fabricacion: hoy }];
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
        { fecha_fabricacion: vencimientoMin }, { fecha_fabricacion: '' }, { presentacion_ingreso: 'Otro' },
        { paquetes_por_caja: 2147483647 },
    ]) {
        const e = escenario();
        e.datos.lotes = [{ ...e.datos.lotes[0], presentacion_ingreso: 'Caja', contenido_caja: 'Blister',
            paquetes_por_caja: 2, unidades_por_blister: 10, precio_venta: 100,
            precio_venta_contenido: 60, precio_venta_unidad: 8, fecha_fabricacion: hoy, ...cambio }];
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

test('Guarda el código ingresado sin reemplazarlo por uno automático', async () => {
    const e = escenario();
    const datos = { codigo: '  000123  ', nombre: 'Prueba', laboratorio: 'Laboratorio', restriccion: 'Con Receta Medica' };
    await assert.rejects(servicio.registrarMedicamento(e.db, { id_usuario: 1 }, { ...datos, codigo: '1'.repeat(21) }), /20 caracteres/);
    assert.deepEqual(e.consultas, []);
    const medicamento = await servicio.registrarMedicamento(e.db, { id_usuario: 1 }, datos);
    assert.equal(medicamento.codigo, '000123');
    assert.equal(e.consultas.length, 1);
    assert.equal(e.consultas[0].args[0], '000123');
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
        e.datos.lotes = [{ ...e.datos.lotes[0], presentacion_ingreso: forma, precio_venta: '25', fecha_fabricacion: hoy }];
        await servicio.guardar(e.db, { id_usuario: 1 }, e.datos);
        assert.equal(e.consultas.find(c => c.sql.startsWith('INSERT INTO lote')).args[3], 3);
    }
});

test('Permite precio solo por pastilla sin guardarlo como precio de caja', async () => {
    const e = escenario();
    e.datos.lotes = [{ ...e.datos.lotes[0], presentacion_ingreso: 'Caja', contenido_caja: 'Blister',
        paquetes_por_caja: 2, unidades_por_blister: 10, precio_venta_unidad: '5', fecha_fabricacion: hoy }];
    await servicio.guardar(e.db, { id_usuario: 1 }, e.datos);
    const detalle = e.consultas.find(c => c.sql.startsWith('UPDATE lote'));
    assert.deepEqual(detalle.args.slice(8, 11), [null, null, '5.00']);
    assert.deepEqual(e.consultas.find(c => c.sql.startsWith('INSERT INTO medicamento_presentaciones')).args, [1, 'Unidad', '5.00', 1]);
});

test('Exige al menos un precio para caja', async () => {
    const e = escenario();
    e.datos.lotes = [{ ...e.datos.lotes[0], presentacion_ingreso: 'Caja', contenido_caja: 'Sobre',
        paquetes_por_caja: 10, fecha_fabricacion: hoy }];
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

for (const tipo of ['Pastilla', 'Frasco', 'Ampolla', 'Suero']) {
    for (const modalidad of ['Caja', 'Caja y unidad']) {
        test(tipo + ' / ' + modalidad + ': guarda precios, equivalencias y lote', async () => {
            const e = escenario();
            e.datos.lotes = [{ id_medicamento: 1, numero_lote: 'NUEVO', cantidad: 2,
                tipo_medicamento: tipo, modalidad_venta: modalidad, presentacion_ingreso: 'Caja',
                paquetes_por_caja: 10, unidades_por_blister: 10, precio: 100,
                precio_compra_contenido: 10, precio_compra_unidad: 1,
                precio_venta: 200, precio_venta_contenido: 20, precio_venta_unidad: 2,
                fecha_fabricacion: hoy, fecha_vencimiento: '2099-01-01' }];
            await servicio.guardar(e.db, { id_usuario: 1 }, e.datos);
            const factor = tipo === 'Pastilla' ? (modalidad === 'Caja' ? 1 : 100) : 10;
            assert.equal(e.consultas.find(c => c.sql.startsWith('INSERT INTO lote')).args[3], factor * 2);
            const pres = e.consultas.filter(c => c.sql.startsWith('INSERT INTO medicamento_presentaciones'));
            assert.deepEqual(pres.map(c => c.args[1]), modalidad === 'Caja' ? ['Caja'] : tipo === 'Pastilla' ? ['Caja', 'Blister', 'Pastilla'] : ['Caja', 'Unidad']);
            assert(pres.every(c => c.args[4] === 25));
            const config = e.consultas.find(c => c.sql.startsWith('UPDATE lote SET tipo_medicamento'));
            assert.deepEqual(config.args, [tipo, modalidad, modalidad === 'Caja y unidad' && tipo === 'Pastilla' ? '10.00' : null, modalidad === 'Caja y unidad' ? '1.00' : null, 25]);
        });
    }
}
test('No admite precios incompletos en presentaciones habilitadas', () => {
    const { validarEmpaque } = require('./empaques');
    assert.throws(() => validarEmpaque({tipo_medicamento:'Frasco', modalidad_venta:'Caja y unidad', paquetes_por_caja:10, precio_venta:100}));
});

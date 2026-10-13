const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ventas = require('./ventas-servicios');
const medicamentos = require('./medicamentos-servicio');
const usuarios = require('./usuarios');
const { autorizar } = require('./sesion-servicio');

test('Los permisos se verifican con el rol activo de la base y no con el declarado en la sesión', async () => {
    const matriz = { Administrador: ['medicamentos', 'ventas', 'compras'], Cajero: ['medicamentos', 'ventas'], Dispensador: ['medicamentos', 'compras'] };
    for (const [rol, modulos] of Object.entries(matriz)) {
        const db = { execute: async (_sql, args) => [args.slice(1).includes(rol) ? [{ id_usuario: 1 }] : []] };
        for (const modulo of ['medicamentos', 'ventas', 'compras']) {
            const resultado = autorizar(db, { id_usuario: 1, rol: 'Administrador' }, modulo);
            if (modulos.includes(modulo)) await resultado;
            else await assert.rejects(resultado);
        }
    }
});

test('Usuarios exige identidad, teléfono y contraseña con los requisitos antes de escribir', async () => {
    const consultas = [];
    const db = { execute: async (sql) => { consultas.push(sql); return [[{ id_usuario: 1 }]]; } };
    const datos = { nombre: 'Ana', apellido: 'Pérez', identidad: '0801-2000-12345', telefono: '9999-1234', correo: '', direccion: '', nombre_usuario: 'ana', rol: 'Cajero', estado: 'Activo', contrasena: 'Clave123!' };
    for (const cambio of [
        { identidad: '' }, { identidad: '0801200012345' }, { identidad: '0801-2000-123456' },
        { telefono: '' }, { telefono: '99991234' }, { telefono: '9999-12345' },
        { contrasena: 'Clave12!' }, { contrasena: 'clave123!' }, { contrasena: 'Claveabc!' },
        { contrasena: 'Clave1234' }, { contrasena: 'Clave123 ' },
    ]) await assert.rejects(usuarios.guardar(db, { id_usuario: 1 }, { ...datos, ...cambio }));
    assert(consultas.every(sql => sql.startsWith('SELECT')));
    await usuarios.guardar(db, { id_usuario: 1 }, datos);
    assert(consultas.at(-1).startsWith('INSERT'));
    await usuarios.guardar(db, { id_usuario: 1 }, { ...datos, id_usuario: 2, contrasena: '' });
    assert(consultas.at(-1).startsWith('UPDATE'));
    assert(!consultas.at(-1).includes('contrasena'));
});

test('Cada operación del puente tiene un controlador Electron registrado', () => {
    const canales = new Map();
    const db = {};
    const electron = { ipcMain: { handle: (canal, fn) => canales.set(canal, fn) }, app: { whenReady: () => ({ then() {} }), on() {} } };
    vm.runInNewContext(fs.readFileSync('main.js', 'utf8'), {
        require: nombre => nombre === 'electron' ? electron : nombre === './database' ? db : require(nombre),
        console, __dirname, process,
    });
    const puente = fs.readFileSync('puente.js', 'utf8');
    for (const [, canal] of puente.matchAll(/ipcRenderer\.invoke\('([^']+)'/g)) assert(canales.has(canal), canal);
});
test('Todos los scripts locales referenciados por HTML existen y compilan', () => {
    for (const archivo of fs.readdirSync('.').filter(f => f.endsWith('.html'))) {
        for (const [, src] of fs.readFileSync(archivo, 'utf8').matchAll(/<script[^>]+src="([^"]+)"/g)) {
            if (/^https?:/.test(src)) continue;
            assert(fs.existsSync(src), `${archivo}: ${src}`);
            new vm.Script(fs.readFileSync(src, 'utf8'), { filename: src });
        }
    }
});
test('Ventas y Medicamentos rechazan sesiones inexistentes o desactivadas', async () => {
    const db = { execute: async () => [[]] };
    for (const servicio of [ventas, medicamentos]) {
        for (const operacion of Object.values(servicio)) {
            await assert.rejects(operacion(db, null), /sesión/);
            await assert.rejects(operacion(db, { id_usuario: 1 }), /activa/);
        }
    }
});
test('Editar medicamento valida los campos antes de escribir', async () => {
    let consultas = 0;
    const db = { execute: async () => { consultas++; return [[{ id_usuario: 1 }]]; } };
    for (const datos of [null, { id: 0 }, { id: 1, nombre: '' }, { id: 1, nombre: 'Prueba', restriccion: 'Otra' }]) {
        await assert.rejects(medicamentos.actualizar(db, { id_usuario: 1 }, datos));
    }
    assert.equal(consultas, 4);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ventas = require('./ventas-servicios');
const medicamentos = require('./medicamentos-servicio');

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

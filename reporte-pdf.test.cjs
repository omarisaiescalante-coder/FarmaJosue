const { test } = require('node:test');
const assert = require('node:assert/strict');
const { guardarReportePDF } = require('./reporte-pdf');
const datos = {tipo: 'compras', desde: '2026-11-01', hasta: '2026-11-04'};
function dependencias() {
    const llamadas = [];
    const pdf = Buffer.from('%PDF-prueba');
    return { llamadas, sender: { executeJavaScript: async script => {llamadas.push(script); return true;}, printToPDF: async () => pdf, isDestroyed: () => false },
        ventana: {}, directorioDocumentos: require('node:os').tmpdir(),
        dialog: {showSaveDialog: async (_ventana, opciones) => {llamadas.push(opciones); return {canceled: false, filePath: require('node:path').join(require('node:os').tmpdir(), 'reporte-prueba')};}},
        writeFile: async (archivo, buffer) => {llamadas.push({archivo, buffer});} };
}
test('Guarda el PDF en el destino seleccionado y restaura la pantalla', async () => {
    const deps = dependencias();
    const resultado = await guardarReportePDF(deps, datos);
    assert.equal(resultado.cancelado, false);
    assert(resultado.archivo.endsWith('reporte-prueba.pdf'));
    const escritura = deps.llamadas.find(l => l.archivo);
    assert.equal(escritura.buffer.toString(), '%PDF-prueba');
    assert(deps.llamadas.some(l => l.defaultPath?.endsWith('Reporte-compras-2026-11-01-2026-11-04.pdf')));
    assert.match(deps.llamadas.at(-1), /classList.remove/);
});
test('Cancelar no escribe archivos ni imprime', async () => {
    const deps = dependencias();
    deps.dialog.showSaveDialog = async () => ({canceled:true});
    deps.sender.printToPDF = async () => {throw new Error('No debe imprimir');};
    assert.deepEqual(await guardarReportePDF(deps, datos), {cancelado:true});
    assert(!deps.llamadas.some(l => l.archivo));
});
test('Un error de escritura restaura el formato de pantalla y se informa al cliente', async () => {
    const deps = dependencias();
    deps.writeFile = async () => {throw new Error('Sin permiso');};
    await assert.rejects(guardarReportePDF(deps, datos), /Sin permiso/);
    assert.match(deps.llamadas.at(-1), /classList.remove/);
});

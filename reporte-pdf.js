async function guardarReportePDF({ sender, ventana, dialog, directorioDocumentos, writeFile }, datos) {
    if (!['compras', 'lotes', 'ventas'].includes(datos?.tipo) || !/^\d{4}-\d{2}-\d{2}$/.test(datos?.desde || '') || !/^\d{4}-\d{2}-\d{2}$/.test(datos?.hasta || ''))
        throw new Error('Generá un reporte antes de guardarlo.');
    const esVentas = datos.tipo === 'ventas';
    const claseImpresion = esVentas ? 'imprimiendo-reporte-ventas' : 'imprimiendo-reporte-compras';
    const preparado = esVentas
        ? `Boolean(document.querySelector('#modalReporte[open] #reporteResultados:not([hidden])[data-desde="${datos.desde}"][data-hasta="${datos.hasta}"]'))`
        : "Boolean(document.querySelector('.reporte-compras-modal[open] #reporteComprasDocumento')?.children.length)";
    if (!await sender.executeJavaScript(preparado)) throw new Error('Abrí y generá el reporte antes de guardarlo.');
    const nombre = `Reporte-${datos.tipo}-${datos.desde}-${datos.hasta}.pdf`;
    const { canceled, filePath } = await dialog.showSaveDialog(ventana, {
        title: 'Guardar reporte en PDF', defaultPath: require('node:path').join(directorioDocumentos, nombre),
        filters: [{ name: 'Documento PDF', extensions: ['pdf'] }], properties: ['showOverwriteConfirmation'],
    });
    if (canceled || !filePath) return { cancelado: true };
    if (!await sender.executeJavaScript(preparado)) throw new Error('El reporte se cerró. Generá el reporte e intentá guardarlo nuevamente.');
    try {
        await sender.executeJavaScript(`document.body.classList.add('${claseImpresion}'); void 0;`);
        const pdf = await sender.printToPDF({ printBackground: true, preferCSSPageSize: true });
        const destino = /\.pdf$/i.test(filePath) ? filePath : filePath + '.pdf';
        await writeFile(destino, pdf);
        return { cancelado: false, archivo: destino };
    } finally {
        if (!sender.isDestroyed()) await sender.executeJavaScript(`document.body.classList.remove('${claseImpresion}'); void 0;`);
    }
}
module.exports = { guardarReportePDF };

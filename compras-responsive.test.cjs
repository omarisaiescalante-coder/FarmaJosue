const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    const ventana = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
    try {
        const html = fs.readFileSync('compras.html', 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link\b[^>]*>/g, '');
        await ventana.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        await ventana.webContents.insertCSS(fs.readFileSync('styles.css', 'utf8'));
        await ventana.webContents.executeJavaScript(`
            document.getElementById('recordForm').innerHTML = '<div style="height:2000px">Lotes de prueba</div>';
            document.getElementById('comprasEncabezado').innerHTML = '<div style="height:600px">Información completa</div>';
        `);
        let anchoAnterior = Infinity;
        for (const ancho of [1920, 1280, 1000, 720]) {
            ventana.setContentSize(ancho, 560);
            await new Promise(resolve => setTimeout(resolve, 60));
            const resultado = await ventana.webContents.executeJavaScript(`(() => {
                const info = document.getElementById('comprasEncabezado').getBoundingClientRect();
                const pagos = document.querySelector('.compras-pagos').getBoundingClientRect();
                const centro = document.querySelector('.compras-formulario').getBoundingClientRect();
                const form = document.getElementById('recordForm'); const area = document.querySelector('.compras-area-trabajo');
                form.scrollTop = 200;
                const izquierda = document.getElementById('comprasEncabezado');
                const derecha = document.querySelector('.compras-pagos');
                izquierda.scrollTop = 100; derecha.scrollTop = 100;
                return { izquierda: info.width, derecha: pagos.width, centro: centro.width, alturaIgual: info.height === pagos.height,
                    fila: info.top === pagos.top && info.top === centro.top, scrollInterno: form.scrollTop === 200,
                    sinScrollLateral: izquierda.scrollTop === 0 && derecha.scrollTop === 0,
                    informacionCompleta: izquierda.firstElementChild.getBoundingClientRect().bottom <= info.bottom,
                    necesitaScroll: area.scrollWidth > area.clientWidth, alto: centro.height };
            })()`);
            if (resultado.izquierda !== 260 || resultado.derecha !== 260 || !resultado.alturaIgual || !resultado.fila) throw new Error('Los paneles laterales se deforman: ' + JSON.stringify(resultado));
            if (resultado.centro < 500 || !resultado.scrollInterno || !resultado.sinScrollLateral || !resultado.informacionCompleta) throw new Error('Anchos o desplazamiento incorrectos: ' + JSON.stringify(resultado));
            if (ancho >= 1280 && (resultado.necesitaScroll || resultado.centro <= 500)) throw new Error('El formulario no aprovecha el ancho de la pantalla: ' + JSON.stringify(resultado));
            if (resultado.centro > anchoAnterior) throw new Error('El formulario no se adapta al reducir la ventana');
            if (ancho === 720 && !resultado.necesitaScroll) throw new Error('Falta desplazamiento horizontal en ventana pequeña');
            anchoAnterior = resultado.centro;
        }
        console.log('Compras responsive verificado: laterales sin scroll, centro de 500 px con scroll vertical y barra horizontal general en ventanas pequeñas.');
        app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
});

const { spawnSync } = require('node:child_process');
const env = { ...process.env };
// Algunos terminales basados en Electron heredan esta variable y fuerzan modo Node.
delete env.ELECTRON_RUN_AS_NODE;
for (const archivo of ['compras-ui.test.cjs', 'modulos-ui.cjs']) {
    const resultado = spawnSync(require('electron'), [archivo], { env, stdio: 'inherit', windowsHide: true });
    if (resultado.error) console.error(resultado.error);
    if (resultado.status !== 0) process.exit(resultado.status || 1);
}

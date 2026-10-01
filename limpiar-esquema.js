// Compatibilidad: actualizar conserva las ventas y columnas hist?ricas.
const db = require('./database');
const { actualizar } = require('./actualizar-esquema');
actualizar(db).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.end());

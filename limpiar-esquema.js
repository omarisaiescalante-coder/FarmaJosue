// Ejecutar con la aplicación cerrada: node limpiar-esquema.js
// Respalda esquema y datos antes de retirar campos heredados. Admite reejecución.
const fs = require('node:fs');
const path = require('node:path');
const db = require('./database');

async function limpiar() {
    const conexion = await db.getConnection();
    try {
        const [tablas] = await conexion.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
        const nombres = tablas.map(fila => Object.values(fila)[0]);
        const respaldo = ['-- Respaldo previo a la limpieza. Restaurar en una base vacía seleccionada con USE.', 'SET FOREIGN_KEY_CHECKS = 0;'];
        await conexion.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
        for (const nombre of nombres) {
            const tabla = db.escapeId(nombre);
            const [estructura] = await conexion.query(`SHOW CREATE TABLE ${tabla}`);
            respaldo.push(estructura[0]['Create Table'] + ';');
            const [filas] = await conexion.query({ sql: `SELECT * FROM ${tabla}`, dateStrings: true });
            for (const fila of filas) respaldo.push(db.format(`INSERT INTO ${tabla} SET ?;`, [fila]));
        }
        await conexion.commit();
        respaldo.push('SET FOREIGN_KEY_CHECKS = 1;');
        const carpeta = path.join(__dirname, 'respaldos');
        fs.mkdirSync(carpeta, { recursive: true });
        const archivo = path.join(carpeta, `antes-limpieza-${Date.now()}.sql`);
        fs.writeFileSync(archivo, respaldo.join('\n\n'), { encoding: 'utf8', flag: 'wx' });
        console.log(`Respaldo guardado: ${archivo}`);

        // Retirar primero las tablas hijas; se mantienen las verificaciones de claves foráneas.
        for (const tabla of ['detalle_venta_lotes', 'detalles_venta', 'ventas']) {
            if (nombres.some(n => n.toLowerCase() === tabla)) await conexion.query(`DROP TABLE ${db.escapeId(tabla)}`);
        }
        const retirar = {
            medicamentos: ['descripcion', 'stock_minimo', 'presentacion', 'precio_compra', 'precio_venta', 'forma_venta'],
            medicamento_presentaciones: ['estado'],
            compras: ['id_medicamento'],
            lote: ['precio_compra'],
            distribuidores: ['direccion'],
        };
        for (const [tabla, columnas] of Object.entries(retirar)) {
            for (const columna of columnas) {
                const [existe] = await conexion.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = ? AND COLUMN_NAME = ?`, [tabla, columna]);
                if (!existe.length) continue;
                const [claves] = await conexion.execute(`SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                    WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = ? AND COLUMN_NAME = ?
                    AND REFERENCED_TABLE_NAME IS NOT NULL`, [tabla, columna]);
                for (const clave of claves) await conexion.query(`ALTER TABLE ${db.escapeId(tabla)} DROP FOREIGN KEY ${db.escapeId(clave.CONSTRAINT_NAME)}`);
                await conexion.query(`ALTER TABLE ${db.escapeId(tabla)} DROP COLUMN ${db.escapeId(columna)}`);
            }
        }
        await conexion.query("ALTER TABLE medicamentos ALTER COLUMN estado SET DEFAULT 'Agotado'");
        await conexion.query('ALTER TABLE compras MODIFY COLUMN laboratorio VARCHAR(150) NULL');
        console.log('Esquema limpio: se conservaron usuarios, medicamentos, presentaciones, compras, distribuidores y lotes.');
    } finally { conexion.release(); }
}
limpiar().catch(error => { console.error('Limpieza no completada:', error.code || error.message); process.exitCode = 1; })
    .finally(() => db.end());

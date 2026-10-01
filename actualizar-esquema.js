const fs = require('node:fs');
const path = require('node:path');
const { migrar } = require('./migrar-empaques');

async function respaldar(db) {
    const conn = await db.getConnection();
    try {
        await conn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
        const [tablas] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
        const sql = ['-- Restaurar en una base vacía seleccionada con USE.', 'SET FOREIGN_KEY_CHECKS=0;'];
        for (const fila of tablas) {
            const tabla = db.escapeId(Object.values(fila)[0]);
            const [estructura] = await conn.query(`SHOW CREATE TABLE ${tabla}`);
            sql.push(estructura[0]['Create Table'] + ';');
            const [filas] = await conn.query({ sql: `SELECT * FROM ${tabla}`, dateStrings: true });
            for (const registro of filas) sql.push(db.format(`INSERT INTO ${tabla} SET ?;`, [registro]));
        }
        await conn.commit();
        sql.push('SET FOREIGN_KEY_CHECKS=1;');
        const carpeta = path.join(__dirname, 'respaldos');
        fs.mkdirSync(carpeta, { recursive: true });
        const archivo = path.join(carpeta, `antes-actualizacion-${Date.now()}.sql`);
        fs.writeFileSync(archivo, sql.join('\n\n'), { flag: 'wx' });
        console.log('Respaldo:', archivo);
    } catch (error) { await conn.rollback(); throw error; }
    finally { conn.release(); }
}

async function actualizar(db, { respaldo = true } = {}) {
    if (respaldo) await respaldar(db);
    await migrar(db);
    // El alta actual registra precios y empaque en lotes/presentaciones.
    // Las columnas históricas se conservan, pero no deben bloquear nuevas altas.
    const [heredadas] = await db.query(`SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'medicamentos'
        AND COLUMN_NAME IN ('precio_compra', 'precio_venta', 'forma_venta') AND IS_NULLABLE = 'NO'`);
    for (const columna of heredadas) {
        await db.query(`ALTER TABLE medicamentos MODIFY COLUMN ${db.escapeId(columna.COLUMN_NAME)} ${columna.COLUMN_TYPE} NULL DEFAULT NULL`);
    }
    const sql = fs.readFileSync(path.join(__dirname, 'JosueFarma.sql'), 'utf8');
    // Extraer únicamente las tablas necesarias; nunca ejecutar el DROP ni los INSERT del instalador.
    const tablasVentas = ['clientes', 'ventas', 'detalles_venta', 'detalle_venta_lotes'];
    const definiciones = new Map([...sql.matchAll(/CREATE TABLE (\w+) \([\s\S]*?\n\) ENGINE=InnoDB;/g)]
        .map(coincidencia => [coincidencia[1], coincidencia[0]]));
    for (const tabla of tablasVentas) {
        if (!definiciones.has(tabla)) throw new Error(`Falta la definición de ${tabla} en JosueFarma.sql.`);
    }
    for (const tabla of tablasVentas) {
        await db.query(definiciones.get(tabla).replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS '));
    }
    for (const [nombre, tipo] of [['id_cliente', 'INT NULL'], ['requiere_receta', 'BOOLEAN NOT NULL DEFAULT 0']]) {
        const [existe] = await db.execute('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = ? AND COLUMN_NAME = ?', ['ventas', nombre]);
        if (!existe.length) await db.query(`ALTER TABLE ventas ADD COLUMN ${nombre} ${tipo}`);
    }
    const [claves] = await db.query("SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'ventas' AND COLUMN_NAME = 'id_cliente' AND REFERENCED_TABLE_NAME IS NOT NULL");
    if (!claves.length) await db.query('ALTER TABLE ventas ADD FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)');
    console.log('Esquema actualizado sin eliminar registros.');
}
module.exports = { actualizar };
if (require.main === module) {
    const db = require('./database');
    actualizar(db).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.end());
}

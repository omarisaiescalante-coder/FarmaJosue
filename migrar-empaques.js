// Ejecutar: node migrar-empaques.js. Conserva los registros existentes y admite reejecución.

async function migrar(db) {
    const columnas = {
        laboratorio: 'VARCHAR(150) NULL',
        presentacion_ingreso: "VARCHAR(20) NOT NULL DEFAULT 'Unidad'",
        contenido_caja: 'VARCHAR(20) NULL', paquetes_por_caja: 'INT NULL',
        unidades_por_blister: 'INT NULL', cantidad_empaques: 'INT NULL',
        precio_empaque: 'DECIMAL(10,2) NULL', precio_venta: 'DECIMAL(10,2) NULL',
        precio_venta_contenido: 'DECIMAL(10,2) NULL', precio_venta_unidad: 'DECIMAL(10,2) NULL',
    };
    for (const [nombre, definicion] of Object.entries(columnas)) {
        const [filas] = await db.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'lote' AND COLUMN_NAME = ?`, [nombre]);
        if (!filas.length) await db.query(`ALTER TABLE lote ADD COLUMN ${nombre} ${definicion}`);
    }
    const [laboratorioCompra] = await db.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'compras' AND COLUMN_NAME = 'laboratorio'`);
    if (!laboratorioCompra.length) await db.query('ALTER TABLE compras ADD COLUMN laboratorio TEXT NULL');
    await db.query(`UPDATE lote l JOIN medicamentos m ON m.id_medicamento = l.id_medicamento
        SET l.laboratorio = m.laboratorio WHERE l.laboratorio IS NULL`);
    await db.query(`UPDATE compras c JOIN distribuidores d ON d.id_distribuidor = c.id_distribuidor
        SET c.laboratorio = d.nombre WHERE c.laboratorio IS NULL`);
    const [precioAnterior] = await db.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'lote' AND COLUMN_NAME = 'precio_compra'`);
    const precio = precioAnterior.length ? 'precio_compra' : 'costo_total / NULLIF(cantidad_inicial, 0)';
    await db.query(`UPDATE lote SET cantidad_empaques = cantidad_inicial, precio_empaque = ${precio}
        WHERE cantidad_empaques IS NULL`);
    console.log('Campos de empaques actualizados; registros existentes conservados.');
}
module.exports = { migrar };
if (require.main === module) {
 const db = require('./database');
 migrar(db).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.end());
}

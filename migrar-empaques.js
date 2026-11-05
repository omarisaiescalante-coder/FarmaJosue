// Ejecutar: node migrar-empaques.js. Conserva los registros existentes y admite reejecución.

async function migrar(db) {
    const columnas = {
        cajas_por_paquete: 'INT NULL', blisteres_por_paquete: 'INT NULL', unidades_por_paquete: 'INT NULL',
        nombre_medicamento: 'VARCHAR(150) NULL', razon_edicion: 'VARCHAR(500) NULL',
        fecha_edicion: 'DATETIME NULL', revision: 'INT NOT NULL DEFAULT 0',
        tipo_medicamento: 'VARCHAR(20) NULL', modalidad_venta: 'VARCHAR(20) NULL',
        precio_compra_contenido: 'DECIMAL(10,2) NULL', precio_compra_unidad: 'DECIMAL(10,2) NULL',
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
    const [colPres] = await db.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicamento_presentaciones' AND COLUMN_NAME = 'id_lote'`);
    if (!colPres.length) await db.query('ALTER TABLE medicamento_presentaciones ADD COLUMN id_lote INT NULL');
    const [estadoPres] = await db.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicamento_presentaciones' AND COLUMN_NAME = 'estado'`);
    if (!estadoPres.length) await db.query("ALTER TABLE medicamento_presentaciones ADD COLUMN estado VARCHAR(10) NOT NULL DEFAULT 'Activa'");
    const [indices] = await db.query('SHOW INDEX FROM medicamento_presentaciones');
    const unicos = [...new Set(indices.filter(i => !Number(i.Non_unique) && i.Key_name !== 'PRIMARY').map(i => i.Key_name))];
    for (const nombre of unicos) {
        const columnas = indices.filter(i => i.Key_name === nombre).sort((a,b) => a.Seq_in_index-b.Seq_in_index).map(i => i.Column_name);
        if (columnas.join(',') === 'id_medicamento,nombre_presentacion') {
            if (!indices.some(i => i.Key_name === 'idx_medicamento')) await db.query('ALTER TABLE medicamento_presentaciones ADD INDEX idx_medicamento (id_medicamento)');
            await db.query('ALTER TABLE medicamento_presentaciones DROP INDEX ' + db.escapeId(nombre));
        }
    }
    if (!indices.some(i => i.Key_name === 'presentacion_lote'))
        await db.query('ALTER TABLE medicamento_presentaciones ADD UNIQUE KEY presentacion_lote (id_medicamento, nombre_presentacion, id_lote)');
    await db.query(`CREATE TABLE IF NOT EXISTS lote_ediciones (
        id_edicion INT AUTO_INCREMENT PRIMARY KEY, id_lote INT NOT NULL, revision INT NOT NULL,
        fecha_edicion DATETIME NOT NULL, razon_edicion VARCHAR(500) NOT NULL,
        UNIQUE KEY lote_revision (id_lote, revision),
        FOREIGN KEY (id_lote) REFERENCES lote(id_lote)
    ) ENGINE=InnoDB`);
    // Conserva la última edición que existía antes de incorporar el historial.
    await db.query(`INSERT IGNORE INTO lote_ediciones (id_lote, revision, fecha_edicion, razon_edicion)
        SELECT id_lote, revision, fecha_edicion, razon_edicion FROM lote
        WHERE fecha_edicion IS NOT NULL AND razon_edicion IS NOT NULL`);
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

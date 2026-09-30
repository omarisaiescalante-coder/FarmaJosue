async function listar(db, sesion) {

    if (!sesion)
        throw new Error("Debe iniciar sesion");


    const [medicamentos] = await db.query(`

        SELECT 
            m.id_medicamento,
            m.nombre,
            m.categoria,
            m.stock_total,
            m.estado,

            GROUP_CONCAT(
                CONCAT(
                    mp.nombre_presentacion,
                    ': L.',
                    mp.precio_venta
                )
                SEPARATOR ', '
            ) AS precios

        FROM medicamentos m

        LEFT JOIN medicamento_presentaciones mp

        ON mp.id_medicamento = m.id_medicamento

        GROUP BY m.id_medicamento

        ORDER BY m.nombre

    `);


    return medicamentos;

}

async function lotes(db, sesion, id) {


    if (!sesion)
        throw new Error("Debe iniciar sesion");


    const [datos] = await db.execute(`

        SELECT

            numero_lote,
            fecha_vencimiento,
            cantidad_disponible,
            precio_venta

        FROM lote

        WHERE id_medicamento = ?

    `, [id]);


    return datos;

}





async function actualizar(db, sesion, datos) {


    if (!sesion)
        throw new Error("Sesion requerida");


    if (!datos.id)
        throw new Error("Medicamento no valido");



    await db.execute(`

        UPDATE medicamentos

        SET

            nombre = ?,
            categoria = ?,
            restriccion = ?

        WHERE id_medicamento = ?

    `, [

        datos.nombre,
        datos.categoria,
        datos.restriccion,
        datos.id

    ]);



    return true;

}



module.exports = {

    listar,
    lotes,
    actualizar

};
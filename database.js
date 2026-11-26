// Carga el controlador MySQL con soporte para promesas y await.
const mysql = require('mysql2/promise');

// Ajustá estos valores si tu servidor MySQL tiene otras credenciales.

module.exports = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
<<<<<<< HEAD
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '123456',
=======
    port: Number(process.env.DB_PORT || 3306), // Cambios de puerto
    user: process.env.DB_USER || 'root',
<<<<<<< HEAD
    password: process.env.DB_PASSWORD ?? 'Vinijr', //Cambios de contraseña
=======
    password: process.env.DB_PASSWORD ?? '1234', //Cambios de contraseña
>>>>>>> 455a8b6ee1bd630af591c0bd53e899d836885664
>>>>>>> d1213f63bd46aceaa20706b72a7efdef2f8fefff
    database: process.env.DB_NAME || 'JosueFarma',
    connectionLimit: 5,
    connectTimeout: 5000,
});


// Carga el controlador MySQL con soporte para promesas y await.
const mysql = require('mysql2/promise');

// Ajustá estos valores si tu servidor MySQL tiene otras credenciales.

module.exports = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '123456',
    database: process.env.DB_NAME || 'JosueFarma',
    connectionLimit: 5,
    connectTimeout: 5000,
});

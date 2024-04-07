const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "alemeno"
});

db.getConnection()
    .then(connection => {
        console.log("Connected to database");
        connection.release();
    })
    .catch(err => {
        console.error("Error in connecting to database:", err);
        throw err;
    });

module.exports = db;

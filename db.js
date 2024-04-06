const mysql = require('mysql')

var db = mysql.createConnection({
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "alemeno"
});

db.connect((err) => {
    if (err) {
        console.log("Error in connecting to database");
        throw err;
    }
    console.log("Connected to database")
})

module.exports = db;
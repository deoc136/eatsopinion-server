//this js is to write the code that will determine how are we connecting to our database.
const Pool = require("pg").Pool;
const pool = new Pool({
    user: "postgres",
    password: "Giveall.2809",
    host: "localhost",
    port: 5432,
    database: "eatsopinion"
});

module.exports = pool;
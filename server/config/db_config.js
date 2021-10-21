const mysql = require("mysql2/promise");
const dotenv = require("dotenv").config({
  path: "./.env",
});

async function database() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
    });
    console.log("Connected to database " + process.env.DB_DATABASE);
    return connection;
  } catch (error) {
    console.log("Error connecting to database" + error);
  }
}

module.exports = database;

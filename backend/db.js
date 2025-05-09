
require('dotenv').config();

const mysql = require('mysql2/promise');

console.log('Creating MySQL connection pool...');
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
});

pool.getConnection()
  .then(connection => {
    console.log('>>> Successfully connected to RDS MySQL database via pool.');
    connection.release();
  })
  .catch(err => {
    console.error('!!! FATAL ERROR: Failed to connect to RDS MySQL database:');
    console.error(`!!! Ensure DB details in .env are correct and RDS is accessible.`);
    console.error(`!!! DB_HOST: ${process.env.DB_HOST}`);
    console.error(`!!! DB_USER: ${process.env.DB_USER}`);
    console.error(`!!! DB_NAME: ${process.env.DB_NAME}`);
    console.error(`!!! Error Code: ${err.code}`);
    console.error(`!!! Error Message: ${err.message}`);
    // process.exit(1);
  });

module.exports = {
  query: (sql, params) => pool.query(sql, params),
  pool: pool
};
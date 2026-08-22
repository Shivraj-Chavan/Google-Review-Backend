const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'review_booster',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  enableKeepAlive: true,    
  connectTimeout: 20000    
});

// Fail fast with a readable message instead of a cryptic stack trace.
async function verifyConnection() {
  try {
    const conn = await pool.getConnection();
    conn.release();
    console.log('[db] MySQL connection pool ready');
  } catch (err) {
    console.error('[db] Could not connect to MySQL:', err.message);
    console.error('[db] Check DB_HOST/DB_USER/DB_PASSWORD/DB_NAME in your .env and that MySQL is running.');
  }
}

module.exports = { pool, verifyConnection };

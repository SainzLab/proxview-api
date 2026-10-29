import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { DB_TZ_OFFSET } from './timezone.js';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0,
  timezone: DB_TZ_OFFSET
});

// Pastikan NOW()/CURRENT_TIMESTAMP/CURRENT_DATE/DATE_FORMAT di MySQL memakai UTC
pool.pool.on('connection', (conn) => {
  conn.query(`SET time_zone = '${DB_TZ_OFFSET}'`, (err) => {
    if (err) console.error('[DB ERROR] Gagal mengatur timezone pada koneksi baru:', err.message);
  });
});

// Helper Transaksi Database untuk menjaga integritas data (ACID)
export const withTransaction = async (callback) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

export default pool;
const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuration de la base de données pour WAMP
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'whatsapp_bot_entreprise',
  port: process.env.DB_PORT || 3306,
  charset: 'utf8mb4',
  timezone: '+00:00',
  connectionLimit: 10,
  queueLimit: 0
};

// Pool de connexions
const pool = mysql.createPool(dbConfig);

// Test de connexion
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Connexion à la base de données réussie');
    connection.release();
    return true;
  } catch (error) {
    console.error('Erreur de connexion à la base de données:', error);
    throw error;
  }
}

// Exécution de requêtes
async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Erreur SQL:', error);
    throw error;
  }
}

// Transaction
async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}



module.exports = {
  pool,
  query,
  transaction,
  testConnection
};

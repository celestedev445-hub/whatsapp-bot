const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'whatsapp_bot_entreprise',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

// Créer le pool de connexions
const pool = mysql.createPool(dbConfig);

// Fonction pour exécuter des requêtes
const query = async (sql, params = []) => {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Erreur de base de données:', error);
    throw error;
  }
};

// Fonction pour tester la connexion
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connexion à la base de données établie');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:', error.message);
    throw error;
  }
};

// Fonction pour fermer le pool
const closePool = async () => {
  try {
    await pool.end();
    console.log('✅ Pool de connexions fermé');
  } catch (error) {
    console.error('❌ Erreur lors de la fermeture du pool:', error);
    throw error;
  }
};

// Gestion des erreurs de connexion
pool.on('connection', (connection) => {
  console.log('🔌 Nouvelle connexion à la base de données établie');
});

pool.on('error', (err) => {
  console.error('❌ Erreur du pool de connexions:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('🔄 Reconnexion automatique en cours...');
  }
});

module.exports = {
  query,
  testConnection,
  closePool,
  pool
};

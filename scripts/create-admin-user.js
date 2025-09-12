const bcrypt = require('bcrypt');
const db = require('../config/database');

async function createAdminUser() {
  try {
    console.log('🔐 Création de l\'utilisateur administrateur...');
    
    // Vérifier si la table users existe
    const tableExists = await db.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'users'
    `);
    
    if (tableExists[0].count === 0) {
      console.log('📋 Création de la table users...');
      await db.query(`
        CREATE TABLE users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          email VARCHAR(100),
          full_name VARCHAR(100),
          role ENUM('admin', 'manager', 'user') DEFAULT 'user',
          is_active BOOLEAN DEFAULT TRUE,
          last_login TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Table users créée');
    }
    
    // Hacher le mot de passe
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('admin123', saltRounds);
    
    // Vérifier si l'utilisateur admin existe déjà
    const existingUser = await db.query('SELECT id FROM users WHERE username = ?', ['admin']);
    
    if (existingUser.length > 0) {
      console.log('👤 Utilisateur admin existe déjà, mise à jour du mot de passe...');
      await db.query(
        'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE username = ?',
        [hashedPassword, 'admin']
      );
    } else {
      console.log('👤 Création de l\'utilisateur admin...');
      await db.query(`
        INSERT INTO users (username, password_hash, email, full_name, role) 
        VALUES (?, ?, ?, ?, ?)
      `, ['admin', hashedPassword, 'admin@promillys.com', 'Administrateur', 'admin']);
    }
    
    console.log('✅ Utilisateur administrateur créé/mis à jour avec succès');
    console.log('📋 Identifiants :');
    console.log('   - Nom d\'utilisateur : admin');
    console.log('   - Mot de passe : admin123');
    console.log('   - Email : admin@promillys.com');
    console.log('   - Rôle : admin');
    
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'utilisateur admin:', error);
    throw error;
  }
}

// Fonction pour créer un nouvel utilisateur
async function createUser(username, password, email, fullName, role = 'user') {
  try {
    console.log(`👤 Création de l'utilisateur ${username}...`);
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    
    if (existingUser.length > 0) {
      throw new Error(`L'utilisateur ${username} existe déjà`);
    }
    
    // Hacher le mot de passe
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Créer l'utilisateur
    await db.query(`
      INSERT INTO users (username, password_hash, email, full_name, role) 
      VALUES (?, ?, ?, ?, ?)
    `, [username, hashedPassword, email, fullName, role]);
    
    console.log(`✅ Utilisateur ${username} créé avec succès`);
    console.log(`📋 Informations :`);
    console.log(`   - Nom d'utilisateur : ${username}`);
    console.log(`   - Email : ${email}`);
    console.log(`   - Nom complet : ${fullName}`);
    console.log(`   - Rôle : ${role}`);
    
  } catch (error) {
    console.error(`❌ Erreur lors de la création de l'utilisateur ${username}:`, error);
    throw error;
  }
}

// Fonction pour lister tous les utilisateurs
async function listUsers() {
  try {
    const users = await db.query(`
      SELECT id, username, email, full_name, role, is_active, 
             last_login, created_at, updated_at
      FROM users 
      ORDER BY created_at DESC
    `);
    
    console.log('👥 Liste des utilisateurs :');
    console.table(users);
    
    return users;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des utilisateurs:', error);
    throw error;
  }
}

// Exécution du script
if (require.main === module) {
  createAdminUser()
    .then(() => {
      console.log('🎉 Script terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = {
  createAdminUser,
  createUser,
  listUsers
};

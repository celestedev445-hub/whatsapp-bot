const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function setupAITables() {
  try {
    console.log('🤖 Configuration des tables IA...');
    
    // Lire le fichier SQL
    const sqlFile = path.join(__dirname, 'create-ai-tables.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // Diviser en requêtes individuelles
    const queries = sqlContent
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0);
    
    // Exécuter chaque requête
    for (const query of queries) {
      if (query.trim()) {
        console.log(`📝 Exécution: ${query.substring(0, 50)}...`);
        await db.query(query);
      }
    }
    
    console.log('✅ Tables IA créées avec succès !');
    
    // Vérifier que les tables existent
    const tables = await db.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME IN ('ai_analysis', 'ai_responses', 'ai_settings')
    `);
    
    console.log('📊 Tables créées:', tables.map(t => t.TABLE_NAME));
    
    // Afficher les paramètres par défaut
    const settings = await db.query('SELECT * FROM ai_settings');
    console.log('⚙️ Paramètres IA configurés:', settings.length);
    
  } catch (error) {
    console.error('❌ Erreur lors de la configuration des tables IA:', error);
    throw error;
  }
}

async function testAIAgent() {
  try {
    console.log('🧪 Test de l\'agent IA...');
    
    const aiAgent = require('../services/aiAgent');
    
    // Test avec différents types de messages
    const testMessages = [
      'Bonjour tout le monde, je suis arrivé !',
      'Je pars en pause déjeuner',
      'Permission congé du 15/12/2023 au 20/12/2023 pour Noël',
      'Je suis malade aujourd\'hui',
      'Comment ça marche ?',
      'Au revoir tout le monde'
    ];
    
    console.log('📝 Test de classification des messages...');
    
    for (const message of testMessages) {
      try {
        const analysis = await aiAgent.analyzeMessage(message);
        console.log(`✅ "${message}" → ${analysis.type} (${analysis.confidence}) - Action: ${analysis.action}`);
      } catch (error) {
        console.log(`❌ Erreur avec "${message}":`, error.message);
      }
    }
    
    console.log('✅ Test de l\'agent IA terminé !');
    
  } catch (error) {
    console.error('❌ Erreur lors du test de l\'agent IA:', error);
  }
}

async function main() {
  try {
    console.log('🚀 Démarrage de la configuration IA...');
    
    // Test de connexion à la base de données
    await db.testConnection();
    console.log('✅ Connexion à la base de données OK');
    
    // Configuration des tables
    await setupAITables();
    
    // Test de l'agent IA
    await testAIAgent();
    
    console.log('🎉 Configuration IA terminée avec succès !');
    console.log('\n📋 Prochaines étapes :');
    console.log('1. Ajoutez HUGGINGFACE_API_KEY dans votre fichier .env (optionnel)');
    console.log('2. Démarrez le serveur avec: npm start');
    console.log('3. Testez l\'IA via l\'API: POST /api/ai/analyze');
    
  } catch (error) {
    console.error('❌ Erreur lors de la configuration:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main();
}

module.exports = { setupAITables, testAIAgent };

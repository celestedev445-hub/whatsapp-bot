#!/usr/bin/env node

/**
 * Script de test pour vérifier la configuration du Bot WhatsApp Entreprise
 * Ce script teste la connexion à la base de données et la structure des tables
 */

const db = require('./config/database');
const moment = require('moment');

async function testDatabaseConnection() {
  console.log('🔍 Test de connexion à la base de données...');
  
  try {
    await db.testConnection();
    console.log('✅ Connexion à la base de données réussie');
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:', error.message);
    return false;
  }
}

async function testDatabaseStructure() {
  console.log('🔍 Test de la structure de la base de données...');
  
  try {
    // Vérifier que les tables existent
    const tables = [
      'employees',
      'attendance', 
      'permissions',
      'messages',
      'reports',
      'system_settings'
    ];

    for (const table of tables) {
      const result = await db.query(`SHOW TABLES LIKE '${table}'`);
      if (result.length === 0) {
        console.log(`❌ Table '${table}' manquante`);
        console.log('💡 Veuillez créer la base de données et les tables dans phpMyAdmin');
        return false;
      }
    }

    console.log('✅ Structure de la base de données OK');
    return true;
  } catch (error) {
    console.error('❌ Erreur de structure de la base de données:', error.message);
    return false;
  }
}

async function testSystemSettings() {
  console.log('🔍 Test des paramètres système...');
  
  try {
    const settings = await db.query('SELECT * FROM system_settings');
    
    if (settings.length === 0) {
      console.log('❌ Paramètres système manquants');
      console.log('💡 Veuillez insérer les paramètres par défaut dans phpMyAdmin');
      return false;
    }

    console.log('✅ Paramètres système OK');
    console.log(`📊 ${settings.length} paramètres configurés`);
    return true;
  } catch (error) {
    console.error('❌ Erreur des paramètres système:', error.message);
    return false;
  }
}

async function testSampleData() {
  console.log('🔍 Test avec des données d\'exemple...');
  
  try {
    // Créer un employé de test
    const testEmployee = await db.query(`
      INSERT IGNORE INTO employees (whatsapp_id, name, phone, position, department)
      VALUES ('test_employee_123', 'Test Employee', '+33123456789', 'Développeur', 'IT')
    `);

    // Récupérer l'employé de test
    const employee = await db.query('SELECT * FROM employees WHERE whatsapp_id = ?', ['test_employee_123']);
    
    if (employee.length === 0) {
      throw new Error('Impossible de créer l\'employé de test');
    }

    const employeeId = employee[0].id;
    const today = moment().format('YYYY-MM-DD');

    // Créer une présence de test
    await db.query(`
      INSERT IGNORE INTO attendance (employee_id, date, arrival_time, status)
      VALUES (?, ?, '09:00:00', 'present')
    `, [employeeId, today]);

    // Vérifier la présence
    const attendance = await db.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employeeId, today]
    );

    if (attendance.length === 0) {
      throw new Error('Impossible de créer la présence de test');
    }

    console.log('✅ Données d\'exemple créées avec succès');
    
    // Nettoyer les données de test
    await db.query('DELETE FROM attendance WHERE employee_id = ?', [employeeId]);
    await db.query('DELETE FROM employees WHERE id = ?', [employeeId]);
    
    console.log('🧹 Données de test nettoyées');
    return true;
  } catch (error) {
    console.error('❌ Erreur avec les données d\'exemple:', error.message);
    return false;
  }
}

async function testEnvironmentVariables() {
  console.log('🔍 Test des variables d\'environnement...');
  
  const requiredVars = [
    'DB_HOST',
    'DB_USER', 
    'DB_PASSWORD',
    'DB_NAME'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Variables d\'environnement manquantes:', missingVars.join(', '));
    console.log('💡 Assurez-vous que le fichier .env est configuré correctement');
    return false;
  }

  console.log('✅ Variables d\'environnement OK');
  return true;
}

async function runAllTests() {
  console.log('🚀 Démarrage des tests de configuration...\n');
  
  const tests = [
    { name: 'Variables d\'environnement', fn: testEnvironmentVariables },
    { name: 'Connexion base de données', fn: testDatabaseConnection },
    { name: 'Structure base de données', fn: testDatabaseStructure },
    { name: 'Paramètres système', fn: testSystemSettings },
    { name: 'Données d\'exemple', fn: testSampleData }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    console.log(`\n📋 ${test.name}:`);
    try {
      const result = await test.fn();
      if (result) {
        passedTests++;
      }
    } catch (error) {
      console.error(`❌ Erreur inattendue: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Résultats: ${passedTests}/${totalTests} tests réussis`);
  
  if (passedTests === totalTests) {
    console.log('🎉 Tous les tests sont passés ! Le bot est prêt à fonctionner.');
    console.log('\n📝 Prochaines étapes:');
    console.log('1. Configurez votre numéro WhatsApp dans .env (ADMIN_PHONE)');
    console.log('2. Configurez l\'ID de votre groupe WhatsApp (WHATSAPP_GROUP_ID)');
    console.log('3. Lancez le bot avec: npm start');
    console.log('4. Scannez le QR Code avec WhatsApp');
  } else {
    console.log('⚠️  Certains tests ont échoué. Vérifiez la configuration.');
    process.exit(1);
  }
}

// Exécuter les tests si ce script est appelé directement
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  });
}

module.exports = {
  testDatabaseConnection,
  testDatabaseStructure,
  testSystemSettings,
  testSampleData,
  testEnvironmentVariables,
  runAllTests
};

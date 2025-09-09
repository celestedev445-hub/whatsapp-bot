const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function setupCustomHours() {
  try {
    console.log('🔧 Configuration des heures personnalisées...\n');
    
    // Lire le script SQL
    const sqlScript = fs.readFileSync(path.join(__dirname, 'add-custom-hours.sql'), 'utf8');
    
    // Diviser le script en requêtes individuelles
    const queries = sqlScript
      .split(';')
      .map(query => query.trim())
      .filter(query => query.length > 0 && !query.startsWith('--') && !query.startsWith('/*'));
    
    console.log(`📝 Exécution de ${queries.length} requêtes SQL...\n`);
    
    // Exécuter chaque requête
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      if (query.trim()) {
        try {
          console.log(`⚡ Requête ${i + 1}: ${query.substring(0, 50)}...`);
          await db.query(query);
          console.log(`✅ Requête ${i + 1} exécutée avec succès\n`);
        } catch (error) {
          if (error.code === 'ER_DUP_FIELDNAME') {
            console.log(`⚠️ Colonne déjà existante - ignoré\n`);
          } else if (error.code === 'ER_DUP_KEYNAME') {
            console.log(`⚠️ Index déjà existant - ignoré\n`);
          } else {
            console.error(`❌ Erreur lors de l'exécution de la requête ${i + 1}:`, error.message);
            console.log(`📝 Requête: ${query}\n`);
          }
        }
      }
    }
    
    console.log('🎉 Configuration des heures personnalisées terminée !\n');
    
    // Vérifier que les colonnes ont été ajoutées
    console.log('🔍 Vérification de la structure de la table...');
    const tableStructure = await db.query('DESCRIBE employees');
    const customColumns = tableStructure.filter(col => 
      col.Field.includes('custom_')
    );
    
    if (customColumns.length > 0) {
      console.log('✅ Colonnes personnalisées trouvées:');
      customColumns.forEach(col => {
        console.log(`   • ${col.Field} (${col.Type})`);
      });
    } else {
      console.log('⚠️ Aucune colonne personnalisée trouvée');
    }
    
    console.log('\n📋 Fonctionnalités disponibles:');
    console.log('   • Heures de début personnalisées par employé');
    console.log('   • Heures de fin personnalisées par employé');
    console.log('   • Seuil de retard personnalisé par employé');
    console.log('   • API REST pour gérer les heures personnalisées');
    console.log('   • Détection de retard basée sur les heures personnalisées');
    
    console.log('\n🚀 Vous pouvez maintenant utiliser l\'API /api/employee-hours pour gérer les heures !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la configuration:', error);
  } finally {
    // Fermer la connexion à la base de données
    if (db.connection) {
      db.connection.end();
    }
  }
}

// Exécuter le script
setupCustomHours();

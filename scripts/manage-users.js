#!/usr/bin/env node

const { createUser, listUsers } = require('./create-admin-user');

// Fonction pour afficher l'aide
function showHelp() {
  console.log(`
🔐 Gestion des utilisateurs Promillys Bot

Usage: node scripts/manage-users.js <command> [options]

Commands:
  list                    Lister tous les utilisateurs
  create <username>       Créer un nouvel utilisateur
  help                    Afficher cette aide

Exemples:
  node scripts/manage-users.js list
  node scripts/manage-users.js create john
  node scripts/manage-users.js help
`);
}

// Fonction pour créer un utilisateur interactivement
async function createUserInteractive(username) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  try {
    console.log(`\n👤 Création de l'utilisateur: ${username}`);
    
    const password = await question('Mot de passe: ');
    const email = await question('Email (optionnel): ');
    const fullName = await question('Nom complet (optionnel): ');
    
    console.log('\nRôles disponibles:');
    console.log('1. admin - Accès complet');
    console.log('2. manager - Gestion des employés et présences');
    console.log('3. user - Lecture seule');
    
    const roleChoice = await question('Choisir le rôle (1-3, défaut: 3): ');
    const roles = { '1': 'admin', '2': 'manager', '3': 'user' };
    const role = roles[roleChoice] || 'user';
    
    await createUser(username, password, email || null, fullName || null, role);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    rl.close();
  }
}

// Fonction principale
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'list':
      try {
        await listUsers();
      } catch (error) {
        console.error('❌ Erreur lors de la récupération des utilisateurs:', error.message);
        process.exit(1);
      }
      break;

    case 'create':
      const username = args[1];
      if (!username) {
        console.error('❌ Nom d\'utilisateur requis');
        console.log('Usage: node scripts/manage-users.js create <username>');
        process.exit(1);
      }
      await createUserInteractive(username);
      break;

    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    default:
      console.error('❌ Commande inconnue:', command);
      showHelp();
      process.exit(1);
  }
}

// Exécution
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Opération terminée');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erreur fatale:', error);
      process.exit(1);
    });
}

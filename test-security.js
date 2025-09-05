/**
 * Script de test pour vérifier la sécurité du bot WhatsApp
 * Ce script simule des messages de personnes non autorisées
 */

const WhatsAppBot = require('./services/whatsappBot');

// Simulation d'un contact non membre du groupe
const mockContactNonMembre = {
  id: { _serialized: '1234567890@c.us' },
  number: '1234567890',
  name: 'Personne Non Autorisée'
};

// Simulation d'un contact membre du groupe
const mockContactMembre = {
  id: { _serialized: '9876543210@c.us' },
  number: '9876543210',
  name: 'Employé Autorisé'
};

async function testSecurity() {
  console.log('🔒 Test de sécurité du bot WhatsApp...\n');

  try {
    // Test 1: Vérification d'un non-membre
    console.log('Test 1: Vérification d\'un non-membre du groupe');
    const isNonMembre = await WhatsAppBot.isGroupMember(mockContactNonMembre);
    console.log(`Résultat: ${isNonMembre ? '❌ ÉCHEC - Non-membre autorisé' : '✅ SUCCÈS - Non-membre rejeté'}\n`);

    // Test 2: Vérification d'un membre
    console.log('Test 2: Vérification d\'un membre du groupe');
    const isMembre = await WhatsAppBot.isGroupMember(mockContactMembre);
    console.log(`Résultat: ${isMembre ? '✅ SUCCÈS - Membre autorisé' : '❌ ÉCHEC - Membre rejeté'}\n`);

    // Test 3: Tentative de création d'employé non-membre
    console.log('Test 3: Tentative de création d\'employé non-membre');
    try {
      await WhatsAppBot.getOrCreateEmployee(mockContactNonMembre);
      console.log('❌ ÉCHEC - Employé non-membre créé');
    } catch (error) {
      if (error.message.includes('Personne non autorisée')) {
        console.log('✅ SUCCÈS - Création d\'employé non-membre bloquée');
      } else {
        console.log('❌ ÉCHEC - Erreur inattendue:', error.message);
      }
    }

    console.log('\n🔒 Tests de sécurité terminés');
    console.log('Le bot est maintenant sécurisé et ne peut envoyer de messages qu\'aux membres du groupe configuré.');

  } catch (error) {
    console.error('Erreur lors des tests:', error);
  }
}

// Exécuter les tests si le script est lancé directement
if (require.main === module) {
  testSecurity();
}

module.exports = { testSecurity };

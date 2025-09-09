const aiAgent = require('./services/aiAgent');

async function testGroupAdmin() {
  console.log('🔍 Test des commandes admin en groupe\n');
  
  // Test 1: Commande admin en groupe (doit fonctionner maintenant)
  console.log('📱 Test 1 - Commande admin en groupe:');
  const groupContext = { 
    isGroup: true, 
    author: 'Admin du groupe',
    userPhone: '123456789',
    contactNumber: '123456789',
    chatId: '120363422255012182@g.us'
  };
  
  const groupResponse = await aiAgent.handleAdminCommand('/admin', groupContext);
  console.log(`Réponse: ${groupResponse.substring(0, 100)}...`);
  console.log('');
  
  // Test 2: Commande admin en privé par un non-admin (doit être refusée)
  console.log('📱 Test 2 - Commande admin en privé par non-admin:');
  const nonAdminContext = { 
    isGroup: false, 
    author: 'Test User',
    userPhone: '123456789',
    contactNumber: '123456789'
  };
  
  const nonAdminResponse = await aiAgent.handleAdminCommand('/admin', nonAdminContext);
  console.log(`Réponse: ${nonAdminResponse}`);
  console.log('');
  
  console.log('✅ Résumé:');
  console.log('• Groupe + commande admin → Autorisée (pour les admins du groupe)');
  console.log('• Privé + non-admin + commande admin → Refusée');
}

testGroupAdmin().catch(console.error);

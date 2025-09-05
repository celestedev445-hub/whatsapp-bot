console.log('🔍 Test de démarrage du serveur...');

// Test 1: Modules de base
try {
  const express = require('express');
  console.log('✅ Express chargé');
} catch (error) {
  console.error('❌ Erreur Express:', error.message);
}

// Test 2: Base de données
try {
  const db = require('./config/database');
  console.log('✅ Database chargé');
} catch (error) {
  console.error('❌ Erreur Database:', error.message);
}

// Test 3: Routes employees
try {
  const employees = require('./routes/employees');
  console.log('✅ Employees chargé');
} catch (error) {
  console.error('❌ Erreur Employees:', error.message);
}

// Test 4: Routes departments
try {
  const departments = require('./routes/departments');
  console.log('✅ Departments chargé');
} catch (error) {
  console.error('❌ Erreur Departments:', error.message);
}

// Test 5: Routes messages
try {
  const messages = require('./routes/messages');
  console.log('✅ Messages chargé');
} catch (error) {
  console.error('❌ Erreur Messages:', error.message);
}

// Test 6: Services
try {
  const whatsappBot = require('./services/whatsappBot');
  console.log('✅ WhatsApp Bot chargé');
} catch (error) {
  console.error('❌ Erreur WhatsApp Bot:', error.message);
}

console.log('✅ Tous les tests terminés');

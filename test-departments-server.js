const express = require('express');
const app = express();

console.log('🚀 Démarrage du serveur de test pour departments...');

// Middleware
app.use(express.json());

// Test de la route departments
try {
  const departmentsRouter = require('./routes/departments');
  app.use('/api/departments', departmentsRouter);
  console.log('✅ Route departments montée avec succès');
} catch (error) {
  console.error('❌ Erreur lors du montage de la route departments:', error.message);
  console.error('Stack:', error.stack);
}

// Route de test
app.get('/test', (req, res) => {
  res.json({ message: 'Serveur de test fonctionne' });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  res.status(500).json({ error: 'Erreur serveur' });
});

const PORT = 3004;
app.listen(PORT, () => {
  console.log(`🌐 Serveur de test démarré sur le port ${PORT}`);
  console.log(`Testez: http://localhost:${PORT}/api/departments`);
  console.log(`Test: http://localhost:${PORT}/test`);
});


const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./config/database');
const whatsappBot = require('./services/whatsappBot');
const cronJobs = require('./services/cronJobs');

const app = express();
const PORT = 3002; // Force le port 3002

// Middleware de sécurité
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limite chaque IP à 100 requêtes par windowMs
});
app.use(limiter);

// Middleware pour parser le JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de débogage pour voir toutes les requêtes
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Routes
console.log('🔧 Enregistrement des routes...');
app.use('/api/employees', require('./routes/employees'));
console.log('✅ Route /api/employees enregistrée');
app.use('/api/attendance', require('./routes/attendance'));
console.log('✅ Route /api/attendance enregistrée');
app.use('/api/permissions', require('./routes/permissions'));
console.log('✅ Route /api/permissions enregistrée');
app.use('/api/reports', require('./routes/reports'));
console.log('✅ Route /api/reports enregistrée');
app.use('/api/admin', require('./routes/admin'));
console.log('✅ Route /api/admin enregistrée');
try {
  console.log('📁 Chargement de la route departments...');
  const departmentsRoute = require('./routes/departments');
  app.use('/api/departments', departmentsRoute);
  console.log('✅ Route /api/departments enregistrée');
} catch (error) {
  console.error('❌ Erreur lors du chargement de la route departments:', error.message);
  console.error('Stack trace:', error.stack);
}
app.use('/api/messages', require('./routes/messages'));
console.log('✅ Route /api/messages enregistrée');

// Route de santé
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Bot WhatsApp Entreprise - En ligne',
    timestamp: new Date().toISOString()
  });
});

// Route pour initialiser le bot WhatsApp
app.post('/api/admin/init-bot', async (req, res) => {
  try {
    if (whatsappBot.isReady) {
      return res.json({ 
        success: true, 
        message: 'Bot déjà initialisé et prêt',
        status: 'ready'
      });
    }
    
    await whatsappBot.initialize();
    res.json({ 
      success: true, 
      message: 'Bot WhatsApp initialisé avec succès',
      status: 'initialized'
    });
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du bot:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de l\'initialisation du bot',
      details: error.message 
    });
  }
});

// Route racine
app.get('/', (req, res) => {
  res.json({
    message: 'Bot WhatsApp Entreprise',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      employees: '/api/employees',
      attendance: '/api/attendance',
      permissions: '/api/permissions',
      reports: '/api/reports',
      admin: '/api/admin',
      initBot: '/api/admin/init-bot'
    }
  });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur:', err.stack);
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue'
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Initialisation de la base de données et démarrage du serveur
async function startServer() {
  try {
    // Test de connexion à la base de données
    await db.testConnection();
    console.log('✅ Connexion à la base de données établie');
    
    // Bot WhatsApp sera initialisé via l'interface web
    console.log('✅ Bot WhatsApp prêt à être initialisé via l\'interface web');
    
    // Démarrage des tâches cron
    cronJobs.start();
    console.log('✅ Tâches automatiques démarrées');
    
    // Démarrage du serveur
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
      console.log(`📱 Bot WhatsApp Entreprise - Prêt à fonctionner`);
      console.log(`🌐 Interface web: http://localhost:${PORT}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur lors du démarrage:', error);
    process.exit(1);
  }
}

// Gestion propre de l'arrêt
process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt du serveur...');
  await whatsappBot.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Arrêt du serveur...');
  await whatsappBot.cleanup();
  process.exit(0);
});

startServer();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const db = require('./config/database');
const whatsappBot = require('./services/whatsappBot');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});
const PORT = 3002;

// Middleware de sécurité
app.use(helmet());
app.use(cors());

// Rate limiting - plus permissif pour le développement
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // 1000 requêtes par minute (plus permissif)
  message: {
    error: 'Trop de requêtes, veuillez patienter',
    retryAfter: '1 minute'
  }
});

// Rate limiting spécial pour les routes de statut (plus permissif)
const statusLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 requêtes par minute pour les routes de statut
  message: {
    error: 'Trop de requêtes de statut, veuillez patienter',
    retryAfter: '1 minute'
  }
});

app.use(limiter);

// Middleware pour parser le JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/employees', require('./routes/employees'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/ai', require('./routes/ai'));

// Routes admin avec rate limiting spécial
app.use('/api/admin', statusLimiter, require('./routes/admin'));

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

// WebSocket pour la synchronisation en temps réel
io.on('connection', (socket) => {
  console.log('🔌 Client WebSocket connecté:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 Client WebSocket déconnecté:', socket.id);
  });
});

// Exporter l'instance io pour l'utiliser dans d'autres modules
global.io = io;

// Route de santé
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Bot WhatsApp Entreprise - API en ligne',
    timestamp: new Date().toISOString()
  });
});

// Route racine
app.get('/', (req, res) => {
  res.json({
    message: 'Bot WhatsApp Entreprise - API Mode',
    version: '1.0.0',
          endpoints: {
        health: '/health',
        employees: '/api/employees',
        attendance: '/api/attendance',
        permissions: '/api/permissions',
        reports: '/api/reports',
        departments: '/api/departments',
        messages: '/api/messages',
        ai: '/api/ai',
        admin: '/api/admin'
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
    
    // Initialisation automatique du bot WhatsApp
    console.log('🤖 Initialisation automatique du bot WhatsApp...');
    try {
      await whatsappBot.initialize();
      console.log('✅ Bot WhatsApp initialisé avec succès');
    } catch (botError) {
      console.error('⚠️ Erreur lors de l\'initialisation du bot WhatsApp:', botError.message);
      console.log('💡 Le bot peut être initialisé manuellement via l\'interface web');
    }
    
    // Démarrage du serveur avec WebSocket
    server.listen(PORT, () => {
      console.log(`🚀 Serveur API avec WebSocket démarré sur le port ${PORT}`);
      console.log(`🌐 Interface web: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket disponible pour la synchronisation temps réel`);
      console.log(`📱 Bot WhatsApp: ${whatsappBot.isReady ? 'Prêt' : 'En attente de connexion'}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur lors du démarrage:', error);
    process.exit(1);
  }
}

// Gestion propre de l'arrêt
process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt du serveur...');
  try {
    await whatsappBot.cleanup();
  } catch (error) {
    console.error('Erreur lors du nettoyage du bot:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Arrêt du serveur...');
  try {
    await whatsappBot.cleanup();
  } catch (error) {
    console.error('Erreur lors du nettoyage du bot:', error);
  }
  process.exit(0);
});

startServer();

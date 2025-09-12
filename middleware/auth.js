const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../config/database');

// Middleware d'authentification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: 'Token d\'authentification requis' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false,
        error: 'Token invalide ou expiré' 
      });
    }
    req.user = user;
    next();
  });
};

// Middleware pour vérifier les credentials avec la base de données
const verifyCredentials = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Nom d\'utilisateur et mot de passe requis'
      });
    }

    // Rechercher l'utilisateur dans la base de données
    const users = await db.query(
      'SELECT id, username, password_hash, email, full_name, role, is_active FROM users WHERE username = ? AND is_active = TRUE',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Nom d\'utilisateur ou mot de passe incorrect'
      });
    }

    const user = users[0];

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Nom d\'utilisateur ou mot de passe incorrect'
      });
    }

    // Mettre à jour la dernière connexion
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Ajouter les informations utilisateur à la requête
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role
    };

    next();
  } catch (error) {
    console.error('Erreur lors de la vérification des credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
};

module.exports = {
  authenticateToken,
  verifyCredentials
};

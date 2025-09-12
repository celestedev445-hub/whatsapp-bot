const express = require('express');
const jwt = require('jsonwebtoken');
const { verifyCredentials } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login - Connexion utilisateur
router.post('/login', verifyCredentials, (req, res) => {
  try {
    const user = req.user; // Récupéré du middleware verifyCredentials
    
    // Générer un token JWT
    const token = jwt.sign(
      { 
        id: user.id,
        username: user.username,
        role: user.role,
        loginTime: new Date().toISOString()
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' } // Token valide 24h
    );

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        token: token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la connexion'
    });
  }
});

// POST /api/auth/logout - Déconnexion (côté client)
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Déconnexion réussie'
  });
});

// GET /api/auth/verify - Vérifier la validité du token
router.get('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token manquant'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Token invalide ou expiré'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          role: user.role
        }
      }
    });
  });
});

module.exports = router;

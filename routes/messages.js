const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/messages - Récupérer tous les messages
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const limitNum = Math.min(limit, 100); // Limiter à 100 messages max par page
    
    const groupId = process.env.WHATSAPP_GROUP_ID;
    console.log('API - WHATSAPP_GROUP_ID from env:', process.env.WHATSAPP_GROUP_ID);
    console.log('API - groupId used in query:', groupId);
    
    const query = `
      SELECT 
        m.*,
        e.name as employee_name,
        e.position,
        e.department
      FROM messages m
      LEFT JOIN employees e ON m.from_number = e.phone
      WHERE m.group_id = ?
      ORDER BY m.created_at DESC 
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const [messages] = await db.query(query, [groupId]);

    // Compter le total des messages du groupe uniquement
    const [countResult] = await db.query('SELECT COUNT(*) as total FROM messages WHERE group_id = ?', [groupId]);
    const total = countResult && countResult[0] ? countResult[0].total : 0;

    res.json({
      messages,
      pagination: {
        page,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des messages:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des messages',
      details: error.message 
    });
  }
});

// GET /api/messages/recent - Récupérer les messages récents pour le dashboard
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const limitNum = Math.min(limit, 50);
    
    const groupId = process.env.WHATSAPP_GROUP_ID;
    
    const query = `
      SELECT 
        m.*,
        e.name as employee_name,
        e.position
      FROM messages m
      LEFT JOIN employees e ON m.from_number = e.phone
      WHERE m.group_id = ?
      ORDER BY m.created_at DESC 
      LIMIT ${limitNum}
    `;

    const [messages] = await db.query(query, [groupId]);
    res.json(messages);
  } catch (error) {
    console.error('Erreur lors de la récupération des messages récents:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des messages récents',
      details: error.message 
    });
  }
});

// GET /api/messages/stats - Statistiques des messages
router.get('/stats', async (req, res) => {
  try {
    
    const groupId = process.env.WHATSAPP_GROUP_ID;
    
    const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT from_number) as unique_senders,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as messages_today,
        COUNT(CASE WHEN DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN 1 END) as messages_yesterday
      FROM messages
      WHERE group_id = ?
    `, [groupId]);

    res.json(stats[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques des messages:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des statistiques des messages',
      details: error.message 
    });
  }
});

module.exports = router;

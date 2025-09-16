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
        d.name as department_name
      FROM messages m
      LEFT JOIN employees e ON (
        m.employee_id = e.id OR
        e.phone = REPLACE(SUBSTRING(m.from_number, 1, LOCATE('@', m.from_number) - 1), '+', '') OR
        e.phone = REPLACE(SUBSTRING(m.from_number, 2, LOCATE('@', m.from_number) - 2), '+', '') OR
        e.phone = REPLACE(SUBSTRING(m.from_number, 3, LOCATE('@', m.from_number) - 3), '+', '') OR
        e.phone = REPLACE(m.from_number, '@c.us', '') OR
        e.phone = REPLACE(m.from_number, '@lid', '') OR
        e.phone = REPLACE(REPLACE(m.from_number, '@c.us', ''), '+', '') OR
        e.phone = REPLACE(REPLACE(m.from_number, '@lid', ''), '+', '') OR
        e.phone = REPLACE(REPLACE(m.from_number, '@lid', ''), '+237', '+237') OR
        e.phone = REPLACE(REPLACE(m.from_number, '@lid', ''), '153', '237') OR
        e.phone = REPLACE(REPLACE(m.from_number, '@lid', ''), '153', '237')
      )
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE m.group_id = ?
      ORDER BY m.created_at DESC 
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const messages = await db.query(query, [groupId]);

    // Compter le total des messages du groupe uniquement
    const countResult = await db.query('SELECT COUNT(*) as total FROM messages WHERE group_id = ?', [groupId]);
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
        e.position,
        d.name as department_name
      FROM messages m
      LEFT JOIN employees e ON (
        m.employee_id = e.id OR
        e.phone = REPLACE(SUBSTRING(m.from_number, 1, LOCATE('@', m.from_number) - 1), '+', '') OR
        e.phone = REPLACE(SUBSTRING(m.from_number, 2, LOCATE('@', m.from_number) - 2), '+', '') OR
        e.phone = REPLACE(SUBSTRING(m.from_number, 3, LOCATE('@', m.from_number) - 3), '+', '') OR
        e.phone = REPLACE(m.from_number, '@c.us', '') OR
        e.phone = REPLACE(REPLACE(m.from_number, '@c.us', ''), '+', '')
      )
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE m.group_id = ?
      ORDER BY m.created_at DESC 
      LIMIT ${limitNum}
    `;

    const messages = await db.query(query, [groupId]);
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
    
    const stats = await db.query(`
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

// POST /api/messages/send - Envoyer un message
router.post('/send', async (req, res) => {
  try {
    const { content, message_type = 'text' } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ 
        success: false,
        error: 'Le contenu du message est requis' 
      });
    }

    const groupId = process.env.WHATSAPP_GROUP_ID;
    
    if (!groupId) {
      return res.status(500).json({ 
        success: false,
        error: 'ID du groupe WhatsApp non configuré' 
      });
    }

    // Insérer le message en base de données
    const result = await db.query(`
      INSERT INTO messages (group_id, from_number, content, message_type, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [groupId, 'system', content.trim(), message_type]);

    const messageId = result.insertId;

    // Récupérer le message créé avec les informations de l'employé
    const newMessage = await db.query(`
      SELECT 
        m.*,
        e.name as employee_name,
        e.position,
        d.name as department_name
      FROM messages m
      LEFT JOIN employees e ON (
        m.employee_id = e.id OR
        e.phone = REPLACE(SUBSTRING(m.from_number, 1, LOCATE('@', m.from_number) - 1), '+', '') OR
        e.phone = REPLACE(SUBSTRING(m.from_number, 2, LOCATE('@', m.from_number) - 2), '+', '') OR
        e.phone = REPLACE(SUBSTRING(m.from_number, 3, LOCATE('@', m.from_number) - 3), '+', '') OR
        e.phone = REPLACE(m.from_number, '@c.us', '') OR
        e.phone = REPLACE(REPLACE(m.from_number, '@c.us', ''), '+', '')
      )
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE m.id = ?
    `, [messageId]);

    res.json({
      success: true,
      message: 'Message envoyé avec succès',
      data: newMessage[0]
    });

  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'envoi du message',
      details: error.message 
    });
  }
});

// POST /api/messages/send-to-department - Envoyer un message à un département
router.post('/send-to-department', async (req, res) => {
  try {
    const { content, department_id, message_type = 'text' } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ 
        success: false,
        error: 'Le contenu du message est requis' 
      });
    }

    if (!department_id) {
      return res.status(400).json({ 
        success: false,
        error: 'L\'ID du département est requis' 
      });
    }

    // Récupérer les employés du département
    const employees = await db.query(`
      SELECT id, name, phone, department_id
      FROM employees 
      WHERE department_id = ? AND is_active = 1
    `, [department_id]);

    if (employees.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Aucun employé actif trouvé dans ce département' 
      });
    }

    // Récupérer le nom du département
    const department = await db.query(`
      SELECT name FROM departments WHERE id = ?
    `, [department_id]);

    const departmentName = department[0]?.name || 'Département';

    // Insérer le message pour chaque employé du département
    const messageContent = `[Message du département ${departmentName}]\n\n${content.trim()}`;
    const groupId = process.env.WHATSAPP_GROUP_ID;
    
    const results = [];
    for (const employee of employees) {
      const result = await db.query(`
        INSERT INTO messages (group_id, from_number, content, message_type, created_at, employee_id)
        VALUES (?, ?, ?, ?, NOW(), ?)
      `, [groupId, 'system', messageContent, message_type, employee.id]);
      
      results.push({
        employee_id: employee.id,
        employee_name: employee.name,
        message_id: result.insertId
      });
    }

    res.json({
      success: true,
      message: `Message envoyé à ${employees.length} employé(s) du département ${departmentName}`,
      data: {
        department_name: departmentName,
        employees_count: employees.length,
        messages_sent: results
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'envoi du message au département:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'envoi du message au département',
      details: error.message 
    });
  }
});

module.exports = router;

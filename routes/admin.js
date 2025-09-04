const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');
const qrcode = require('qrcode');

// GET /api/admin/bot-status - Vérifier le statut du bot
router.get('/bot-status', async (req, res) => {
  try {
    const whatsappBot = require('../services/whatsappBot');
    
    if (!whatsappBot) {
      return res.json({
        connected: false,
        status: 'Bot non initialisé',
        qrCode: null
      });
    }

    if (whatsappBot.isReady) {
      return res.json({
        connected: true,
        status: 'Bot connecté et prêt',
        qrCode: null,
        botNumber: whatsappBot.client?.info?.wid?.user || 'Inconnu'
      });
    }

    // Si le bot n'est pas connecté, essayer de récupérer le QR code
    if (whatsappBot.client && whatsappBot.client.qr) {
      try {
        const qrCodeDataURL = await qrcode.toDataURL(whatsappBot.client.qr);
        return res.json({
          connected: false,
          status: 'En attente de connexion WhatsApp',
          qrCode: qrCodeDataURL
        });
      } catch (qrError) {
        console.error('Erreur lors de la génération du QR code:', qrError);
      }
    }

    return res.json({
      connected: false,
      status: 'Bot en cours d\'initialisation',
      qrCode: null
    });

  } catch (error) {
    console.error('Erreur lors de la vérification du statut du bot:', error);
    res.status(500).json({
      connected: false,
      status: 'Erreur lors de la vérification du statut',
      qrCode: null,
      error: error.message
    });
  }
});

// POST /api/admin/sync-members - Synchroniser les membres du groupe
router.post('/sync-members', async (req, res) => {
  try {
    const whatsappBot = require('../services/whatsappBot');
    
    if (!whatsappBot || !whatsappBot.isReady) {
      return res.status(503).json({ 
        success: false, 
        error: 'Bot WhatsApp non connecté. Veuillez attendre que le bot se connecte à WhatsApp.' 
      });
    }

    const groupId = process.env.WHATSAPP_GROUP_ID;
    if (!groupId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Aucun groupe configuré' 
      });
    }

    const chat = await whatsappBot.client.getChatById(groupId);
    if (chat) {
      await whatsappBot.syncGroupMembers(chat);
      res.json({ 
        success: true, 
        message: 'Synchronisation des membres terminée' 
      });
    } else {
      res.status(404).json({ 
        success: false, 
        error: 'Groupe non trouvé' 
      });
    }
  } catch (error) {
    console.error('Erreur lors de la synchronisation des membres:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la synchronisation' 
    });
  }
});

// GET /api/admin/dashboard-stats - Statistiques pour le dashboard frontend
router.get('/dashboard-stats', async (req, res) => {
  try {
    // Statistiques des employés
    const totalEmployees = await db.query('SELECT COUNT(*) as count FROM employees WHERE is_active = 1');
    
    // Statistiques de présence aujourd'hui
    const today = moment().format('YYYY-MM-DD');
    const presentToday = await db.query(
      'SELECT COUNT(*) as count FROM attendance WHERE date = ? AND status = "present"',
      [today]
    );
    
    // Statistiques des permissions en attente
    const pendingPermissions = await db.query(
      'SELECT COUNT(*) as count FROM permissions WHERE status = "pending"'
    );
    
    // Statistiques des messages traités aujourd'hui
    const messagesProcessed = await db.query(
      'SELECT COUNT(*) as count FROM messages WHERE DATE(created_at) = CURDATE() AND processed = 1'
    );

    res.json({
      totalEmployees: totalEmployees[0].count,
      presentToday: presentToday[0].count,
      pendingPermissions: pendingPermissions[0].count,
      messagesProcessed: messagesProcessed[0].count
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/dashboard - Tableau de bord administrateur
router.get('/dashboard', async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const thisWeek = moment().startOf('week').format('YYYY-MM-DD');
    const thisMonth = moment().startOf('month').format('YYYY-MM-DD');

    // Statistiques générales
    const totalEmployees = await db.query('SELECT COUNT(*) as count FROM employees WHERE is_active = 1');
    
    // Présences du jour
    const todayAttendance = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
        COUNT(CASE WHEN status = 'late' THEN 1 END) as late,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent
      FROM attendance 
      WHERE date = ?
    `, [today]);

    // Permissions en attente
    const pendingPermissions = await db.query(`
      SELECT COUNT(*) as count 
      FROM permissions 
      WHERE status = 'pending'
    `);

    // Heures travaillées cette semaine
    const weeklyHours = await db.query(`
      SELECT SUM(total_work_hours) as total_hours
      FROM attendance 
      WHERE date >= ? AND total_work_hours IS NOT NULL
    `, [thisWeek]);

    // Top 5 des employés les plus présents ce mois
    const topEmployees = await db.query(`
      SELECT 
        e.name,
        e.department,
        COUNT(a.id) as total_days,
        COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) as present_days,
        ROUND((COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) * 100.0 / COUNT(a.id)), 2) as attendance_rate
      FROM employees e
      LEFT JOIN attendance a ON e.id = a.employee_id AND a.date >= ?
      WHERE e.is_active = 1
      GROUP BY e.id, e.name, e.department
      HAVING total_days > 0
      ORDER BY attendance_rate DESC
      LIMIT 5
    `, [thisMonth]);

    // Activité récente (dernières 7 jours)
    const recentActivity = await db.query(`
      SELECT 
        a.date,
        COUNT(*) as total_employees,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count
      FROM attendance a
      WHERE a.date >= DATE_SUB(?, INTERVAL 7 DAY)
      GROUP BY a.date
      ORDER BY a.date DESC
    `, [today]);

    // Permissions récentes
    const recentPermissions = await db.query(`
      SELECT 
        p.*,
        e.name as employee_name,
        e.department
      FROM permissions p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ORDER BY p.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        overview: {
          total_employees: totalEmployees[0].count,
          today_attendance: todayAttendance[0],
          pending_permissions: pendingPermissions[0].count,
          weekly_hours: weeklyHours[0].total_hours || 0
        },
        top_employees: topEmployees,
        recent_activity: recentActivity,
        recent_permissions: recentPermissions
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du dashboard'
    });
  }
});

// GET /api/admin/settings - Récupérer les paramètres système
router.get('/settings', async (req, res) => {
  try {
    const settings = await db.query('SELECT * FROM system_settings ORDER BY setting_key');

    const settingsObject = {};
    settings.forEach(setting => {
      settingsObject[setting.setting_key] = {
        value: setting.setting_value,
        description: setting.description,
        updated_at: setting.updated_at
      };
    });

    res.json({
      success: true,
      data: settingsObject
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des paramètres'
    });
  }
});

// PUT /api/admin/settings - Mettre à jour les paramètres système
router.put('/settings', async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Format de paramètres invalide'
      });
    }

    const updatedSettings = [];

    for (const [key, value] of Object.entries(settings)) {
      await db.query(`
        UPDATE system_settings 
        SET setting_value = ?, updated_at = NOW() 
        WHERE setting_key = ?
      `, [value, key]);

      updatedSettings.push({ key, value });
    }

    res.json({
      success: true,
      data: updatedSettings,
      message: 'Paramètres mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour des paramètres:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour des paramètres'
    });
  }
});

// POST /api/admin/approve-permission - Approuver une permission via WhatsApp
router.post('/approve-permission', async (req, res) => {
  try {
    const { employee_id, permission_id, action } = req.body;

    if (!employee_id || !permission_id || !action) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants'
      });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Action invalide (approve ou reject)'
      });
    }

    // Vérifier si la permission existe
    const permission = await db.query('SELECT * FROM permissions WHERE id = ?', [permission_id]);
    if (permission.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Permission non trouvée'
      });
    }

    if (permission[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Cette permission a déjà été traitée'
      });
    }

    // Mettre à jour la permission
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await db.query(`
      UPDATE permissions 
      SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `, [newStatus, employee_id, permission_id]);

    const updatedPermission = await db.query(`
      SELECT 
        p.*,
        e.name as employee_name,
        approver.name as approved_by_name
      FROM permissions p
      JOIN employees e ON p.employee_id = e.id
      LEFT JOIN employees approver ON p.approved_by = approver.id
      WHERE p.id = ?
    `, [permission_id]);

    res.json({
      success: true,
      data: updatedPermission[0],
      message: `Permission ${action === 'approve' ? 'approuvée' : 'rejetée'} avec succès`
    });

  } catch (error) {
    console.error('Erreur lors du traitement de la permission:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du traitement de la permission'
    });
  }
});

// GET /api/admin/notifications - Récupérer les notifications récentes
router.get('/notifications', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    // Messages WhatsApp récents
    const recentMessages = await db.query(`
      SELECT 
        wm.*,
        e.name as employee_name
      FROM messages wm
      LEFT JOIN employees e ON wm.from_number = e.phone
      ORDER BY wm.created_at DESC
      LIMIT ?
    `, [parseInt(limit)]);

    // Permissions en attente
    const pendingPermissions = await db.query(`
      SELECT 
        p.*,
        e.name as employee_name,
        e.department,
        DATEDIFF(NOW(), p.created_at) as days_pending
      FROM permissions p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.status = 'pending'
      ORDER BY p.created_at ASC
    `);

    // Retards récents
    const recentLates = await db.query(`
      SELECT 
        a.*,
        e.name as employee_name,
        e.department
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.status = 'late' AND a.date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ORDER BY a.date DESC, a.arrival_time DESC
    `);

    res.json({
      success: true,
      data: {
        recent_messages: recentMessages,
        pending_permissions: pendingPermissions,
        recent_lates: recentLates
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des notifications'
    });
  }
});

// POST /api/admin/send-message - Envoyer un message à un employé ou au groupe
router.post('/send-message', async (req, res) => {
  try {
    const { target, message, type = 'text' } = req.body;

    if (!target || !message) {
      return res.status(400).json({
        success: false,
        error: 'Cible et message requis'
      });
    }

    // Cette fonctionnalité nécessiterait l'intégration avec le bot WhatsApp
    // Pour l'instant, on simule l'envoi
    const messageData = {
      target,
      message,
      type,
      sent_at: new Date().toISOString(),
      status: 'sent'
    };

    // Sauvegarder le message envoyé
    const groupId = process.env.WHATSAPP_GROUP_ID;
    await db.query(`
      INSERT INTO messages (message_id, from_number, to_number, group_id, content, message_type, processed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      `admin_${Date.now()}`,
      'admin',
      target,
      groupId,
      message,
      type,
      true
    ]);

    res.json({
      success: true,
      data: messageData,
      message: 'Message envoyé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'envoi du message'
    });
  }
});

// GET /api/admin/system-status - Statut du système
router.get('/system-status', async (req, res) => {
  try {
    const whatsappBot = require('../services/whatsappBot');
    const cronJobs = require('../services/cronJobs');

    // Test de connexion à la base de données
    let dbStatus = 'connected';
    try {
      await db.query('SELECT 1');
    } catch (error) {
      dbStatus = 'disconnected';
    }

    // Statut du bot WhatsApp
    const whatsappStatus = whatsappBot.isReady ? 'ready' : 'not_ready';

    // Statistiques de la base de données
    const dbStats = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM employees WHERE is_active = 1) as total_employees,
        (SELECT COUNT(*) FROM attendance WHERE date = CURDATE()) as today_attendance,
        (SELECT COUNT(*) FROM permissions WHERE status = 'pending') as pending_permissions,
        (SELECT COUNT(*) FROM messages WHERE DATE(created_at) = CURDATE()) as today_messages
    `);

    res.json({
      success: true,
      data: {
        database: {
          status: dbStatus,
          stats: dbStats[0]
        },
        whatsapp_bot: {
          status: whatsappStatus,
          is_ready: whatsappBot.isReady
        },
        cron_jobs: {
          active_jobs: cronJobs.jobs.length,
          status: 'running'
        },
        server: {
          uptime: process.uptime(),
          memory_usage: process.memoryUsage(),
          node_version: process.version,
          platform: process.platform
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du statut système:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du statut système'
    });
  }
});

// POST /api/admin/backup - Créer une sauvegarde de la base de données
router.post('/backup', async (req, res) => {
  try {
    const backupData = {
      timestamp: new Date().toISOString(),
      employees: await db.query('SELECT * FROM employees'),
      attendance: await db.query('SELECT * FROM attendance'),
      permissions: await db.query('SELECT * FROM permissions'),
      settings: await db.query('SELECT * FROM system_settings')
    };

    // En production, vous voudriez sauvegarder dans un fichier ou un service cloud
    res.json({
      success: true,
      data: backupData,
      message: 'Sauvegarde créée avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la création de la sauvegarde:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de la sauvegarde'
    });
  }
});

module.exports = router;

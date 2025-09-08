const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Route pour obtenir les statistiques de l'IA
router.get('/stats', async (req, res) => {
  try {
    // Statistiques générales
    const totalMessages = await db.query('SELECT COUNT(*) as count FROM ai_analysis');
    const todayMessages = await db.query(`
      SELECT COUNT(*) as count FROM ai_analysis 
      WHERE DATE(created_at) = CURDATE()
    `);
    
    // Messages par type
    const messagesByType = await db.query(`
      SELECT analysis_type as type, COUNT(*) as count 
      FROM ai_analysis 
      GROUP BY analysis_type
    `);
    
    // Messages par action
    const messagesByAction = await db.query(`
      SELECT action, COUNT(*) as count 
      FROM ai_analysis 
      WHERE action != 'none'
      GROUP BY action
    `);
    
    // Confiance moyenne
    const avgConfidence = await db.query(`
      SELECT AVG(confidence) as avg_confidence 
      FROM ai_analysis
    `);
    
    // Messages traités vs non traités (estimation basée sur la confiance)
    const processedStats = await db.query(`
      SELECT 
        SUM(CASE WHEN confidence >= 0.3 THEN 1 ELSE 0 END) as processed,
        SUM(CASE WHEN confidence < 0.3 THEN 1 ELSE 0 END) as not_processed
      FROM ai_analysis
    `);

    res.json({
      success: true,
      data: {
        totalMessages: totalMessages[0].count,
        todayMessages: todayMessages[0].count,
        messagesByType: messagesByType.reduce((acc, item) => {
          acc[item.type] = item.count;
          return acc;
        }, {}),
        messagesByAction: messagesByAction.reduce((acc, item) => {
          acc[item.action] = item.count;
          return acc;
        }, {}),
        avgConfidence: avgConfidence[0].avg_confidence || 0,
        processed: processedStats[0].processed,
        notProcessed: processedStats[0].not_processed
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques IA:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// Route pour obtenir les analyses récentes
router.get('/analyses', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    const analyses = await db.query(`
      SELECT 
        id,
        message_content as original_message,
        analysis_type as type,
        action,
        confidence,
        CASE WHEN confidence >= 0.3 THEN 1 ELSE 0 END as should_process,
        created_at as timestamp,
        extracted_info as context
      FROM ai_analysis 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    // Parser le contexte JSON
    const parsedAnalyses = analyses.map(analysis => ({
      ...analysis,
      context: analysis.context ? JSON.parse(analysis.context) : null
    }));

    res.json({
      success: true,
      data: parsedAnalyses
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des analyses:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des analyses'
    });
  }
});

// Route pour obtenir les paramètres de l'IA
router.get('/settings', async (req, res) => {
  try {
    const settings = await db.query('SELECT * FROM ai_settings');
    
    if (settings.length === 0) {
      // Paramètres par défaut
      const defaultSettings = {
        confidence_threshold: 0.3,
        enable_ai: true,
        enable_sentiment_analysis: true,
        enable_topic_detection: true,
        max_response_length: 500,
        language: 'fr'
      };
      
      res.json({
        success: true,
        data: defaultSettings
      });
    } else {
      // Convertir les paramètres en objet
      const settingsObj = {};
      settings.forEach(setting => {
        settingsObj[setting.setting_key] = setting.setting_value;
      });
      
      res.json({
        success: true,
        data: settingsObj
      });
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres IA:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des paramètres'
    });
  }
});

// Route pour mettre à jour les paramètres de l'IA
router.put('/settings', async (req, res) => {
  try {
    const {
      confidence_threshold,
      enable_ai,
      enable_sentiment_analysis,
      enable_topic_detection,
      max_response_length,
      language
    } = req.body;

    await db.query(`
      INSERT INTO ai_settings (
        confidence_threshold,
        enable_ai,
        enable_sentiment_analysis,
        enable_topic_detection,
        max_response_length,
        language,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [
      confidence_threshold,
      enable_ai,
      enable_sentiment_analysis,
      enable_topic_detection,
      max_response_length,
      language
    ]);

    res.json({
      success: true,
      message: 'Paramètres mis à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour des paramètres IA:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour des paramètres'
    });
  }
});

// Route pour tester l'IA
router.post('/test', async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message requis pour le test'
      });
    }

    // Simuler une analyse IA
    const aiAgent = require('../services/aiAgent');
    const result = await aiAgent.processMessage(message, context || {
      author: 'Test User',
      chatId: 'test@c.us',
      isGroup: false,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Erreur lors du test IA:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du test IA'
    });
  }
});

// Route pour obtenir les performances de l'IA
router.get('/performance', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    
    // Performances par jour
    const dailyPerformance = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_messages,
        SUM(CASE WHEN confidence >= 0.3 THEN 1 ELSE 0 END) as processed_messages,
        AVG(confidence) as avg_confidence
      FROM ai_analysis 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [days]);

    // Types de messages les plus fréquents
    const topMessageTypes = await db.query(`
      SELECT analysis_type as type, COUNT(*) as count
      FROM ai_analysis 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY analysis_type
      ORDER BY count DESC
      LIMIT 5
    `, [days]);

    // Actions les plus fréquentes
    const topActions = await db.query(`
      SELECT action, COUNT(*) as count
      FROM ai_analysis 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      AND action != 'none'
      GROUP BY action
      ORDER BY count DESC
      LIMIT 5
    `, [days]);

    res.json({
      success: true,
      data: {
        dailyPerformance,
        topMessageTypes,
        topActions
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des performances IA:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des performances'
    });
  }
});

module.exports = router;
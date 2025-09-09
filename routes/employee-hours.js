const express = require('express');
const router = express.Router();
const db = require('../config/database');
const aiAgent = require('../services/aiAgent');

/**
 * GET /api/employee-hours/:id - Récupérer les heures personnalisées d'un employé
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const customHours = await aiAgent.getEmployeeCustomHours(id);
    
    if (customHours) {
      res.json({
        success: true,
        data: customHours,
        message: 'Heures personnalisées récupérées'
      });
    } else {
      res.json({
        success: true,
        data: null,
        message: 'Aucune heure personnalisée définie - utilise les heures par défaut'
      });
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des heures personnalisées:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des heures personnalisées'
    });
  }
});

/**
 * POST /api/employee-hours/:id - Définir les heures personnalisées d'un employé
 */
router.post('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, lateThreshold } = req.body;
    
    // Validation des données
    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'L\'heure de début et de fin sont obligatoires'
      });
    }
    
    // Validation du format des heures (HH:mm)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({
        success: false,
        error: 'Format d\'heure invalide. Utilisez HH:mm (ex: 08:30)'
      });
    }
    
    // Validation du seuil de retard
    const threshold = parseInt(lateThreshold) || 15;
    if (threshold < 0 || threshold > 120) {
      return res.status(400).json({
        success: false,
        error: 'Le seuil de retard doit être entre 0 et 120 minutes'
      });
    }
    
    // Vérifier que l'employé existe
    const employee = await db.query('SELECT * FROM employees WHERE id = ?', [id]);
    if (employee.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Employé non trouvé'
      });
    }
    
    // Définir les heures personnalisées
    const success = await aiAgent.setEmployeeCustomHours(id, startTime, endTime, threshold);
    
    if (success) {
      res.json({
        success: true,
        data: { startTime, endTime, lateThreshold: threshold },
        message: `Heures personnalisées définies pour ${employee[0].name}: ${startTime} - ${endTime}`
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la définition des heures personnalisées'
      });
    }
  } catch (error) {
    console.error('Erreur lors de la définition des heures personnalisées:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la définition des heures personnalisées'
    });
  }
});

/**
 * PUT /api/employee-hours/:id - Mettre à jour les heures personnalisées d'un employé
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, lateThreshold } = req.body;
    
    // Vérifier que l'employé existe
    const employee = await db.query('SELECT * FROM employees WHERE id = ?', [id]);
    if (employee.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Employé non trouvé'
      });
    }
    
    // Récupérer les heures actuelles
    const currentHours = await aiAgent.getEmployeeCustomHours(id);
    
    // Utiliser les valeurs existantes si non fournies
    const newStartTime = startTime || currentHours?.startTime;
    const newEndTime = endTime || currentHours?.endTime;
    const newLateThreshold = lateThreshold !== undefined ? parseInt(lateThreshold) : (currentHours?.lateThreshold || 15);
    
    // Validation
    if (!newStartTime || !newEndTime) {
      return res.status(400).json({
        success: false,
        error: 'L\'heure de début et de fin sont obligatoires'
      });
    }
    
    // Mettre à jour les heures personnalisées
    const success = await aiAgent.setEmployeeCustomHours(id, newStartTime, newEndTime, newLateThreshold);
    
    if (success) {
      res.json({
        success: true,
        data: { startTime: newStartTime, endTime: newEndTime, lateThreshold: newLateThreshold },
        message: `Heures personnalisées mises à jour pour ${employee[0].name}`
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la mise à jour des heures personnalisées'
      });
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour des heures personnalisées:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour des heures personnalisées'
    });
  }
});

/**
 * DELETE /api/employee-hours/:id - Supprimer les heures personnalisées d'un employé
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier que l'employé existe
    const employee = await db.query('SELECT * FROM employees WHERE id = ?', [id]);
    if (employee.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Employé non trouvé'
      });
    }
    
    // Supprimer les heures personnalisées
    const success = await aiAgent.removeEmployeeCustomHours(id);
    
    if (success) {
      res.json({
        success: true,
        message: `Heures personnalisées supprimées pour ${employee[0].name} - retour aux heures par défaut`
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression des heures personnalisées'
      });
    }
  } catch (error) {
    console.error('Erreur lors de la suppression des heures personnalisées:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression des heures personnalisées'
    });
  }
});

/**
 * GET /api/employee-hours - Récupérer tous les employés avec leurs heures personnalisées
 */
router.get('/', async (req, res) => {
  try {
    const employees = await db.query(`
      SELECT 
        e.id, 
        e.name, 
        e.phone, 
        e.is_active,
        e.whatsapp_id,
        e.position,
        e.department,
        e.department_id,
        e.custom_start_time, 
        e.custom_end_time, 
        e.custom_late_threshold,
        CASE 
          WHEN e.custom_start_time IS NOT NULL THEN 'Personnalisées'
          ELSE 'Par défaut'
        END as hours_type
      FROM employees e 
      WHERE e.is_active = 1 
      ORDER BY e.name
    `);
    
    res.json({
      success: true,
      data: employees,
      message: 'Liste des employés avec leurs heures récupérée'
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des employés:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des employés'
    });
  }
});

module.exports = router;

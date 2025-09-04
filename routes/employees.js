const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/employees - Récupérer tous les employés
router.get('/', async (req, res) => {
  try {
    const groupId = process.env.WHATSAPP_GROUP_ID;
    
    const employees = await db.query(`
      SELECT 
        e.*,
        COUNT(a.id) as total_attendance_days,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days
      FROM employees e
      LEFT JOIN attendance a ON e.id = a.employee_id
      WHERE e.group_id = ? AND e.is_active = 1
      GROUP BY e.id
      ORDER BY e.name
    `, [groupId]);

    res.json(employees);
  } catch (error) {
    console.error('Erreur lors de la récupération des employés:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des employés'
    });
  }
});

// GET /api/employees/:id - Récupérer un employé spécifique
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const employee = await db.query('SELECT * FROM employees WHERE id = ? AND is_active = 1', [id]);
    
    if (employee.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Employé non trouvé'
      });
    }

    // Récupérer les statistiques de présence
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_days,
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN status = 'late' THEN 1 END) as late_days,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_days,
        AVG(total_work_hours) as avg_work_hours
      FROM attendance 
      WHERE employee_id = ?
    `, [id]);

    // Récupérer les permissions
    const permissions = await db.query(`
      SELECT * FROM permissions 
      WHERE employee_id = ? 
      ORDER BY created_at DESC
    `, [id]);

    res.json({
      ...employee[0],
      statistics: stats[0],
      permissions
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'employé:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'employé'
    });
  }
});

// POST /api/employees - Créer un nouvel employé
router.post('/', async (req, res) => {
  try {
    const { name, phone, position, department, whatsapp_id } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Le nom et le téléphone sont obligatoires'
      });
    }

    // Vérifier si l'employé existe déjà
    const existingEmployee = await db.query(
      'SELECT * FROM employees WHERE phone = ? OR whatsapp_id = ?',
      [phone, whatsapp_id]
    );

    if (existingEmployee.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Un employé avec ce téléphone ou ID WhatsApp existe déjà'
      });
    }

    const result = await db.query(
      'INSERT INTO employees (name, phone, position, department, whatsapp_id) VALUES (?, ?, ?, ?, ?)',
      [name, phone, position || null, department || null, whatsapp_id || null]
    );

    const newEmployee = await db.query('SELECT * FROM employees WHERE id = ?', [result.insertId]);

    res.status(201).json(newEmployee[0]);
  } catch (error) {
    console.error('Erreur lors de la création de l\'employé:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de l\'employé'
    });
  }
});

// PUT /api/employees/:id - Mettre à jour un employé
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, position, department, whatsapp_id, is_active } = req.body;

    // Vérifier si l'employé existe
    const existingEmployee = await db.query('SELECT * FROM employees WHERE id = ?', [id]);
    
    if (existingEmployee.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Employé non trouvé'
      });
    }

    // Vérifier les doublons de téléphone/WhatsApp
    if (phone || whatsapp_id) {
      const duplicateCheck = await db.query(
        'SELECT * FROM employees WHERE (phone = ? OR whatsapp_id = ?) AND id != ?',
        [phone || existingEmployee[0].phone, whatsapp_id || existingEmployee[0].whatsapp_id, id]
      );

      if (duplicateCheck.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Un autre employé utilise déjà ce téléphone ou ID WhatsApp'
        });
      }
    }

    await db.query(
      'UPDATE employees SET name = ?, phone = ?, position = ?, department = ?, whatsapp_id = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
      [
        name || existingEmployee[0].name,
        phone || existingEmployee[0].phone,
        position !== undefined ? position : existingEmployee[0].position,
        department !== undefined ? department : existingEmployee[0].department,
        whatsapp_id !== undefined ? whatsapp_id : existingEmployee[0].whatsapp_id,
        is_active !== undefined ? is_active : existingEmployee[0].is_active,
        id
      ]
    );

    const updatedEmployee = await db.query('SELECT * FROM employees WHERE id = ?', [id]);

    res.json(updatedEmployee[0]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'employé:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour de l\'employé'
    });
  }
});

// DELETE /api/employees/:id - Désactiver un employé (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier si l'employé existe
    const existingEmployee = await db.query('SELECT * FROM employees WHERE id = ?', [id]);
    
    if (existingEmployee.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Employé non trouvé'
      });
    }

    // Soft delete - marquer comme inactif
    await db.query('UPDATE employees SET is_active = 0, updated_at = NOW() WHERE id = ?', [id]);

    res.json({ message: 'Employé désactivé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la désactivation de l\'employé:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la désactivation de l\'employé'
    });
  }
});

// GET /api/employees/:id/attendance - Récupérer l'historique de présence d'un employé
router.get('/:id/attendance', async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, limit = 30 } = req.query;

    let query = `
      SELECT * FROM attendance 
      WHERE employee_id = ?
    `;
    const params = [id];

    if (start_date && end_date) {
      query += ' AND date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    query += ' ORDER BY date DESC LIMIT ?';
    params.push(parseInt(limit));

    const attendance = await db.query(query, params);

    res.json(attendance);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'historique de présence'
    });
  }
});

// GET /api/employees/:id/permissions - Récupérer les permissions d'un employé
router.get('/:id/permissions', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, year } = req.query;

    let query = 'SELECT * FROM permissions WHERE employee_id = ?';
    const params = [id];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (year) {
      query += ' AND YEAR(start_date) = ?';
      params.push(year);
    }

    query += ' ORDER BY created_at DESC';

    const permissions = await db.query(query, params);

    res.json(permissions);
  } catch (error) {
    console.error('Erreur lors de la récupération des permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des permissions'
    });
  }
});

module.exports = router;

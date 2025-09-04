const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');

// GET /api/permissions - Récupérer les permissions avec filtres
router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      type, 
      employee_id, 
      start_date, 
      end_date,
      page = 1, 
      limit = 50 
    } = req.query;

    const groupId = process.env.WHATSAPP_GROUP_ID;
    
    let query = `
      SELECT 
        p.*,
        e.name as employee_name,
        e.department,
        approver.name as approved_by_name
      FROM permissions p
      JOIN employees e ON p.employee_id = e.id
      LEFT JOIN employees approver ON p.approved_by = approver.id
      WHERE e.group_id = ? AND e.is_active = 1
    `;
    const params = [groupId];

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    if (type) {
      query += ' AND p.type = ?';
      params.push(type);
    }

    if (employee_id) {
      query += ' AND p.employee_id = ?';
      params.push(employee_id);
    }

    if (start_date) {
      query += ' AND p.start_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND p.end_date <= ?';
      params.push(end_date);
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;
    query += ` ORDER BY p.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const permissions = await db.query(query, params);

    // Compter le total pour la pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM permissions p
      JOIN employees e ON p.employee_id = e.id
      WHERE e.group_id = ? AND e.is_active = 1
    `;
    const countParams = [groupId];

    if (status) {
      countQuery += ' AND p.status = ?';
      countParams.push(status);
    }

    if (type) {
      countQuery += ' AND p.type = ?';
      countParams.push(type);
    }

    if (employee_id) {
      countQuery += ' AND p.employee_id = ?';
      countParams.push(employee_id);
    }

    if (start_date) {
      countQuery += ' AND p.start_date >= ?';
      countParams.push(start_date);
    }

    if (end_date) {
      countQuery += ' AND p.end_date <= ?';
      countParams.push(end_date);
    }

    const totalResult = await db.query(countQuery, countParams);
    const total = totalResult[0].total;

    res.json(permissions);
  } catch (error) {
    console.error('Erreur lors de la récupération des permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des permissions'
    });
  }
});

// GET /api/permissions/pending - Récupérer les permissions en attente
router.get('/pending', async (req, res) => {
  try {
    const permissions = await db.query(`
      SELECT 
        p.*,
        e.name as employee_name,
        e.department,
        e.phone,
        DATEDIFF(NOW(), p.created_at) as days_pending
      FROM permissions p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.status = 'pending' AND e.is_active = 1
      ORDER BY p.created_at ASC
    `);

    res.json(permissions);
  } catch (error) {
    console.error('Erreur lors de la récupération des permissions en attente:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des permissions en attente'
    });
  }
});

// GET /api/permissions/:id - Récupérer une permission spécifique
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const permission = await db.query(`
      SELECT 
        p.*,
        e.name as employee_name,
        e.department,
        e.phone,
        approver.name as approved_by_name
      FROM permissions p
      JOIN employees e ON p.employee_id = e.id
      LEFT JOIN employees approver ON p.approved_by = approver.id
      WHERE p.id = ?
    `, [id]);

    if (permission.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Permission non trouvée'
      });
    }

    res.json({
      success: true,
      data: permission[0]
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la permission:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la permission'
    });
  }
});

// POST /api/permissions - Créer une nouvelle permission
router.post('/', async (req, res) => {
  try {
    const { 
      employee_id, 
      type, 
      start_date, 
      end_date, 
      reason 
    } = req.body;

    if (!employee_id || !type || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Tous les champs obligatoires doivent être remplis'
      });
    }

    // Vérifier si l'employé existe
    const employee = await db.query('SELECT * FROM employees WHERE id = ? AND is_active = 1', [employee_id]);
    if (employee.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Employé non trouvé'
      });
    }

    // Vérifier les dates
    const startMoment = moment(start_date);
    const endMoment = moment(end_date);

    if (!startMoment.isValid() || !endMoment.isValid()) {
      return res.status(400).json({
        success: false,
        error: 'Format de date invalide'
      });
    }

    if (endMoment.isBefore(startMoment)) {
      return res.status(400).json({
        success: false,
        error: 'La date de fin doit être postérieure à la date de début'
      });
    }

    // Vérifier les conflits avec d'autres permissions
    const conflictingPermissions = await db.query(`
      SELECT * FROM permissions 
      WHERE employee_id = ? 
      AND status IN ('pending', 'approved')
      AND (
        (start_date <= ? AND end_date >= ?) OR
        (start_date <= ? AND end_date >= ?) OR
        (start_date >= ? AND end_date <= ?)
      )
    `, [employee_id, start_date, start_date, end_date, end_date, start_date, end_date]);

    if (conflictingPermissions.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Conflit avec une permission existante',
        conflicting_permissions: conflictingPermissions
      });
    }

    const result = await db.query(`
      INSERT INTO permissions (employee_id, type, start_date, end_date, reason, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `, [employee_id, type, start_date, end_date, reason || null]);

    const newPermission = await db.query(`
      SELECT 
        p.*,
        e.name as employee_name,
        e.department
      FROM permissions p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.id = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      data: newPermission[0],
      message: 'Permission créée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la création de la permission:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de la permission'
    });
  }
});

// PUT /api/permissions/:id/approve - Approuver une permission
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by } = req.body;

    if (!approved_by) {
      return res.status(400).json({
        success: false,
        error: 'L\'ID de l\'approbateur est obligatoire'
      });
    }

    // Vérifier si la permission existe
    const permission = await db.query('SELECT * FROM permissions WHERE id = ?', [id]);
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

    // Vérifier si l'approbateur existe
    const approver = await db.query('SELECT * FROM employees WHERE id = ? AND is_active = 1', [approved_by]);
    if (approver.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Approbateur non trouvé'
      });
    }

    await db.query(`
      UPDATE permissions 
      SET status = 'approved', approved_by = ?, approved_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `, [approved_by, id]);

    const updatedPermission = await db.query(`
      SELECT 
        p.*,
        e.name as employee_name,
        e.department,
        approver.name as approved_by_name
      FROM permissions p
      JOIN employees e ON p.employee_id = e.id
      LEFT JOIN employees approver ON p.approved_by = approver.id
      WHERE p.id = ?
    `, [id]);

    res.json({
      success: true,
      data: updatedPermission[0],
      message: 'Permission approuvée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de l\'approbation de la permission:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'approbation de la permission'
    });
  }
});

// PUT /api/permissions/:id/reject - Rejeter une permission
router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by, rejection_reason } = req.body;

    if (!approved_by) {
      return res.status(400).json({
        success: false,
        error: 'L\'ID de l\'approbateur est obligatoire'
      });
    }

    // Vérifier si la permission existe
    const permission = await db.query('SELECT * FROM permissions WHERE id = ?', [id]);
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

    // Vérifier si l'approbateur existe
    const approver = await db.query('SELECT * FROM employees WHERE id = ? AND is_active = 1', [approved_by]);
    if (approver.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Approbateur non trouvé'
      });
    }

    await db.query(`
      UPDATE permissions 
      SET status = 'rejected', approved_by = ?, approved_at = NOW(), 
          reason = CONCAT(IFNULL(reason, ''), ' - Rejet: ', ?), updated_at = NOW()
      WHERE id = ?
    `, [approved_by, rejection_reason || 'Aucune raison spécifiée', id]);

    const updatedPermission = await db.query(`
      SELECT 
        p.*,
        e.name as employee_name,
        e.department,
        approver.name as approved_by_name
      FROM permissions p
      JOIN employees e ON p.employee_id = e.id
      LEFT JOIN employees approver ON p.approved_by = approver.id
      WHERE p.id = ?
    `, [id]);

    res.json({
      success: true,
      data: updatedPermission[0],
      message: 'Permission rejetée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors du rejet de la permission:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du rejet de la permission'
    });
  }
});

// PUT /api/permissions/:id - Mettre à jour une permission
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, start_date, end_date, reason } = req.body;

    // Vérifier si la permission existe
    const permission = await db.query('SELECT * FROM permissions WHERE id = ?', [id]);
    if (permission.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Permission non trouvée'
      });
    }

    if (permission[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Seules les permissions en attente peuvent être modifiées'
      });
    }

    // Vérifier les dates si elles sont fournies
    if (start_date && end_date) {
      const startMoment = moment(start_date);
      const endMoment = moment(end_date);

      if (!startMoment.isValid() || !endMoment.isValid()) {
        return res.status(400).json({
          success: false,
          error: 'Format de date invalide'
        });
      }

      if (endMoment.isBefore(startMoment)) {
        return res.status(400).json({
          success: false,
          error: 'La date de fin doit être postérieure à la date de début'
        });
      }
    }

    await db.query(`
      UPDATE permissions 
      SET type = ?, start_date = ?, end_date = ?, reason = ?, updated_at = NOW()
      WHERE id = ?
    `, [
      type || permission[0].type,
      start_date || permission[0].start_date,
      end_date || permission[0].end_date,
      reason !== undefined ? reason : permission[0].reason,
      id
    ]);

    const updatedPermission = await db.query(`
      SELECT 
        p.*,
        e.name as employee_name,
        e.department
      FROM permissions p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.id = ?
    `, [id]);

    res.json({
      success: true,
      data: updatedPermission[0],
      message: 'Permission mise à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la permission:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour de la permission'
    });
  }
});

// DELETE /api/permissions/:id - Supprimer une permission
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier si la permission existe
    const permission = await db.query('SELECT * FROM permissions WHERE id = ?', [id]);
    if (permission.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Permission non trouvée'
      });
    }

    if (permission[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Seules les permissions en attente peuvent être supprimées'
      });
    }

    const result = await db.query('DELETE FROM permissions WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Permission supprimée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de la permission:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression de la permission'
    });
  }
});

// GET /api/permissions/statistics - Statistiques des permissions
router.get('/statistics', async (req, res) => {
  try {
    const { 
      start_date = moment().startOf('year').format('YYYY-MM-DD'),
      end_date = moment().endOf('year').format('YYYY-MM-DD'),
      employee_id,
      department 
    } = req.query;

    let baseQuery = `
      FROM permissions p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.start_date BETWEEN ? AND ? AND e.is_active = 1
    `;
    const params = [start_date, end_date];

    if (employee_id) {
      baseQuery += ' AND p.employee_id = ?';
      params.push(employee_id);
    }

    if (department) {
      baseQuery += ' AND e.department = ?';
      params.push(department);
    }

    // Statistiques générales
    const generalStats = await db.query(`
      SELECT 
        COUNT(*) as total_permissions,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN type = 'vacation' THEN 1 END) as vacation_count,
        COUNT(CASE WHEN type = 'sick_leave' THEN 1 END) as sick_leave_count,
        COUNT(CASE WHEN type = 'personal' THEN 1 END) as personal_count,
        COUNT(CASE WHEN type = 'medical' THEN 1 END) as medical_count
      ${baseQuery}
    `, params);

    // Statistiques par mois
    const monthlyStats = await db.query(`
      SELECT 
        YEAR(start_date) as year,
        MONTH(start_date) as month,
        COUNT(*) as total_permissions,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
      ${baseQuery}
      GROUP BY YEAR(start_date), MONTH(start_date)
      ORDER BY year DESC, month DESC
    `, params);

    // Top des employés avec le plus de permissions
    const topEmployees = await db.query(`
      SELECT 
        e.id,
        e.name,
        e.department,
        COUNT(p.id) as total_permissions,
        COUNT(CASE WHEN p.status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN p.status = 'pending' THEN 1 END) as pending_count
      ${baseQuery}
      GROUP BY e.id, e.name, e.department
      ORDER BY total_permissions DESC
      LIMIT 10
    `, params);

    res.json({
      success: true,
      data: {
        period: { start_date, end_date },
        general: generalStats[0],
        monthly: monthlyStats,
        top_employees: topEmployees
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques des permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques des permissions'
    });
  }
});



module.exports = router;

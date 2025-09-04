const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');

// GET /api/reports - Générer des rapports personnalisés
router.get('/', async (req, res) => {
  try {
    const { 
      type = 'daily',
      start_date, 
      end_date, 
      employee_id,
      department,
      format = 'json'
    } = req.query;

    let startDate, endDate;

    // Définir les dates selon le type de rapport
    switch (type) {
      case 'daily':
        startDate = endDate = moment().format('YYYY-MM-DD');
        break;
      case 'weekly':
        startDate = moment().startOf('week').format('YYYY-MM-DD');
        endDate = moment().endOf('week').format('YYYY-MM-DD');
        break;
      case 'monthly':
        startDate = moment().startOf('month').format('YYYY-MM-DD');
        endDate = moment().endOf('month').format('YYYY-MM-DD');
        break;
      case 'yearly':
        startDate = moment().startOf('year').format('YYYY-MM-DD');
        endDate = moment().endOf('year').format('YYYY-MM-DD');
        break;
      case 'custom':
        startDate = start_date || moment().startOf('month').format('YYYY-MM-DD');
        endDate = end_date || moment().endOf('month').format('YYYY-MM-DD');
        break;
      default:
        startDate = endDate = moment().format('YYYY-MM-DD');
    }

    // Construire la requête de base
    let baseQuery = `
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.date BETWEEN ? AND ? AND e.is_active = 1
    `;
    const params = [startDate, endDate];

    if (employee_id) {
      baseQuery += ' AND a.employee_id = ?';
      params.push(employee_id);
    }

    if (department) {
      baseQuery += ' AND e.department = ?';
      params.push(department);
    }

    // Récupérer les données de présence
    const attendanceData = await db.query(`
      SELECT 
        a.*,
        e.name as employee_name,
        e.department,
        e.position
      ${baseQuery}
      ORDER BY a.date DESC, e.name ASC
    `, params);

    // Statistiques générales
    const generalStats = await db.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT a.employee_id) as unique_employees,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days,
        COUNT(CASE WHEN a.status = 'permission' THEN 1 END) as permission_days,
        AVG(a.total_work_hours) as avg_work_hours,
        SUM(a.total_work_hours) as total_work_hours,
        ROUND((COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) * 100.0 / COUNT(*)), 2) as attendance_rate
      ${baseQuery}
    `, params);

    // Statistiques par employé
    const employeeStats = await db.query(`
      SELECT 
        e.id,
        e.name,
        e.department,
        e.position,
        COUNT(a.id) as total_days,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days,
        COUNT(CASE WHEN a.status = 'permission' THEN 1 END) as permission_days,
        AVG(a.total_work_hours) as avg_work_hours,
        SUM(a.total_work_hours) as total_work_hours,
        ROUND((COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) * 100.0 / COUNT(a.id)), 2) as attendance_rate
      ${baseQuery}
      GROUP BY e.id, e.name, e.department, e.position
      ORDER BY attendance_rate DESC
    `, params);

    // Statistiques par département
    const departmentStats = await db.query(`
      SELECT 
        e.department,
        COUNT(DISTINCT e.id) as employee_count,
        COUNT(a.id) as total_days,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days,
        AVG(a.total_work_hours) as avg_work_hours,
        ROUND((COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) * 100.0 / COUNT(a.id)), 2) as attendance_rate
      ${baseQuery}
      GROUP BY e.department
      ORDER BY attendance_rate DESC
    `, params);

    // Tendances quotidiennes
    const dailyTrends = await db.query(`
      SELECT 
        a.date,
        COUNT(*) as total_employees,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
        AVG(a.total_work_hours) as avg_work_hours
      ${baseQuery}
      GROUP BY a.date
      ORDER BY a.date DESC
    `, params);

    // Permissions dans la période
    const permissionsInPeriod = await db.query(`
      SELECT 
        p.*,
        e.name as employee_name,
        e.department
      FROM permissions p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.start_date <= ? AND p.end_date >= ? AND e.is_active = 1
      ORDER BY p.start_date DESC
    `, [endDate, startDate]);

    const reportData = {
      metadata: {
        type,
        period: { start_date: startDate, end_date: endDate },
        generated_at: new Date().toISOString(),
        filters: { employee_id, department }
      },
      summary: generalStats[0],
      employees: employeeStats,
      departments: departmentStats,
      daily_trends: dailyTrends,
      permissions: permissionsInPeriod,
      raw_data: attendanceData
    };

    // Sauvegarder le rapport en base
    await db.query(`
      INSERT INTO reports (type, period_start, period_end, data, generated_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [type, startDate, endDate, JSON.stringify(reportData)]);

    res.json({
      success: true,
      data: reportData
    });

  } catch (error) {
    console.error('Erreur lors de la génération du rapport:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la génération du rapport'
    });
  }
});

// GET /api/reports/export - Exporter un rapport en CSV
router.get('/export', async (req, res) => {
  try {
    const { 
      type = 'daily',
      start_date, 
      end_date, 
      employee_id,
      department 
    } = req.query;

    let startDate, endDate;

    switch (type) {
      case 'daily':
        startDate = endDate = moment().format('YYYY-MM-DD');
        break;
      case 'weekly':
        startDate = moment().startOf('week').format('YYYY-MM-DD');
        endDate = moment().endOf('week').format('YYYY-MM-DD');
        break;
      case 'monthly':
        startDate = moment().startOf('month').format('YYYY-MM-DD');
        endDate = moment().endOf('month').format('YYYY-MM-DD');
        break;
      case 'custom':
        startDate = start_date || moment().startOf('month').format('YYYY-MM-DD');
        endDate = end_date || moment().endOf('month').format('YYYY-MM-DD');
        break;
      default:
        startDate = endDate = moment().format('YYYY-MM-DD');
    }

    let query = `
      SELECT 
        a.date,
        e.name as employee_name,
        e.department,
        e.position,
        a.arrival_time,
        a.departure_time,
        a.lunch_start,
        a.lunch_end,
        a.total_work_hours,
        a.status,
        a.notes
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.date BETWEEN ? AND ? AND e.is_active = 1
    `;
    const params = [startDate, endDate];

    if (employee_id) {
      query += ' AND a.employee_id = ?';
      params.push(employee_id);
    }

    if (department) {
      query += ' AND e.department = ?';
      params.push(department);
    }

    query += ' ORDER BY a.date DESC, e.name ASC';

    const data = await db.query(query, params);

    // Générer le CSV
    let csv = 'Date,Nom Employé,Département,Poste,Arrivée,Départ,Pause Début,Pause Fin,Heures Travaillées,Statut,Notes\n';
    
    data.forEach(row => {
      csv += `"${row.date}","${row.employee_name}","${row.department || ''}","${row.position || ''}","${row.arrival_time || ''}","${row.departure_time || ''}","${row.lunch_start || ''}","${row.lunch_end || ''}","${row.total_work_hours || ''}","${row.status}","${row.notes || ''}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="rapport_presence_${type}_${startDate}_${endDate}.csv"`);
    res.send(csv);

  } catch (error) {
    console.error('Erreur lors de l\'export du rapport:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'export du rapport'
    });
  }
});

// GET /api/reports/history - Historique des rapports générés
router.get('/history', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const reports = await db.query(`
      SELECT 
        r.*,
        e.name as generated_by_name
      FROM reports r
      LEFT JOIN employees e ON r.generated_by = e.id
      ORDER BY r.generated_at DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), offset]);

    const totalResult = await db.query('SELECT COUNT(*) as total FROM reports');
    const total = totalResult[0].total;

    res.json({
      success: true,
      data: reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'historique des rapports'
    });
  }
});

// GET /api/reports/:id - Récupérer un rapport spécifique
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const report = await db.query(`
      SELECT 
        r.*,
        e.name as generated_by_name
      FROM reports r
      LEFT JOIN employees e ON r.generated_by = e.id
      WHERE r.id = ?
    `, [id]);

    if (report.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rapport non trouvé'
      });
    }

    // Parser les données JSON
    const reportData = report[0];
    if (reportData.data) {
      reportData.data = JSON.parse(reportData.data);
    }

    res.json({
      success: true,
      data: reportData
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du rapport:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du rapport'
    });
  }
});

// DELETE /api/reports/:id - Supprimer un rapport
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM reports WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rapport non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Rapport supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du rapport:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du rapport'
    });
  }
});

module.exports = router;

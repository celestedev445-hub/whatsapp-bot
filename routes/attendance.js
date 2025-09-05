const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');

// GET /api/attendance - Récupérer les présences avec filtres
router.get('/', async (req, res) => {
  try {
    const { 
      start_date, 
      end_date, 
      employee_id, 
      status, 
      department,
      page = 1, 
      limit = 50 
    } = req.query;

    const groupId = process.env.WHATSAPP_GROUP_ID;
    
    let query = `
      SELECT 
        a.*,
        e.name as employee_name,
        e.position,
        e.department,
        e.phone
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.group_id = ? AND e.is_active = 1
    `;
    const params = [groupId];

    if (start_date) {
      query += ' AND a.date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND a.date <= ?';
      params.push(end_date);
    }

    if (employee_id) {
      query += ' AND a.employee_id = ?';
      params.push(parseInt(employee_id));
    }

    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }

    if (department) {
      query += ' AND e.department = ?';
      params.push(department);
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;
    query += ` ORDER BY a.date DESC, e.name ASC LIMIT ${limitNum} OFFSET ${offset}`;

    const attendance = await db.query(query, params);

    // Compter le total pour la pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.group_id = ? AND e.is_active = 1
    `;
    const countParams = [groupId];

    if (start_date) {
      countQuery += ' AND a.date >= ?';
      countParams.push(start_date);
    }

    if (end_date) {
      countQuery += ' AND a.date <= ?';
      countParams.push(end_date);
    }

    if (employee_id) {
      countQuery += ' AND a.employee_id = ?';
      countParams.push(parseInt(employee_id));
    }

    if (status) {
      countQuery += ' AND a.status = ?';
      countParams.push(status);
    }

    if (department) {
      countQuery += ' AND e.department = ?';
      countParams.push(department);
    }

    const totalResult = await db.query(countQuery, countParams);
    const total = totalResult[0].total;

    res.json(attendance);
  } catch (error) {
    console.error('Erreur lors de la récupération des présences:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des présences'
    });
  }
});

// GET /api/attendance/today - Récupérer les présences du jour
router.get('/today', async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');

    const attendance = await db.query(`
      SELECT 
        a.*,
        e.name as employee_name,
        e.position,
        e.department,
        e.phone
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.date = ? AND e.is_active = 1
      ORDER BY e.name
    `, [today]);

    // Statistiques du jour
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_employees,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
        COUNT(CASE WHEN a.arrival_time IS NOT NULL THEN 1 END) as arrived_count,
        COUNT(CASE WHEN a.departure_time IS NOT NULL THEN 1 END) as departed_count
      FROM employees e
      LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = ?
      WHERE e.is_active = 1
    `, [today]);

    res.json({
      success: true,
      data: {
        attendance,
        statistics: stats[0],
        date: today
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des présences du jour:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des présences du jour'
    });
  }
});

// GET /api/attendance/statistics - Statistiques de présence
router.get('/statistics', async (req, res) => {
  try {
    const { 
      start_date = moment().startOf('month').format('YYYY-MM-DD'),
      end_date = moment().endOf('month').format('YYYY-MM-DD'),
      employee_id,
      department 
    } = req.query;

    let baseQuery = `
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.date BETWEEN ? AND ? AND e.is_active = 1
    `;
    const params = [start_date, end_date];

    if (employee_id) {
      baseQuery += ' AND a.employee_id = ?';
      params.push(parseInt(employee_id));
    }

    if (department) {
      baseQuery += ' AND e.department = ?';
      params.push(department);
    }

    // Statistiques générales
    const generalStats = await db.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN status = 'late' THEN 1 END) as late_days,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_days,
        COUNT(CASE WHEN status = 'permission' THEN 1 END) as permission_days,
        AVG(total_work_hours) as avg_work_hours,
        SUM(total_work_hours) as total_work_hours
      ${baseQuery}
    `, params);

    // Statistiques par employé
    const employeeStats = await db.query(`
      SELECT 
        e.id,
        e.name,
        e.department,
        COUNT(a.id) as total_days,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days,
        AVG(a.total_work_hours) as avg_work_hours,
        SUM(a.total_work_hours) as total_work_hours,
        ROUND((COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) * 100.0 / COUNT(a.id)), 2) as attendance_rate
      ${baseQuery}
      GROUP BY e.id, e.name, e.department
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

    // Tendances hebdomadaires
    const weeklyTrends = await db.query(`
      SELECT 
        YEAR(a.date) as year,
        WEEK(a.date) as week,
        COUNT(*) as total_days,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days,
        AVG(a.total_work_hours) as avg_work_hours
      ${baseQuery}
      GROUP BY YEAR(a.date), WEEK(a.date)
      ORDER BY year DESC, week DESC
      LIMIT 12
    `, params);

    res.json({
      success: true,
      data: {
        period: { start_date, end_date },
        general: generalStats[0],
        by_employee: employeeStats,
        by_department: departmentStats,
        weekly_trends: weeklyTrends
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// POST /api/attendance - Créer ou mettre à jour une présence
router.post('/', async (req, res) => {
  try {
    const { 
      employee_id, 
      date, 
      arrival_time, 
      departure_time, 
      lunch_start, 
      lunch_end, 
      status, 
      notes 
    } = req.body;

    if (!employee_id || !date) {
      return res.status(400).json({
        success: false,
        error: 'L\'ID employé et la date sont obligatoires'
      });
    }

    // Vérifier si l'employé existe
    const employee = await db.query('SELECT * FROM employees WHERE id = ? AND is_active = 1', [parseInt(employee_id)]);
    if (employee.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Employé non trouvé'
      });
    }

    // Vérifier si une présence existe déjà pour cette date
    const existingAttendance = await db.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [parseInt(employee_id), date]
    );

    // Calculer les heures de travail si nécessaire
    let total_work_hours = null;
    if (arrival_time && departure_time) {
      const arrival = moment(arrival_time, 'HH:mm:ss');
      const departure = moment(departure_time, 'HH:mm:ss');
      let hours = departure.diff(arrival, 'hours', true);
      
      if (lunch_start && lunch_end) {
        const lunchStart = moment(lunch_start, 'HH:mm:ss');
        const lunchEnd = moment(lunch_end, 'HH:mm:ss');
        const lunchDuration = lunchEnd.diff(lunchStart, 'hours', true);
        hours -= lunchDuration;
      }
      
      total_work_hours = hours;
    }

    if (existingAttendance.length > 0) {
      // Mettre à jour la présence existante
      await db.query(`
        UPDATE attendance 
        SET arrival_time = ?, departure_time = ?, lunch_start = ?, lunch_end = ?, 
            total_work_hours = ?, status = ?, notes = ?, updated_at = NOW()
        WHERE employee_id = ? AND date = ?
      `, [
        arrival_time || existingAttendance[0].arrival_time,
        departure_time || existingAttendance[0].departure_time,
        lunch_start || existingAttendance[0].lunch_start,
        lunch_end || existingAttendance[0].lunch_end,
        total_work_hours || existingAttendance[0].total_work_hours,
        status || existingAttendance[0].status,
        notes || existingAttendance[0].notes,
        parseInt(employee_id),
        date
      ]);
    } else {
      // Créer une nouvelle présence
      await db.query(`
        INSERT INTO attendance 
        (employee_id, date, arrival_time, departure_time, lunch_start, lunch_end, total_work_hours, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        parseInt(employee_id), date, arrival_time, departure_time, lunch_start, lunch_end, 
        total_work_hours, status || 'present', notes
      ]);
    }

    const updatedAttendance = await db.query(`
      SELECT a.*, e.name as employee_name 
      FROM attendance a 
      JOIN employees e ON a.employee_id = e.id 
      WHERE a.employee_id = ? AND a.date = ?
    `, [parseInt(employee_id), date]);

    res.json({
      success: true,
      data: updatedAttendance[0],
      message: 'Présence enregistrée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la présence:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'enregistrement de la présence'
    });
  }
});

// PUT /api/attendance/:id - Mettre à jour une présence spécifique
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      arrival_time, 
      departure_time, 
      lunch_start, 
      lunch_end, 
      status, 
      notes 
    } = req.body;

    // Vérifier si la présence existe
    const existingAttendance = await db.query('SELECT * FROM attendance WHERE id = ?', [id]);
    if (existingAttendance.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Présence non trouvée'
      });
    }

    // Calculer les heures de travail
    let total_work_hours = existingAttendance[0].total_work_hours;
    const arrival = arrival_time || existingAttendance[0].arrival_time;
    const departure = departure_time || existingAttendance[0].departure_time;
    const lunchStart = lunch_start || existingAttendance[0].lunch_start;
    const lunchEnd = lunch_end || existingAttendance[0].lunch_end;

    if (arrival && departure) {
      const arrivalMoment = moment(arrival, 'HH:mm:ss');
      const departureMoment = moment(departure, 'HH:mm:ss');
      let hours = departureMoment.diff(arrivalMoment, 'hours', true);
      
      if (lunchStart && lunchEnd) {
        const lunchStartMoment = moment(lunchStart, 'HH:mm:ss');
        const lunchEndMoment = moment(lunchEnd, 'HH:mm:ss');
        const lunchDuration = lunchEndMoment.diff(lunchStartMoment, 'hours', true);
        hours -= lunchDuration;
      }
      
      total_work_hours = hours;
    }

    await db.query(`
      UPDATE attendance 
      SET arrival_time = ?, departure_time = ?, lunch_start = ?, lunch_end = ?, 
          total_work_hours = ?, status = ?, notes = ?, updated_at = NOW()
      WHERE id = ?
    `, [
      arrival_time || existingAttendance[0].arrival_time,
      departure_time || existingAttendance[0].departure_time,
      lunch_start || existingAttendance[0].lunch_start,
      lunch_end || existingAttendance[0].lunch_end,
      total_work_hours,
      status || existingAttendance[0].status,
      notes || existingAttendance[0].notes,
      id
    ]);

    const updatedAttendance = await db.query(`
      SELECT a.*, e.name as employee_name 
      FROM attendance a 
      JOIN employees e ON a.employee_id = e.id 
      WHERE a.id = ?
    `, [id]);

    res.json({
      success: true,
      data: updatedAttendance[0],
      message: 'Présence mise à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la présence:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour de la présence'
    });
  }
});

// DELETE /api/attendance/:id - Supprimer une présence
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM attendance WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Présence non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Présence supprimée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de la présence:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression de la présence'
    });
  }
});

// GET /api/attendance/recent - Récupérer les présences récentes
router.get('/recent', async (req, res) => {
  try {
    console.log('🔍 Récupération des présences récentes...');
    
    const groupId = process.env.WHATSAPP_GROUP_ID;
    console.log('Group ID:', groupId);
    
    // Requête avec jointure pour récupérer les noms des employés
    const recentAttendance = await db.query(`
      SELECT 
        a.*,
        e.name as employee_name,
        e.position,
        e.department,
        e.phone
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.group_id = ? AND e.is_active = 1
      ORDER BY a.created_at DESC 
      LIMIT 10
    `, [groupId]);

    console.log(`✅ ${recentAttendance.length} présences récentes trouvées`);
    console.log('Données:', recentAttendance);
    res.json(recentAttendance);
  } catch (error) {
    console.error('Erreur lors de la récupération des présences récentes:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// GET /api/attendance/stats - Récupérer les statistiques de présence
router.get('/stats', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    console.log('📊 Récupération des statistiques de présence...');
    
    let whereClause = '';
    const params = [];
    
    if (start_date) {
      whereClause += ' AND a.date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      whereClause += ' AND a.date <= ?';
      params.push(end_date);
    }
    
    const stats = await db.query(`
      SELECT 
        COUNT(DISTINCT a.employee_id) as total_employees,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
        COUNT(CASE WHEN a.status = 'permission' THEN 1 END) as permission_count
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.is_active = 1 ${whereClause}
    `, params);

    console.log('✅ Statistiques récupérées');
    res.json(stats[0] || {
      total_employees: 0,
      present_count: 0,
      absent_count: 0,
      late_count: 0,
      permission_count: 0
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

module.exports = router;

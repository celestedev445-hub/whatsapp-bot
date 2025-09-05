const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// Récupérer tous les départements
router.get('/', async (req, res) => {
  try {
    console.log('🔍 Tentative de récupération des départements...');
    
    const departments = await query(`
      SELECT d.*, 
             COUNT(e.id) as employee_count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id AND e.is_active = 1
      GROUP BY d.id
      ORDER BY d.name
    `);
    
    console.log('✅ Départements récupérés:', departments.length);
    res.json(departments);
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des départements:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// Récupérer un département par ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const departments = await query(`
      SELECT d.*, 
             COUNT(e.id) as employee_count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id AND e.is_active = 1
      WHERE d.id = ?
      GROUP BY d.id
    `, [id]);
    
    if (departments.length === 0) {
      return res.status(404).json({ error: 'Département non trouvé' });
    }
    
    res.json(departments[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération du département:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer les employés d'un département
router.get('/:id/employees', async (req, res) => {
  try {
    const { id } = req.params;
    
    const employees = await query(`
      SELECT e.*, d.name as department_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.department_id = ? AND e.is_active = 1
      ORDER BY e.name
    `, [id]);
    
    res.json(employees);
  } catch (error) {
    console.error('Erreur lors de la récupération des employés du département:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un nouveau département
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Le nom du département est requis' });
    }
    
    const result = await query(`
      INSERT INTO departments (name, description) VALUES (?, ?)
    `, [name, description || null]);
    
    res.status(201).json({ 
      id: result.insertId, 
      message: 'Département créé avec succès' 
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Un département avec ce nom existe déjà' });
    }
    console.error('Erreur lors de la création du département:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour un département
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Le nom du département est requis' });
    }
    
    const result = await query(`
      UPDATE departments 
      SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, description || null, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Département non trouvé' });
    }
    
    res.json({ message: 'Département mis à jour avec succès' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Un département avec ce nom existe déjà' });
    }
    console.error('Erreur lors de la mise à jour du département:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un département
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier s'il y a des employés dans ce département
    const employees = await query(`
      SELECT COUNT(*) as count FROM employees WHERE department_id = ?
    `, [id]);
    
    if (employees[0].count > 0) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer ce département car il contient des employés' 
      });
    }
    
    const result = await query(`
      DELETE FROM departments WHERE id = ?
    `, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Département non trouvé' });
    }
    
    res.json({ message: 'Département supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du département:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


module.exports = router;

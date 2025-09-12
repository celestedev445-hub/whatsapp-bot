const db = require('../config/database');

async function checkData() {
  try {
    console.log('🔍 Vérification des données dans la base...\n');

    // Vérifier les départements
    const departments = await db.query('SELECT * FROM departments ORDER BY id');
    console.log(`📁 Départements (${departments.length}):`);
    departments.forEach(dept => {
      console.log(`  - ${dept.name} (ID: ${dept.id})`);
    });

    // Vérifier les employés
    const employees = await db.query(`
      SELECT e.*, d.name as department_name 
      FROM employees e 
      LEFT JOIN departments d ON e.department_id = d.id 
      ORDER BY e.id
    `);
    console.log(`\n👥 Employés (${employees.length}):`);
    employees.forEach(emp => {
      console.log(`  - ${emp.name} (${emp.position || 'Sans poste'}) - Département: ${emp.department_name || 'Aucun'} (ID: ${emp.department_id || 'NULL'}) - Actif: ${emp.is_active ? 'Oui' : 'Non'}`);
    });

    // Vérifier les employés actifs par département
    console.log(`\n📊 Employés actifs par département:`);
    const deptStats = await db.query(`
      SELECT 
        d.id,
        d.name,
        COUNT(e.id) as employee_count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id AND e.is_active = 1
      GROUP BY d.id, d.name
      ORDER BY d.id
    `);
    
    deptStats.forEach(stat => {
      console.log(`  - ${stat.name}: ${stat.employee_count} employé(s) actif(s)`);
    });

    console.log('\n✅ Vérification terminée !');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
    process.exit(1);
  }
}

checkData();

const db = require('../config/database');

async function createTestData() {
  try {
    console.log('🔧 Création des données de test...');

    // Créer des départements de test
    const departments = [
      { name: 'Ressources Humaines', description: 'Gestion du personnel' },
      { name: 'Informatique', description: 'Développement et maintenance' },
      { name: 'Comptabilité', description: 'Gestion financière' },
      { name: 'Marketing', description: 'Communication et promotion' }
    ];

    console.log('📁 Création des départements...');
    for (const dept of departments) {
      const result = await db.query(
        'INSERT INTO departments (name, description, created_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE name = name',
        [dept.name, dept.description]
      );
      console.log(`✅ Département "${dept.name}" créé/mis à jour`);
    }

    // Récupérer les IDs des départements
    const deptResults = await db.query('SELECT id, name FROM departments ORDER BY id');
    console.log('📋 Départements disponibles:', deptResults);

    // Créer des employés de test
    const employees = [
      { name: 'Jean Dupont', phone: '1234567890', position: 'Manager RH', department_id: deptResults[0].id },
      { name: 'Marie Martin', phone: '1234567891', position: 'Développeuse', department_id: deptResults[1].id },
      { name: 'Pierre Durand', phone: '1234567892', position: 'Comptable', department_id: deptResults[2].id },
      { name: 'Sophie Bernard', phone: '1234567893', position: 'Marketing Manager', department_id: deptResults[3].id },
      { name: 'Lucas Moreau', phone: '1234567894', position: 'Développeur', department_id: deptResults[1].id },
      { name: 'Emma Petit', phone: '1234567895', position: 'Assistant RH', department_id: deptResults[0].id }
    ];

    console.log('👥 Création des employés...');
    for (const emp of employees) {
      const result = await db.query(
        'INSERT INTO employees (name, phone, position, department_id, is_active, created_at) VALUES (?, ?, ?, ?, 1, NOW()) ON DUPLICATE KEY UPDATE name = name',
        [emp.name, emp.phone, emp.position, emp.department_id]
      );
      console.log(`✅ Employé "${emp.name}" créé/mis à jour`);
    }

    // Vérifier les données créées
    console.log('\n📊 Vérification des données...');
    
    const finalDepts = await db.query('SELECT * FROM departments');
    const finalEmps = await db.query(`
      SELECT e.*, d.name as department_name 
      FROM employees e 
      LEFT JOIN departments d ON e.department_id = d.id 
      WHERE e.is_active = 1
    `);

    console.log(`\n✅ ${finalDepts.length} départements créés:`);
    finalDepts.forEach(dept => {
      console.log(`  - ${dept.name} (ID: ${dept.id})`);
    });

    console.log(`\n✅ ${finalEmps.length} employés créés:`);
    finalEmps.forEach(emp => {
      console.log(`  - ${emp.name} (${emp.position}) - Département: ${emp.department_name} (ID: ${emp.department_id})`);
    });

    console.log('\n🎉 Données de test créées avec succès !');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur lors de la création des données de test:', error);
    process.exit(1);
  }
}

createTestData();

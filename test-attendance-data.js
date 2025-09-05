/**
 * Script de test pour vérifier les données d'attendance
 */

const db = require('./config/database');

async function testAttendanceData() {
  try {
    console.log('🔍 Test des données d\'attendance...\n');

    // Test 1: Vérifier la structure des données d'attendance
    console.log('Test 1: Récupération des données d\'attendance avec jointure');
    const attendanceData = await db.query(`
      SELECT 
        a.*,
        e.name as employee_name,
        e.position,
        e.department,
        e.phone
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.is_active = 1
      ORDER BY a.created_at DESC 
      LIMIT 5
    `);

    console.log(`✅ ${attendanceData.length} enregistrements d'attendance trouvés`);
    
    if (attendanceData.length > 0) {
      console.log('\n📋 Structure des données:');
      console.log('========================');
      const sample = attendanceData[0];
      console.log(`ID: ${sample.id}`);
      console.log(`Employee ID: ${sample.employee_id}`);
      console.log(`Employee Name: ${sample.employee_name || 'NON DÉFINI'}`);
      console.log(`Position: ${sample.position || 'NON DÉFINI'}`);
      console.log(`Department: ${sample.department || 'NON DÉFINI'}`);
      console.log(`Phone: ${sample.phone || 'NON DÉFINI'}`);
      console.log(`Date: ${sample.date}`);
      console.log(`Status: ${sample.status}`);
      console.log(`Arrival Time: ${sample.arrival_time || 'Non marqué'}`);
      console.log(`Departure Time: ${sample.departure_time || 'Non marqué'}`);
    } else {
      console.log('⚠️ Aucune donnée d\'attendance trouvée');
    }

    // Test 2: Vérifier les employés actifs
    console.log('\nTest 2: Vérification des employés actifs');
    const employees = await db.query(`
      SELECT id, name, position, department, phone, is_active, group_id
      FROM employees 
      WHERE is_active = 1
      ORDER BY name
    `);

    console.log(`✅ ${employees.length} employés actifs trouvés`);
    
    if (employees.length > 0) {
      console.log('\n👥 Employés actifs:');
      employees.forEach(emp => {
        console.log(`- ${emp.name} (ID: ${emp.id}, Poste: ${emp.position || 'N/A'}, Groupe: ${emp.group_id || 'N/A'})`);
      });
    }

    console.log('\n✅ Tests terminés - Les données d\'attendance devraient maintenant afficher les noms correctement');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
  } finally {
    process.exit(0);
  }
}

// Exécuter les tests si le script est lancé directement
if (require.main === module) {
  testAttendanceData();
}

module.exports = { testAttendanceData };

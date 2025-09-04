const cron = require('node-cron');
const moment = require('moment');
const db = require('../config/database');
const whatsappBot = require('./whatsappBot');

class CronJobs {
  constructor() {
    this.jobs = [];
  }

  start() {
    console.log('🕐 Démarrage des tâches automatiques...');

    // Rapport quotidien à 18h00
    this.jobs.push(
      cron.schedule('0 18 * * *', async () => {
        await this.sendDailyReport();
      }, {
        scheduled: true,
        timezone: "Europe/Paris"
      })
    );

    // Vérification des retards à 8h15
    this.jobs.push(
      cron.schedule('15 8 * * *', async () => {
        await this.checkLateArrivals();
      }, {
        scheduled: true,
        timezone: "Europe/Paris"
      })
    );

    // Rappel de marquer le départ à 17h30
    this.jobs.push(
      cron.schedule('30 17 * * *', async () => {
        await this.remindDeparture();
      }, {
        scheduled: true,
        timezone: "Europe/Paris"
      })
    );

    // Nettoyage des anciens messages (tous les dimanches à 2h00)
    this.jobs.push(
      cron.schedule('0 2 * * 0', async () => {
        await this.cleanupOldMessages();
      }, {
        scheduled: true,
        timezone: "Europe/Paris"
      })
    );

    // Rapport hebdomadaire le vendredi à 17h00
    this.jobs.push(
      cron.schedule('0 17 * * 5', async () => {
        await this.sendWeeklyReport();
      }, {
        scheduled: true,
        timezone: "Europe/Paris"
      })
    );

    // Vérification des permissions en attente (tous les jours à 9h00)
    this.jobs.push(
      cron.schedule('0 9 * * *', async () => {
        await this.checkPendingPermissions();
      }, {
        scheduled: true,
        timezone: "Europe/Paris"
      })
    );

    console.log(`✅ ${this.jobs.length} tâches automatiques programmées`);
  }

  async sendDailyReport() {
    try {
      if (!whatsappBot.isReady) {
        console.log('Bot WhatsApp non disponible pour le rapport quotidien');
        return;
      }

      const today = moment().format('YYYY-MM-DD');
      const adminPhone = process.env.ADMIN_PHONE;

      if (!adminPhone) {
        console.log('Numéro admin non configuré pour le rapport quotidien');
        return;
      }

      // Récupérer les présences du jour
      const attendances = await db.query(`
        SELECT e.name, e.phone, a.* 
        FROM attendance a 
        JOIN employees e ON a.employee_id = e.id 
        WHERE a.date = ? 
        ORDER BY e.name
      `, [today]);

      // Statistiques
      const totalEmployees = await db.query('SELECT COUNT(*) as count FROM employees WHERE is_active = 1');
      const presentCount = attendances.filter(att => att.status === 'present' || att.status === 'late').length;
      const absentCount = attendances.filter(att => att.status === 'absent').length;
      const lateCount = attendances.filter(att => att.status === 'late').length;

      let report = `📊 RAPPORT QUOTIDIEN - ${today}\n\n`;
      report += `📈 STATISTIQUES:\n`;
      report += `• Total employés: ${totalEmployees[0].count}\n`;
      report += `• Présents: ${presentCount}\n`;
      report += `• Absents: ${absentCount}\n`;
      report += `• Retards: ${lateCount}\n\n`;

      report += `👥 DÉTAIL DES PRÉSENCES:\n`;
      
      if (attendances.length === 0) {
        report += 'Aucune présence enregistrée aujourd\'hui.\n';
      } else {
        attendances.forEach(att => {
          const statusEmoji = {
            'present': '✅',
            'late': '⚠️',
            'absent': '❌',
            'permission': '📋'
          };
          
          report += `${statusEmoji[att.status] || '❓'} ${att.name}`;
          
          if (att.arrival_time) report += ` (Arrivée: ${att.arrival_time})`;
          if (att.departure_time) report += ` (Départ: ${att.departure_time})`;
          if (att.total_work_hours) report += ` (${att.total_work_hours}h)`;
          
          report += '\n';
        });
      }

      // Permissions en attente
      const pendingPermissions = await db.query(`
        SELECT p.*, e.name as employee_name
        FROM permissions p
        JOIN employees e ON p.employee_id = e.id
        WHERE p.status = 'pending'
        ORDER BY p.created_at DESC
      `);

      if (pendingPermissions.length > 0) {
        report += `\n📋 PERMISSIONS EN ATTENTE (${pendingPermissions.length}):\n`;
        pendingPermissions.forEach(perm => {
          report += `• ${perm.employee_name}: ${perm.type} du ${perm.start_date} au ${perm.end_date}\n`;
        });
      }

      await whatsappBot.client.sendMessage(adminPhone, report);
      console.log('✅ Rapport quotidien envoyé');

    } catch (error) {
      console.error('Erreur lors de l\'envoi du rapport quotidien:', error);
    }
  }

  async checkLateArrivals() {
    try {
      if (!whatsappBot.isReady) return;

      const today = moment().format('YYYY-MM-DD');
      const workStartTime = await db.query('SELECT setting_value FROM system_settings WHERE setting_key = ?', ['work_start_time']);
      const lateThreshold = await db.query('SELECT setting_value FROM system_settings WHERE setting_key = ?', ['late_threshold_minutes']);
      
      const startTime = workStartTime[0]?.setting_value || '08:00';
      const threshold = parseInt(lateThreshold[0]?.setting_value || '15');

      // Trouver les employés qui n'ont pas encore marqué leur arrivée
      const lateEmployees = await db.query(`
        SELECT e.name, e.phone
        FROM employees e
        LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = ?
        WHERE e.is_active = 1 
        AND (a.id IS NULL OR a.arrival_time IS NULL)
      `, [today]);

      if (lateEmployees.length > 0) {
        const adminPhone = process.env.ADMIN_PHONE;
        if (adminPhone) {
          let message = `⚠️ EMPLOYÉS EN RETARD - ${today}\n\n`;
          message += `Les employés suivants n'ont pas encore marqué leur arrivée:\n\n`;
          
          lateEmployees.forEach(emp => {
            message += `• ${emp.name}\n`;
          });
          
          message += `\nHeure de début prévue: ${startTime}`;
          
          await whatsappBot.client.sendMessage(adminPhone, message);
          console.log('✅ Notification de retard envoyée');
        }
      }

    } catch (error) {
      console.error('Erreur lors de la vérification des retards:', error);
    }
  }

  async remindDeparture() {
    try {
      if (!whatsappBot.isReady) return;

      const today = moment().format('YYYY-MM-DD');
      
      // Trouver les employés présents qui n'ont pas encore marqué leur départ
      const employeesToRemind = await db.query(`
        SELECT e.name, e.phone, a.arrival_time
        FROM employees e
        JOIN attendance a ON e.id = a.employee_id
        WHERE a.date = ? 
        AND a.arrival_time IS NOT NULL 
        AND a.departure_time IS NULL
        AND e.is_active = 1
      `, [today]);

      if (employeesToRemind.length > 0) {
        const groupId = process.env.WHATSAPP_GROUP_ID;
        if (groupId) {
          let message = `🔔 RAPPEL - N'oubliez pas de marquer votre départ!\n\n`;
          message += `Employés concernés:\n`;
          
          employeesToRemind.forEach(emp => {
            message += `• ${emp.name} (arrivée: ${emp.arrival_time})\n`;
          });
          
          await whatsappBot.client.sendMessage(groupId, message);
          console.log('✅ Rappel de départ envoyé');
        }
      }

    } catch (error) {
      console.error('Erreur lors du rappel de départ:', error);
    }
  }

  async sendWeeklyReport() {
    try {
      if (!whatsappBot.isReady) return;

      const adminPhone = process.env.ADMIN_PHONE;
      if (!adminPhone) return;

      const weekStart = moment().startOf('week').format('YYYY-MM-DD');
      const weekEnd = moment().endOf('week').format('YYYY-MM-DD');

      // Statistiques de la semaine
      const weeklyStats = await db.query(`
        SELECT 
          COUNT(DISTINCT a.employee_id) as total_employees,
          COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
          COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days,
          COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days,
          AVG(a.total_work_hours) as avg_work_hours
        FROM attendance a
        WHERE a.date BETWEEN ? AND ?
      `, [weekStart, weekEnd]);

      // Top des heures travaillées
      const topWorkers = await db.query(`
        SELECT e.name, SUM(a.total_work_hours) as total_hours
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        WHERE a.date BETWEEN ? AND ? AND a.total_work_hours IS NOT NULL
        GROUP BY a.employee_id, e.name
        ORDER BY total_hours DESC
        LIMIT 5
      `, [weekStart, weekEnd]);

      let report = `📊 RAPPORT HEBDOMADAIRE\n`;
      report += `📅 Semaine du ${weekStart} au ${weekEnd}\n\n`;
      
      if (weeklyStats[0]) {
        const stats = weeklyStats[0];
        report += `📈 STATISTIQUES:\n`;
        report += `• Jours de présence: ${stats.present_days}\n`;
        report += `• Jours de retard: ${stats.late_days}\n`;
        report += `• Jours d'absence: ${stats.absent_days}\n`;
        report += `• Heures moyennes/jour: ${stats.avg_work_hours ? parseFloat(stats.avg_work_hours).toFixed(2) : '0'}h\n\n`;
      }

      if (topWorkers.length > 0) {
        report += `🏆 TOP 5 - HEURES TRAVAILLÉES:\n`;
        topWorkers.forEach((worker, index) => {
          report += `${index + 1}. ${worker.name}: ${parseFloat(worker.total_hours).toFixed(2)}h\n`;
        });
      }

      await whatsappBot.client.sendMessage(adminPhone, report);
      console.log('✅ Rapport hebdomadaire envoyé');

    } catch (error) {
      console.error('Erreur lors de l\'envoi du rapport hebdomadaire:', error);
    }
  }

  async checkPendingPermissions() {
    try {
      if (!whatsappBot.isReady) return;

      const adminPhone = process.env.ADMIN_PHONE;
      if (!adminPhone) return;

      // Permissions en attente depuis plus de 2 jours
      const oldPendingPermissions = await db.query(`
        SELECT p.*, e.name as employee_name
        FROM permissions p
        JOIN employees e ON p.employee_id = e.id
        WHERE p.status = 'pending' 
        AND p.created_at < DATE_SUB(NOW(), INTERVAL 2 DAY)
        ORDER BY p.created_at ASC
      `);

      if (oldPendingPermissions.length > 0) {
        let message = `⏰ RAPPEL - Permissions en attente depuis plus de 2 jours:\n\n`;
        
        oldPendingPermissions.forEach(perm => {
          const daysPending = moment().diff(moment(perm.created_at), 'days');
          message += `• ${perm.employee_name}: ${perm.type} (${daysPending} jours)\n`;
        });
        
        message += `\nVeuillez traiter ces demandes.`;
        
        await whatsappBot.client.sendMessage(adminPhone, message);
        console.log('✅ Rappel des permissions en attente envoyé');
      }

    } catch (error) {
      console.error('Erreur lors de la vérification des permissions:', error);
    }
  }

  async cleanupOldMessages() {
    try {
      // Supprimer les messages de plus de 30 jours
      const result = await db.query(
        'DELETE FROM messages WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)'
      );
      
      console.log(`🧹 Nettoyage: ${result.affectedRows} anciens messages supprimés`);

    } catch (error) {
      console.error('Erreur lors du nettoyage des messages:', error);
    }
  }

  stop() {
    this.jobs.forEach(job => job.destroy());
    this.jobs = [];
    console.log('🛑 Tâches automatiques arrêtées');
  }
}

module.exports = new CronJobs();

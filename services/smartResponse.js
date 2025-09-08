const db = require('../config/database');
const moment = require('moment');

class SmartResponseService {
  constructor() {
    this.responseTemplates = {
      attendance: {
        arrival: [
          "✅ Arrivée enregistrée{time}. Bonne journée !",
          "👋 Parfait ! Arrivée notée{time}. Passez une excellente journée !",
          "✅ C'est noté ! Bonne journée de travail{time} !"
        ],
        departure: [
          "✅ Départ enregistré{time}. À bientôt !",
          "👋 Parfait ! Bonne soirée{time} !",
          "✅ C'est noté ! À demain{time} !"
        ],
        lunch_break: [
          "🍽️ Pause déjeuner enregistrée. Bon appétit !",
          "🍴 Pause notée ! Profitez bien de votre repas !",
          "⏰ Pause déjeuner enregistrée. Bon appétit !"
        ],
        lunch_return: [
          "✅ Retour de pause enregistré. Bonne reprise !",
          "🔄 Parfait ! Bonne reprise de travail !",
          "✅ Retour noté ! Bonne continuation !"
        ],
        absence: [
          "📝 Absence enregistrée{reason}. Prenez soin de vous !",
          "🤒 Absence notée{reason}. Rétablissez-vous bien !",
          "📋 C'est noté{reason}. Bon rétablissement !"
        ]
      },
      permission: {
        created: [
          "📋 Demande de permission créée du {startDate} au {endDate}. En attente d'approbation.",
          "✅ Votre demande de {type} du {startDate} au {endDate} a été enregistrée.",
          "📝 Demande de {type} créée. Vous recevrez une réponse sous peu."
        ],
        incomplete: [
          "📋 Demande reçue. Veuillez préciser les dates (ex: du 15/12/2023 au 20/12/2023).",
          "❓ Je n'ai pas pu extraire les dates. Pouvez-vous reformuler ?",
          "📝 Demande incomplète. Précisez les dates de début et fin."
        ]
      },
      help: [
        "🤖 Je peux vous aider avec :\n• Marquer votre présence (arrivée, départ, pause)\n• Demander des permissions\n• Consulter votre statut\n• Autres questions administratives",
        "💡 Commandes disponibles :\n• 'Arrivée' ou 'Bonjour' → Marquer l'arrivée\n• 'Départ' ou 'Au revoir' → Marquer le départ\n• 'Pause' → Commencer la pause\n• 'Permission' → Demander un congé",
        "🆘 Besoin d'aide ? Je gère les présences et permissions. Dites-moi ce que vous voulez faire !"
      ],
      greeting: [
        "👋 Bonjour ! Comment puis-je vous aider aujourd'hui ?",
        "👋 Salut ! Que puis-je faire pour vous ?",
        "👋 Hello ! En quoi puis-je vous assister ?"
      ],
      // free_chat supprimé - l'IA intelligente gère maintenant tout
      error: [
        "❌ Désolé, une erreur s'est produite. Réessayez plus tard.",
        "⚠️ Problème technique. Contactez l'administrateur si cela persiste.",
        "❌ Erreur temporaire. Veuillez réessayer."
      ]
    };
  }

  /**
   * Génère une réponse intelligente basée sur l'analyse
   */
  async generateSmartResponse(analysis, employee = null, context = {}) {
    try {
      let response = null;

      // Pour les conversations libres, l'IA gère déjà tout dans aiAgent.js
      if (analysis.action === 'free_chat') {
        // L'IA a déjà généré la réponse, on la retourne directement
        return analysis.response || null;
      }

      const templates = this.getTemplatesForAction(analysis.action);

      if (!templates || templates.length === 0) {
        return null;
      }

      // Sélectionner un template aléatoire pour la variété
      const template = templates[Math.floor(Math.random() * templates.length)];
      
      // Remplacer les variables dans le template
      response = this.replaceTemplateVariables(template, analysis, employee, context);

      // Sauvegarder la réponse générée
      if (response) {
        await this.saveResponse(analysis, response);
      }

      return response;

    } catch (error) {
      console.error('Erreur lors de la génération de réponse intelligente:', error);
      return this.getRandomTemplate('error');
    }
  }

  /**
   * Obtient les templates pour une action donnée
   */
  getTemplatesForAction(action) {
    switch (action) {
      case 'arrival':
        return this.responseTemplates.attendance.arrival;
      case 'departure':
        return this.responseTemplates.attendance.departure;
      case 'lunch_break':
        return this.responseTemplates.attendance.lunch_break;
      case 'lunch_return':
        return this.responseTemplates.attendance.lunch_return;
      case 'absence':
        return this.responseTemplates.attendance.absence;
      case 'create_permission':
        return this.responseTemplates.permission.created;
      case 'provide_help':
        return this.responseTemplates.help;
      case 'greet_back':
        return this.responseTemplates.greeting;
      case 'free_chat':
        return null; // L'IA intelligente gère maintenant tout
      default:
        return null;
    }
  }

  /**
   * Remplace les variables dans un template
   */
  replaceTemplateVariables(template, analysis, employee, context) {
    let response = template;

    // Variables de temps
    if (analysis.extractedInfo && analysis.extractedInfo.time) {
      response = response.replace('{time}', ` à ${analysis.extractedInfo.time}`);
    } else {
      response = response.replace('{time}', '');
    }

    // Variables de raison
    if (analysis.extractedInfo && analysis.extractedInfo.reason) {
      response = response.replace('{reason}', ` (${analysis.extractedInfo.reason})`);
    } else {
      response = response.replace('{reason}', '');
    }

    // Variables de dates
    if (analysis.extractedInfo && analysis.extractedInfo.startDate) {
      response = response.replace('{startDate}', analysis.extractedInfo.startDate);
    }
    if (analysis.extractedInfo && analysis.extractedInfo.endDate) {
      response = response.replace('{endDate}', analysis.extractedInfo.endDate);
    }

    // Variables de type
    if (analysis.extractedInfo && analysis.extractedInfo.type) {
      const typeNames = {
        'vacation': 'congé',
        'sick_leave': 'maladie',
        'personal': 'personnel',
        'medical': 'médical'
      };
      response = response.replace('{type}', typeNames[analysis.extractedInfo.type] || analysis.extractedInfo.type);
    }

    // Variables d'employé
    if (employee && employee.name) {
      response = response.replace('{employeeName}', employee.name);
    }

    return response;
  }

  /**
   * Génère une réponse contextuelle basée sur l'historique
   */
  async generateContextualResponse(analysis, employee, chat) {
    try {
      // Obtenir l'historique récent de l'employé
      const recentMessages = await this.getRecentEmployeeMessages(employee.id, 5);
      
      // Analyser le contexte
      const context = this.analyzeContext(recentMessages, analysis);
      
      // Générer une réponse adaptée au contexte
      return await this.generateContextAwareResponse(analysis, context, employee);

    } catch (error) {
      console.error('Erreur lors de la génération contextuelle:', error);
      return await this.generateSmartResponse(analysis, employee);
    }
  }

  /**
   * Obtient les messages récents d'un employé
   */
  async getRecentEmployeeMessages(employeeId, limit = 5) {
    try {
      const messages = await db.query(`
        SELECT m.*, ai.analysis_type, ai.action
        FROM messages m
        LEFT JOIN ai_analysis ai ON m.message_id = ai.message_id
        WHERE m.from_number LIKE CONCAT('%', (SELECT phone FROM employees WHERE id = ?), '%')
        ORDER BY m.created_at DESC
        LIMIT ?
      `, [employeeId, limit]);

      return messages;
    } catch (error) {
      console.error('Erreur lors de la récupération des messages récents:', error);
      return [];
    }
  }

  /**
   * Analyse le contexte des messages récents
   */
  analyzeContext(messages, currentAnalysis) {
    const context = {
      hasRecentArrival: false,
      hasRecentDeparture: false,
      hasRecentPermission: false,
      lastAction: null,
      messageCount: messages.length
    };

    for (const message of messages) {
      if (message.action === 'arrival') {
        context.hasRecentArrival = true;
        context.lastAction = 'arrival';
      } else if (message.action === 'departure') {
        context.hasRecentDeparture = true;
        context.lastAction = 'departure';
      } else if (message.action === 'create_permission') {
        context.hasRecentPermission = true;
        context.lastAction = 'permission';
      }
    }

    return context;
  }

  /**
   * Génère une réponse adaptée au contexte
   */
  async generateContextAwareResponse(analysis, context, employee) {
    // Si l'employé vient de marquer son arrivée et essaie de le refaire
    if (analysis.action === 'arrival' && context.hasRecentArrival) {
      return "ℹ️ Vous avez déjà marqué votre arrivée aujourd'hui. Voulez-vous modifier l'heure ?";
    }

    // Si l'employé essaie de marquer son départ sans avoir marqué son arrivée
    if (analysis.action === 'departure' && !context.hasRecentArrival) {
      return "⚠️ Vous devez d'abord marquer votre arrivée avant de marquer votre départ.";
    }

    // Si l'employé a déjà fait une demande de permission récemment
    if (analysis.action === 'create_permission' && context.hasRecentPermission) {
      return "📋 Vous avez déjà une demande de permission en cours. Voulez-vous en créer une nouvelle ?";
    }

    // Réponse normale
    return await this.generateSmartResponse(analysis, employee);
  }

  /**
   * Sauvegarde une réponse générée
   */
  async saveResponse(analysis, response) {
    try {
      // Trouver l'analyse correspondante
      const analysisRecord = await db.query(`
        SELECT id FROM ai_analysis 
        WHERE message_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `, [analysis.messageId || `ai_${Date.now()}`]);

      if (analysisRecord.length > 0) {
        await db.query(`
          INSERT INTO ai_responses (analysis_id, response_content)
          VALUES (?, ?)
        `, [analysisRecord[0].id, response]);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la réponse:', error);
    }
  }

  /**
   * Obtient un template aléatoire pour un type donné
   */
  getRandomTemplate(type) {
    const templates = this.responseTemplates[type];
    if (!templates || templates.length === 0) {
      return "❌ Erreur de communication.";
    }
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Apprend des interactions pour améliorer les réponses
   */
  async learnFromInteraction(analysis, response, userFeedback = null) {
    try {
      // Sauvegarder l'interaction pour l'apprentissage
      await db.query(`
        INSERT INTO ai_learning (
          analysis_type, action, response_template, user_feedback, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        analysis.type,
        analysis.action,
        response,
        userFeedback,
        new Date()
      ]);

      // Mettre à jour les statistiques d'efficacité
      await this.updateResponseEffectiveness(analysis.action, userFeedback);

    } catch (error) {
      console.error('Erreur lors de l\'apprentissage:', error);
    }
  }

  /**
   * Met à jour l'efficacité des réponses
   */
  async updateResponseEffectiveness(action, feedback) {
    try {
      // Logique pour améliorer les templates basée sur le feedback
      // (à implémenter selon les besoins)
      console.log(`Apprentissage pour l'action ${action} avec feedback: ${feedback}`);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'efficacité:', error);
    }
  }
}

module.exports = new SmartResponseService();

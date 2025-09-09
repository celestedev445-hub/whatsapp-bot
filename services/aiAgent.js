const { HfInference } = require('@huggingface/inference');
const { CohereClient, CohereClientV2 } = require('cohere-ai');
const db = require('../config/database');
const moment = require('moment');
const axios = require('axios');

class AIAgent {
  constructor() {
    this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY || 'hf_demo');
    this.cohere = new CohereClient({
      token: process.env.COHERE_API_KEY || 'demo_key'
    });
    this.cohereV2 = new CohereClientV2({
      token: process.env.COHERE_API_KEY || 'demo_key'
    });
    this.isEnabled = process.env.AI_AGENT_ENABLED !== 'false'; // Activé par défaut
    this.confidenceThreshold = 0.3; // Seuil plus bas pour les tests
    this.whatsappBot = null; // Instance du bot WhatsApp
    
    // Configuration pour l'IA conversationnelle
    this.conversationalAI = {
      enabled: true, // Activé avec Cohere
      provider: 'cohere', // Toujours utiliser Cohere
      model: 'command', // Modèle Cohere
      maxLength: parseInt(process.env.AI_MAX_LENGTH) || 80, // Réponses plus courtes
      temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.3 // Plus déterministe
    };
    
    // Modèles pour différentes tâches
    this.models = {
      classification: 'camembert-base',
      sentiment: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
      ner: 'dbmdz/bert-large-cased-finetuned-conll03-english'
    };
  }

  /**
   * Définit l'instance du bot WhatsApp
   */
  setWhatsAppBot(bot) {
    this.whatsappBot = bot;
  }

  /**
   * Analyse un message et détermine son type et son intention
   * @param {string} message - Le message à analyser
   * @param {Object} context - Contexte (auteur, groupe, etc.)
   * @returns {Object} Résultat de l'analyse
   */
  async analyzeMessage(message, context = {}) {
    if (!this.isEnabled) {
      return { type: 'unknown', confidence: 0, action: 'none' };
    }

    try {
      console.log(`🤖 Analyse IA du message: "${message}"`);
      
      // Classification du type de message
      const classification = await this.classifyMessage(message, context);
      
      // Extraction d'informations selon le type
      let extractedInfo = {};
      if (classification.type === 'attendance') {
        extractedInfo = await this.extractAttendanceInfo(message);
      } else if (classification.type === 'permission') {
        extractedInfo = await this.extractPermissionInfo(message);
      }

      const result = {
        type: classification.type,
        confidence: classification.confidence,
        action: this.determineAction(classification, extractedInfo, context),
        extractedInfo,
        originalMessage: message,
        timestamp: new Date(),
        context
      };

      console.log(`✅ Analyse terminée:`, result);
      return result;

    } catch (error) {
      console.error('❌ Erreur lors de l\'analyse IA:', error);
      return { 
        type: 'unknown', 
        confidence: 0, 
        action: 'none',
        error: error.message 
      };
    }
  }

  /**
   * Vérifie si le message contient une mention explicite du bot
   */
  isBotMentioned(message) {
    const messageLower = message.toLowerCase();
    
    // Vérifier les mentions @numéro (format WhatsApp)
    const mentionRegex = /@(\d+)/g;
    const mentions = message.match(mentionRegex);
    
    if (mentions) {
      // Vérifier si l'un des numéros mentionnés correspond au bot
      // Le numéro du bot devrait être dans les variables d'environnement
      const botPhone = process.env.BOT_PHONE || process.env.ADMIN_PHONE;
      if (botPhone) {
        return mentions.some(mention => mention.includes(botPhone));
      }
    }
    
    // Vérifier les mentions textuelles du bot
    const botMentions = [
      'mr le manager', '@bot',
    ];
    
    return botMentions.some(mention => messageLower.includes(mention));
  }

  /**
   * Classifie le type de message
   */
  async classifyMessage(message, context = {}) {
    try {
      // Mots-clés pour la classification (plus fiable que l'IA pour ce cas)
      const keywords = {
        attendance: [
          'arrivée', 'arrive', 'arrivé', 'arrive', 'présent', 'present',
          'départ', 'depart', 'au revoir', 'à bientôt', 'à demain',
          'pause', 'déjeuner', 'dejeuner', 'retour pause', 'retour de pause',
          'absent', 'malade', 'maladie', 'congé', 'conge',
          'je suis là', 'je suis la', 'je pars', 'je vais', 'je reviens',
          'commencer', 'finir', 'terminer', 'quitter', 'partir',
          'bonjour arrivée', 'bonjour arrive', 'salut arrivée', 'salut arrive',
          'bonjour je suis arrivé', 'salut je suis là', 'bonjour présent', 'salut présent'
        ],
        permission: [
          'permission', 'congé', 'conge', 'vacance', 'vacances',
          'maladie', 'malade', 'personnel', 'médical', 'medical',
          'demande', 'demander', 'prendre congé', 'prendre conge',
          'arrêt', 'arret', 'repos', 'weekend', 'week-end'
        ],
        question: [
          'comment', 'quoi', 'quand', 'où', 'pourquoi', 'qui',
          'aide', 'help', 'statut', 'présence', 'permission',
          'peux-tu', 'peux tu', 'peut-on', 'peut on', 'est-ce que',
          'comment faire', 'que faire', 'que puis-je', 'que puis je'
        ],
        greeting: [
          'bonjour', 'salut', 'coucou', 'hello', 'hi',
          'bonsoir', 'bonne journée', 'bonne soirée',
          'hey', 'yo', 'ça va', 'ca va'
        ],
        admin_command: [
          // Commandes complètes
          '/admin', '/admins', '/admin-help', '/admin help',
          '/presences', '/présences', '/liste présences', '/liste presences',
          '/stats', '/statistiques', '/rapport', '/rapports',
          '/employés', '/employes', '/liste employés', '/liste employes',
          '/aide admin', '/help admin', '/commandes admin', '/commandes admins',
          // Raccourcis
          '/a', '/p', '/pp', '/pr', '/pa', '/pperm', '/s', '/e', '/r'
        ],
        status: [
          'statut', 'présence', 'presence', 'aujourd\'hui', 'aujourd hui',
          'mon statut', 'ma présence', 'ma presence', 'où en suis-je',
          'ou en suis je', 'état', 'etat', 'situation'
        ],
        mention: [
          'mr bot', 'mister bot', 'bot', 'assistant', 'ia', 'intelligence',
          '@bot', 'hey bot', 'salut bot', 'bonjour bot', 'bot,', 'bot !',
          'monsieur bot', 'madame bot', 'agent', 'robot', 'que penses-tu',
          'qu\'en penses-tu', 'ton avis', 'que dis-tu', 'que pense l\'ia',
          'l\'ia peut', 'peux-tu', 'peux tu', 'est-ce que tu peux',
          'est ce que tu peux', 'peut-on', 'peut on', 'est-ce que',
          'est ce que', 'comment faire', 'que faire', 'aide-moi',
          'aide moi', 'peux-tu m\'aider', 'peux tu m aider'
        ],
        free_chat: [
          'comment ça va', 'comment ca va', 'ça va', 'ca va', 'comment allez-vous',
          'comment allez vous', 'comment tu vas', 'comment vas-tu', 'comment vas tu',
          'raconte', 'parle', 'dis-moi', 'dis moi', 'peux-tu', 'peux tu',
          'que penses-tu', 'que penses tu', 'ton avis', 'qu\'en penses-tu',
          'qu en penses tu', 'blague', 'histoire', 'anecdote'
        ]
      };

      const messageLower = message.toLowerCase();
      let bestMatch = { type: 'other', confidence: 0 };

      for (const [type, words] of Object.entries(keywords)) {
        let matches = [];
        let confidence = 0;
        
        if (type === 'admin_command') {
          // Pour les commandes d'admin, vérifier si le message commence par une commande
          matches = words.filter(word => messageLower.startsWith(word));
          confidence = matches.length > 0 ? 1.0 : 0; // Confiance maximale pour les commandes exactes
        } else {
          // Pour les autres types, utiliser la logique existante
          matches = words.filter(word => messageLower.includes(word));
          confidence = matches.length > 0 ? Math.min(matches.length / words.length * 2, 1) : 0;
        }
        
        // Bonus de confiance pour les mentions directes
        if (type === 'mention' && matches.length > 0) {
          confidence = Math.min(confidence * 1.5, 1);
        }
        
        // Bonus pour les conversations libres après mention
        if (type === 'free_chat' && messageLower.includes('bot')) {
          confidence = Math.min(confidence * 1.3, 1);
        }
        
        // Bonus spécial pour les combinaisons de salutation + présence
        if (type === 'attendance' && (
            (messageLower.includes('bonjour') && (messageLower.includes('arrivée') || messageLower.includes('arrivé') || messageLower.includes('présent'))) ||
            (messageLower.includes('salut') && (messageLower.includes('arrivée') || messageLower.includes('arrivé') || messageLower.includes('présent'))) ||
            (messageLower.includes('bonjour') && messageLower.includes('je suis là')) ||
            (messageLower.includes('salut') && messageLower.includes('je suis là'))
        )) {
          confidence = Math.min(confidence * 1.8, 1);
        }
        
        if (confidence > bestMatch.confidence) {
          bestMatch = { type, confidence };
        }
      }
      
      // Vérifier si c'est une mention directe du bot
      const isDirectMention = this.isBotMentioned(message);
      
      if (isDirectMention && bestMatch.confidence < 0.5) {
        bestMatch = { type: 'mention', confidence: 0.8 };
      }
      
      // Dans les groupes, ignorer les messages qui ne mentionnent pas le bot
      if (context && context.isGroup && !isDirectMention) {
        // Vérifier si c'est une fonction importante (présence, permissions, admin)
        const isImportantFunction = bestMatch.type === 'attendance' || 
                                   bestMatch.type === 'permission' || 
                                   bestMatch.type === 'admin_command';
        
        if (!isImportantFunction) {
          // Ignorer les conversations normales dans les groupes
          bestMatch = { type: 'other', confidence: 0 };
        }
      } else if (context && context.isGroup && isDirectMention) {
        // Si le bot est mentionné dans un groupe, traiter comme une conversation libre
        if (bestMatch.type === 'mention') {
          bestMatch = { type: 'free_chat', confidence: 0.8 };
        }
      }
      
      // Pour les conversations privées, traiter tous les messages comme des conversations libres
      // si ce n'est pas déjà une tâche fonctionnelle
      if (context && !context.isGroup && bestMatch.confidence < 0.3) {
        const functionalityKeywords = ['présence', 'presence', 'arrivée', 'arrive', 'départ', 'depart', 
                                     'permission', 'congé', 'conge', 'pause', 'déjeuner', 'dejeuner'];
        const isFunctionalMessage = functionalityKeywords.some(keyword => messageLower.includes(keyword));
        
        if (!isFunctionalMessage) {
          bestMatch = { type: 'free_chat', confidence: 0.5 };
        }
      }

      // Si on trouve des mots-clés, on a une bonne confiance
      if (bestMatch.confidence > 0) {
        bestMatch.confidence = Math.min(bestMatch.confidence, 1);
      }

      console.log(`🔍 Classification: "${message}" → ${bestMatch.type} (${bestMatch.confidence})`);
      return {
        ...bestMatch,
        originalMessage: message
      };

    } catch (error) {
      console.error('Erreur lors de la classification:', error);
      return { type: 'other', confidence: 0 };
    }
  }

  /**
   * Extrait les informations de présence
   */
  async extractAttendanceInfo(message) {
    const info = {
      action: null,
      time: null,
      reason: null,
      status: null,
      mentions: []
    };

    const messageLower = message.toLowerCase();
    
    // Extraire les mentions (@numéros)
    const mentionRegex = /@(\d+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(message)) !== null) {
      mentions.push(match[1]);
    }
    info.mentions = mentions;

    // Déterminer l'action avec des patterns plus naturels
    if (messageLower.includes('arrivée') || messageLower.includes('arrive') || 
        messageLower.includes('arrivé') || messageLower.includes('arrive') ||
        messageLower.includes('je suis là') || messageLower.includes('je suis la') ||
        messageLower.includes('présent') || messageLower.includes('present') ||
        (messageLower.includes('bonjour') && (messageLower.includes('arrivé') || messageLower.includes('arrive'))) ||
        messageLower.includes('je commence') || messageLower.includes('je démarre')) {
      info.action = 'arrival';
    } else if (messageLower.includes('départ') || messageLower.includes('depart') || 
               messageLower.includes('au revoir') || messageLower.includes('à bientôt') ||
               messageLower.includes('à demain') || messageLower.includes('je pars') ||
               messageLower.includes('je quitte') || messageLower.includes('je finis') ||
               messageLower.includes('je termine')) {
      info.action = 'departure';
    } else if (messageLower.includes('retour') && messageLower.includes('pause')) {
      info.action = 'lunch_return';
    } else if (messageLower.includes('pause') || messageLower.includes('déjeuner') ||
               messageLower.includes('je vais manger') || messageLower.includes('manger')) {
      info.action = 'lunch_break';
    } else if (messageLower.includes('absent') || messageLower.includes('malade') ||
               messageLower.includes('je ne viens pas') || messageLower.includes('je ne peux pas venir')) {
      info.action = 'absence';
      info.status = 'absent';
    } else if (messageLower.includes('mission') || messageLower.includes('sortie') ||
               messageLower.includes('déplacement') || messageLower.includes('deplacement') ||
               messageLower.includes('rendez-vous') || messageLower.includes('rdv') ||
               messageLower.includes('client') || messageLower.includes('réunion') ||
               messageLower.includes('reunion') || messageLower.includes('formation')) {
      info.action = 'mission';
      info.status = 'on_mission';
    } else if (messageLower.includes('retour') && (messageLower.includes('mission') || 
               messageLower.includes('sortie') || messageLower.includes('déplacement') ||
               messageLower.includes('deplacement'))) {
      info.action = 'mission_return';
      info.status = 'present';
    } else if (messageLower.includes('télétravail') || messageLower.includes('teletravail') ||
               messageLower.includes('travail à distance') || messageLower.includes('remote') ||
               messageLower.includes('home office') || messageLower.includes('chez moi')) {
      info.action = 'remote_work';
      info.status = 'remote';
    } else if (messageLower.includes('congé') || messageLower.includes('conge') ||
               messageLower.includes('vacances') || messageLower.includes('repos') ||
               messageLower.includes('weekend') || messageLower.includes('week-end')) {
      info.action = 'leave';
      info.status = 'on_leave';
    }

    // Extraire l'heure si mentionnée
    const timeRegex = /(\d{1,2}[:h]\d{2})/g;
    const timeMatch = message.match(timeRegex);
    if (timeMatch) {
      info.time = timeMatch[0].replace('h', ':');
    }

    // Extraire la raison pour les absences
    if (info.action === 'absence') {
      const reasonKeywords = ['malade', 'maladie', 'famille', 'personnel', 'rendez-vous'];
      const foundReason = reasonKeywords.find(keyword => messageLower.includes(keyword));
      if (foundReason) {
        info.reason = foundReason;
      }
    }

    return info;
  }

  /**
   * Extrait les informations de permission
   */
  async extractPermissionInfo(message) {
    const info = {
      type: 'other',
      startDate: null,
      endDate: null,
      reason: null
    };

    // Types de permissions
    const permissionTypes = {
      'vacation': ['congé', 'conge', 'vacance', 'vacances'],
      'sick_leave': ['malade', 'maladie', 'maladie'],
      'personal': ['personnel', 'personnel', 'famille'],
      'medical': ['médical', 'medical', 'rendez-vous', 'docteur']
    };

    const messageLower = message.toLowerCase();
    
    // Déterminer le type
    for (const [type, keywords] of Object.entries(permissionTypes)) {
      if (keywords.some(keyword => messageLower.includes(keyword))) {
        info.type = type;
        break;
      }
    }

    // Extraire les dates
    const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g;
    const dates = message.match(dateRegex);
    if (dates && dates.length >= 1) {
      info.startDate = moment(dates[0], ['DD/MM/YYYY', 'DD-MM-YYYY']).format('YYYY-MM-DD');
      if (dates.length >= 2) {
        info.endDate = moment(dates[1], ['DD/MM/YYYY', 'DD-MM-YYYY']).format('YYYY-MM-DD');
      }
    }

    // Extraire la raison (texte après les dates)
    if (dates) {
      let reasonText = message;
      dates.forEach(date => {
        reasonText = reasonText.replace(date, '');
      });
      info.reason = reasonText.replace(/permission|congé|maladie|personnel|médical/gi, '').trim();
    }

    return info;
  }

  /**
   * Détermine l'action à effectuer
   */
  determineAction(classification, extractedInfo, context = {}) {
    // Si on a des informations extraites, on peut agir même avec une confiance plus faible
    const hasExtractedInfo = extractedInfo && Object.keys(extractedInfo).length > 0;
    // Seuil plus bas pour les conversations libres et mentions
    const isFreeChat = classification.type === 'mention' || classification.type === 'free_chat';
    // Seuil encore plus bas pour les conversations privées
    const isPrivateChat = context && !context.isGroup;
    // Seuil spécial pour les messages de présence (plus permissif)
    const isAttendance = classification.type === 'attendance';
    
    // Vérifier si le bot est mentionné dans le message
    const isBotMentioned = this.isBotMentioned(classification.originalMessage || '');
    
    let effectiveThreshold;
    if (isFreeChat) {
      effectiveThreshold = 0.1;
    } else if (isPrivateChat) {
      effectiveThreshold = 0.05;
    } else if (isAttendance && hasExtractedInfo) {
      // Pour les messages de présence avec info extraite, seuil très bas
      effectiveThreshold = 0.05;
    } else if (hasExtractedInfo) {
      effectiveThreshold = 0.1;
    } else {
      effectiveThreshold = this.confidenceThreshold;
    }
    
    // Dans les groupes, être très strict si le bot n'est pas mentionné
    if (context && context.isGroup && !isBotMentioned) {
      // Seulement les fonctions importantes (présence, permissions, admin) sans mention
      const isImportantFunction = classification.type === 'attendance' || 
                                 classification.type === 'permission' || 
                                 classification.type === 'admin_command';
      
      if (!isImportantFunction) {
        return 'none'; // Ignorer complètement
      }
      
      // Pour les présences dans les groupes, retourner l'action appropriée
      if (classification.type === 'attendance') {
        return extractedInfo.action || 'arrival';
      }
    } else if (context && context.isGroup && isBotMentioned) {
      // Si le bot est mentionné dans un groupe, permettre les conversations libres
      if (classification.type === 'free_chat' || classification.type === 'mention') {
        return 'free_chat';
      }
    }
    
    // Vérifier le seuil de confiance seulement si ce n'est pas une mention de bot dans un groupe
    if (!(context && context.isGroup && isBotMentioned && (classification.type === 'free_chat' || classification.type === 'mention'))) {
      if (classification.confidence < effectiveThreshold) {
        return 'none';
      }
    }

    switch (classification.type) {
      case 'attendance':
        return extractedInfo.action || 'none';
      case 'permission':
        return 'create_permission';
      case 'question':
        return 'provide_help';
      case 'greeting':
        return 'greet_back';
      case 'status':
        return 'status_check';
      case 'mention':
        return 'free_chat';
      case 'free_chat':
        return 'free_chat';
      case 'admin_command':
        return 'admin_command';
      default:
        return 'none';
    }
  }

  /**
   * Génère une réponse automatique
   */
  async generateResponse(analysis, employee = null, context = {}, message = '') {
    if (!this.isEnabled || analysis.action === 'none') {
      return null;
    }

    try {
      let response = '';
      const isPrivate = !context.isGroup;

      switch (analysis.action) {
        case 'arrival':
          // Gérer les mentions si présentes
          if (analysis.extractedInfo.mentions && analysis.extractedInfo.mentions.length > 0) {
            // Enregistrer la présence pour chaque personne mentionnée
            const arrivalTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const mentionedNames = [];
            
            for (const phoneNumber of analysis.extractedInfo.mentions) {
              try {
                // Chercher l'employé mentionné en base de données
                const mentionedEmployee = await db.query(
                  'SELECT * FROM employees WHERE phone = ? OR whatsapp_id = ?',
                  [phoneNumber, phoneNumber + '@c.us']
                );
                
                if (mentionedEmployee.length > 0) {
                  // Enregistrer la présence pour l'employé existant
                  await this.saveAttendanceToDatabase(mentionedEmployee[0], 'arrival', analysis.extractedInfo, context);
                  mentionedNames.push(phoneNumber);
                  
                  // Envoyer une notification privée à la personne mentionnée
                  const arrivalTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const privateMessage = `✅ Votre arrivée a été signalée par ${employee.name} à ${arrivalTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
                  
                  try {
                    const WhatsAppBot = require('./whatsappBot');
                    await WhatsAppBot.sendAIMessage(phoneNumber + '@c.us', privateMessage);
                    console.log(`📱 Notification privée envoyée à ${phoneNumber}`);
                  } catch (sendError) {
                    console.error(`❌ Erreur lors de l'envoi de notification à ${phoneNumber}:`, sendError);
                  }
                } else {
                  console.log(`⚠️ Employé ${phoneNumber} non trouvé en base de données, ignoré`);
                }
              } catch (error) {
                console.error(`❌ Erreur lors de l'enregistrement pour ${phoneNumber}:`, error);
              }
            }
            
            response = `✅ Arrivées enregistrées à ${arrivalTime} pour : ${mentionedNames.join(', ')}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
          } else {
            // Enregistrer l'arrivée normale
            const result = await this.saveAttendanceToDatabase(employee, 'arrival', analysis.extractedInfo, context);
            
            // Vérifier s'il y a une erreur de doublon
            if (result && result.error === 'duplicate') {
              response = `⚠️ ${result.message}`;
            } else {
            const arrivalTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              
              // Vérifier si c'était un retard
              const isLate = result && result.isLate;
              if (isLate) {
                // Pas de message dans le groupe pour les retards, seul le message privé est envoyé
                response = null;
              } else {
            response = `✅ Arrivée enregistrée à ${arrivalTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
              }
            }
          }
          break;
        
        case 'departure':
          // Gérer les mentions si présentes
          if (analysis.extractedInfo.mentions && analysis.extractedInfo.mentions.length > 0) {
            // Enregistrer le départ pour chaque personne mentionnée
            const departureTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const mentionedNames = [];
            
            for (const phoneNumber of analysis.extractedInfo.mentions) {
              try {
                // Chercher l'employé mentionné en base de données
                const mentionedEmployee = await db.query(
                  'SELECT * FROM employees WHERE phone = ? OR whatsapp_id = ?',
                  [phoneNumber, phoneNumber + '@c.us']
                );
                
                if (mentionedEmployee.length > 0) {
                  // Enregistrer le départ pour l'employé existant
                  const departureResult = await this.saveAttendanceToDatabase(mentionedEmployee[0], 'departure', analysis.extractedInfo, context);
                  mentionedNames.push(phoneNumber);
                  
                  // Envoyer une notification privée à la personne mentionnée
                  const departureTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const workHours = departureResult ? departureResult.totalHours.toFixed(2) : '0.00';
                  const privateMessage = `✅ Votre départ a été signalé par ${employee.name} à ${departureTime}\n📊 Heures travaillées: ${workHours}h\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
                  
                  try {
                    const WhatsAppBot = require('./whatsappBot');
                    await WhatsAppBot.sendAIMessage(phoneNumber + '@c.us', privateMessage);
                    console.log(`📱 Notification privée envoyée à ${phoneNumber}`);
                  } catch (sendError) {
                    console.error(`❌ Erreur lors de l'envoi de notification à ${phoneNumber}:`, sendError);
                  }
                } else {
                  console.log(`⚠️ Employé ${phoneNumber} non trouvé en base de données, ignoré`);
                }
              } catch (error) {
                console.error(`❌ Erreur lors de l'enregistrement pour ${phoneNumber}:`, error);
              }
            }
            
            response = `✅ Départs enregistrés à ${departureTime} pour : ${mentionedNames.join(', ')}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
          } else {
            // Enregistrer le départ normal
            const departureResult = await this.saveAttendanceToDatabase(employee, 'departure', analysis.extractedInfo, context);
            
            // Vérifier s'il y a une erreur de doublon
            if (departureResult && departureResult.error === 'duplicate') {
              response = `⚠️ ${departureResult.message}`;
            } else {
            const departureTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const workHours = departureResult ? departureResult.totalHours.toFixed(2) : '0.00';
            response = `✅ Départ enregistré à ${departureTime}\n📊 Heures travaillées: ${workHours}h\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
            }
          }
          break;
        
        case 'lunch_break':
          // Gérer les mentions si présentes
          if (analysis.extractedInfo.mentions && analysis.extractedInfo.mentions.length > 0) {
            // Enregistrer la pause pour chaque personne mentionnée
            const lunchTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const mentionedNames = [];
            
            for (const phoneNumber of analysis.extractedInfo.mentions) {
              try {
                // Chercher l'employé mentionné en base de données
                const mentionedEmployee = await db.query(
                  'SELECT * FROM employees WHERE phone = ? OR whatsapp_id = ?',
                  [phoneNumber, phoneNumber + '@c.us']
                );
                
                if (mentionedEmployee.length > 0) {
                  // Enregistrer la pause pour l'employé existant
                  await this.saveAttendanceToDatabase(mentionedEmployee[0], 'lunch_break', analysis.extractedInfo, context);
                  mentionedNames.push(phoneNumber);
                  
                  // Envoyer une notification privée à la personne mentionnée
                  const privateMessage = `🍽️ Votre pause déjeuner a été signalée par ${employee.name} à ${lunchTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
                  
                  try {
                    const WhatsAppBot = require('./whatsappBot');
                    await WhatsAppBot.sendAIMessage(phoneNumber + '@c.us', privateMessage);
                    console.log(`📱 Notification privée envoyée à ${phoneNumber}`);
                  } catch (sendError) {
                    console.error(`❌ Erreur lors de l'envoi de notification à ${phoneNumber}:`, sendError);
                  }
                } else {
                  console.log(`⚠️ Employé ${phoneNumber} non trouvé en base de données, ignoré`);
                }
              } catch (error) {
                console.error(`❌ Erreur lors de l'enregistrement pour ${phoneNumber}:`, error);
              }
            }
            
            response = `🍽️ Pauses déjeuner commencées à ${lunchTime} pour : ${mentionedNames.join(', ')}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
          } else {
            // Enregistrer la pause normale
            const lunchResult = await this.saveAttendanceToDatabase(employee, 'lunch_break', analysis.extractedInfo, context);
            
            // Vérifier s'il y a une erreur de doublon
            if (lunchResult && lunchResult.error === 'duplicate') {
              response = `⚠️ ${lunchResult.message}`;
            } else {
            const lunchTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            response = `🍽️ Pause déjeuner commencée à ${lunchTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
            }
          }
          break;
        
        case 'lunch_return':
          // Enregistrer le retour de pause en base de données
          const returnResult = await this.saveAttendanceToDatabase(employee, 'lunch_return', analysis.extractedInfo, context);
          
          // Vérifier s'il y a une erreur de doublon
          if (returnResult && returnResult.error === 'duplicate') {
            response = `⚠️ ${returnResult.message}`;
          } else {
          const returnTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          response = `✅ Retour de pause à ${returnTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
          }
          break;
        
        case 'absence':
          // Enregistrer l'absence en base de données
          await this.saveAttendanceToDatabase(employee, 'absence', analysis.extractedInfo, context);
          response = `📝 Absence enregistrée pour aujourd'hui\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
          break;
        
        case 'mission':
          // Enregistrer la mission en base de données
          await this.saveAttendanceToDatabase(employee, 'mission', analysis.extractedInfo, context);
          const missionTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          response = `🚀 Sortie en mission enregistrée à ${missionTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
          break;
        
        case 'mission_return':
          // Enregistrer le retour de mission en base de données
          await this.saveAttendanceToDatabase(employee, 'mission_return', analysis.extractedInfo, context);
          const missionReturnTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          response = `✅ Retour de mission enregistré à ${missionReturnTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
          break;
        
        case 'remote_work':
          // Enregistrer le télétravail en base de données
          await this.saveAttendanceToDatabase(employee, 'remote_work', analysis.extractedInfo, context);
          const remoteTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          response = `🏠 Télétravail enregistré à ${remoteTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
          break;
        
        case 'leave':
          // Enregistrer le congé en base de données
          await this.saveAttendanceToDatabase(employee, 'leave', analysis.extractedInfo, context);
          const leaveTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          response = `🏖️ Congé/Repos enregistré à ${leaveTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
          break;
        
        case 'create_permission':
          if (analysis.extractedInfo.startDate && analysis.extractedInfo.endDate) {
            response = `📋 Votre demande de permission a été créée du ${analysis.extractedInfo.startDate} au ${analysis.extractedInfo.endDate}. En attente d'approbation.`;
          } else {
            response = `📋 Demande de permission reçue. Veuillez préciser les dates (ex: du 15/12/2023 au 20/12/2023).`;
          }
          break;
        
        case 'provide_help':
          if (isPrivate) {
            response = `👨‍💼 Salut ! Je suis Mr le Manager, l'assistant IA de Promillys. Voici ce que je peux faire pour vous :

*📅 Gestion de présence :*
• "Je suis arrivé" ou "Bonjour" → Marquer votre arrivée
• "Je pars" ou "Au revoir" → Marquer votre départ  
• "Je vais en pause" → Commencer la pause déjeuner
• "Je reviens de pause" → Finir la pause
• "Je ne viens pas" → Déclarer une absence

*📋 Demandes de permissions :*
• "Je veux prendre congé du 15/12 au 20/12" → Demander un congé
• "Je suis malade du 10/12 au 12/12" → Demander un arrêt maladie
• "J'ai un rendez-vous médical" → Permission médicale

*ℹ️ Informations :*
• "Mon statut" → Voir votre présence du jour
• "Aide" → Afficher cette aide

Parlez-moi naturellement, je vous comprends ! 😊`;
          } else {
            response = `👨‍💼 Je peux vous aider avec :
• Marquer votre présence (arrivée, départ, pause)
• Demander des permissions
• Consulter votre statut
• Autres questions administratives`;
          }
          break;
        
        case 'greet_back':
          if (isPrivate) {
            response = `👨‍💼 Salut ! Je suis Mr le Manager, l'assistant IA de Promillys. Comment puis-je vous aider aujourd'hui ? 😊`;
          } else {
            response = `👨‍💼 Bonjour ! Je suis Mr le Manager, l'assistant IA de Promillys. Comment puis-je vous aider aujourd'hui ?`;
          }
          break;
        
        case 'status_check':
          if (isPrivate) {
            response = `📊 Je vais vérifier votre statut de présence du jour... (Cette fonctionnalité sera bientôt disponible)`;
          } else {
            response = `📊 Statut de présence consulté`;
          }
          break;
        
        case 'free_chat':
          response = await this.generateFreeChatResponse(message, context);
          break;
        
        case 'admin_command':
          response = await this.handleAdminCommand(message, context);
          break;
        
        default:
          return null;
      }

      return response;

    } catch (error) {
      console.error('Erreur lors de la génération de réponse:', error);
      return null;
    }
  }

  /**
   * Génère une réponse libre et naturelle pour les conversations avec le bot
   */
  async generateFreeChatResponse(message, context) {
    try {
      const messageLower = message.toLowerCase().trim();
      const isPrivate = !context.isGroup;
      const author = context.author || 'Utilisateur';
      
      console.log(`🤖 Génération de réponse libre pour: "${message}"`);
      
      // Gérer les salutations simples avec des réponses courtes et naturelles
      if (this.isSimpleGreeting(message)) {
        console.log(`👋 Salutation simple détectée`);
        return this.generateSimpleGreetingResponse(message, context);
      }
      
      // Vérifier si c'est une question de suivi (référence à une conversation précédente)
      if (this.isFollowUpQuestion(message)) {
        console.log(`🔄 Question de suivi détectée`);
        // Utiliser la nouvelle API Cohere avec le modèle command-a-03-2025
        const cohereResponse = await this.generateCohereWithNewModel(message, context);
        if (cohereResponse && cohereResponse.trim() && cohereResponse.length > 5) {
          console.log(`✅ Réponse Cohere contextuelle générée: ${cohereResponse.substring(0, 50)}...`);
          return cohereResponse;
        }
      }
      
      // Vérifier si c'est une question sur les fonctionnalités du bot
      if (this.isBotFunctionalityQuestion(message)) {
        console.log(`📋 Question sur les fonctionnalités détectée`);
        return this.generateBotFunctionalityResponse(message, context);
      }
      
      // Utiliser en priorité l'API Cohere avec le nouveau modèle (command-a-03-2025)
      console.log(`🤖 Utilisation de Cohere avec modèle command-a-03-2025...`);
      const cohereResponse = await this.generateCohereWithNewModel(message, context);
      if (cohereResponse && cohereResponse.trim() && cohereResponse.length > 5) {
        console.log(`✅ Réponse Cohere générée: ${cohereResponse.substring(0, 50)}...`);
        return cohereResponse;
      }
      
      // Si Cohere échoue, essayer avec l'IA conversationnelle classique
      console.log(`🔄 Tentative avec IA conversationnelle classique...`);
      const aiResponse = await this.generateAIGenerativeResponse(message, context);
      if (aiResponse && aiResponse.trim() && aiResponse.length > 5) {
        console.log(`✅ Réponse IA générée: ${aiResponse.substring(0, 50)}...`);
        return aiResponse;
      }
      
      // Si l'IA échoue, essayer avec une API alternative
      console.log(`🔄 Tentative avec API alternative...`);
      const alternativeResponse = await this.generateAlternativeAIResponse(message, context);
      if (alternativeResponse && alternativeResponse.trim() && alternativeResponse.length > 5) {
        console.log(`✅ Réponse alternative générée: ${alternativeResponse.substring(0, 50)}...`);
        return alternativeResponse;
      }
      
      // Dernier recours : demander à l'utilisateur de reformuler
      console.log(`⚠️ Aucune IA n'a pu générer de réponse`);
      return `👨‍💼 Désolé, je n'arrive pas à générer une réponse pour le moment. Pouvez-vous reformuler votre message ?`;
      
    } catch (error) {
      console.error('Erreur lors de la génération de réponse libre:', error);
      return `👨‍💼 Désolé, je n'ai pas bien compris. Peux-tu reformuler ? 😊`;
    }
  }

  /**
   * Vérifie si c'est une question de suivi (référence à une conversation précédente)
   */
  isFollowUpQuestion(message) {
    const messageLower = message.toLowerCase().trim();
    
    const followUpKeywords = [
      'pourquoi', 'comment', 'quand', 'où', 'qui', 'quoi',
      'tu', 'toi', 'vous', 'il', 'elle', 'ça', 'ce', 'cette',
      'déjà', 'encore', 'toujours', 'maintenant', 'après',
      'avant', 'plus', 'moins', 'aussi', 'même', 'autre',
      'comprends', 'comprends pas', 'sais', 'sais pas',
      'fais', 'fais quoi', 'fais ça', 'fais là'
    ];
    
    return followUpKeywords.some(keyword => messageLower.includes(keyword));
  }

  /**
   * Vérifie si c'est une salutation simple
   */
  isSimpleGreeting(message) {
    const messageLower = message.toLowerCase().trim();
    
    const simpleGreetings = [
      'salut', 'bonjour', 'bonsoir', 'bonne nuit', 'bonne journée',
      'ça va', 'ca va', 'comment ça va', 'comment ca va', 'ça va?', 'ca va?',
      'ok', 'd\'accord', 'daccord', 'parfait', 'super',
      'merci', 'merci beaucoup', 'à bientôt', 'a bientot',
      'bye', 'au revoir', 'à plus', 'a plus'
    ];
    
    return simpleGreetings.some(greeting => messageLower === greeting);
  }

  /**
   * Génère une réponse simple pour les salutations
   */
  generateSimpleGreetingResponse(message, context) {
    const messageLower = message.toLowerCase().trim();
    const isPrivate = !context.isGroup;
    const author = context.author || 'Utilisateur';
    
    // Réponses courtes et naturelles selon le type de salutation
    if (messageLower.includes('salut') || messageLower.includes('bonjour') || messageLower.includes('bonsoir')) {
      return `Salut ! Comment ça va ?`;
    }
    
    if (messageLower.includes('ça va') || messageLower.includes('ca va') || messageLower.includes('comment')) {
      return `Ça va bien, merci ! Et toi ?`;
    }
    
    if (messageLower === 'ok' || messageLower === 'd\'accord' || messageLower === 'daccord') {
      return `Ok ! Que veux-tu faire ?`;
    }
    
    if (messageLower.includes('merci')) {
      return `De rien ! Autre chose ?`;
    }
    
    if (messageLower.includes('bye') || messageLower.includes('au revoir') || messageLower.includes('à plus')) {
      return `À bientôt !`;
    }
    
    // Réponses pour les questions de suivi
    if (messageLower.includes('rappel') || messageLower.includes('souviens') || messageLower.includes('demandé')) {
      return `Désolé, je n'ai pas bien compris ta question. Peux-tu reformuler ?`;
    }
    
    // Réponse par défaut pour les autres salutations
    return `Salut ! Comment ça va ?`;
  }

  /**
   * Vérifie si c'est une question sur les fonctionnalités du bot
   */
  isBotFunctionalityQuestion(message) {
    const messageLower = message.toLowerCase();
    
    // Mots-clés spécifiques pour les fonctionnalités du bot
    const functionalityKeywords = [
      'présence', 'presence', 'arrivée', 'arrive', 'départ', 'depart',
      'permission', 'congé', 'conge', 'pause', 'déjeuner', 'dejeuner',
      'statut', 'aide', 'help'
    ];
    
    // Questions directes sur les fonctionnalités
    const directQuestions = [
      'que peux-tu faire', 'que peux tu faire', 'que sais-tu faire', 'que sais tu faire',
      'comment marquer', 'comment faire pour', 'comment utiliser',
      'quelles sont tes fonctionnalités', 'quelles sont tes capacités'
    ];
    
    // Vérifier les mots-clés de fonctionnalités
    const hasFunctionalityKeyword = functionalityKeywords.some(keyword => 
      messageLower.includes(keyword)
    );
    
    // Vérifier les questions directes
    const hasDirectQuestion = directQuestions.some(question => 
      messageLower.includes(question)
    );
    
    // Ne considérer comme question de fonctionnalité que si c'est une question directe
    // ou si le message contient des mots-clés ET se termine par un point d'interrogation
    return hasDirectQuestion || (hasFunctionalityKeyword && messageLower.includes('?'));
  }

  /**
   * Génère une réponse pour les questions sur les fonctionnalités du bot
   */
  generateBotFunctionalityResponse(message, context) {
    const isPrivate = !context.isGroup;
    const author = context.author || 'Utilisateur';
    
    if (isPrivate) {
      return `👨‍💼 Salut ${author} ! Je suis Mr le Manager, l'assistant IA de Promillys. Voici ce que je peux faire pour toi :

*📅 Gestion de présence :*
• "Je suis arrivé" ou "Bonjour" → Marquer ton arrivée
• "Je pars" ou "Au revoir" → Marquer ton départ  
• "Je vais en pause" → Commencer la pause déjeuner
• "Je reviens de pause" → Finir la pause
• "Je ne viens pas" → Déclarer une absence
• "Mon statut" → Voir ta présence du jour

*📋 Demandes de permissions :*
• "Je veux prendre congé du 15/12 au 20/12" → Demander un congé
• "Je suis malade du 10/12 au 12/12" → Demander un arrêt maladie
• "Permission médicale" → Demande de permission médicale

*💬 Conversations et aide :*
• Parle-moi de n'importe quoi, je te réponds !
• Pose-moi des questions sur le travail, la vie, etc.
• Je peux t'aider avec des conseils et des discussions

*ℹ️ Informations :*
• "Aide" → Afficher cette aide
• "Que peux-tu faire" → Voir mes capacités

Parle-moi naturellement, je te comprends ! Que veux-tu faire ? 😊`;
    } else {
      return `👨‍💼 Je peux t'aider avec :
• Marquer ta présence (arrivée, départ, pause)
• Demander des permissions et congés
• Consulter ton statut de présence
• Répondre à tes questions
• Avoir des conversations libres

Dis-moi ce dont tu as besoin ! 😊`;
    }
  }

  /**
   * Génère une réponse vraiment intelligente avec une vraie IA conversationnelle
   */
  async generateAIGenerativeResponse(message, context) {
    try {
      const isPrivate = !context.isGroup;
      const author = context.author || 'Utilisateur';
      
      console.log(`🤖 Tentative de génération IA pour: "${message}"`);
      
      // Vérifier si c'est une question sur les fonctionnalités du bot
      if (this.isBotFunctionalityQuestion(message)) {
        console.log(`📋 Question fonctionnalité détectée, utilisation du fallback`);
        return this.generateBotFunctionalityResponse(message, context);
      }
      
      // Utiliser uniquement l'IA conversationnelle
      console.log(`🤖 Appel à l'IA conversationnelle...`);
      const aiResponse = await this.generateConversationalAIResponse(message, context);
      if (aiResponse && aiResponse.trim() && aiResponse.length > 5) {
        console.log(`✅ Réponse IA reçue: ${aiResponse.substring(0, 100)}...`);
        return aiResponse;
      }
      
      console.log(`⚠️ IA conversationnelle n'a pas généré de réponse valide`);
      return null; // Pas de fallback prédéfini
      
    } catch (error) {
      console.error('Erreur lors de la génération IA:', error);
      return null; // Pas de fallback prédéfini
    }
  }

  /**
   * Génère une réponse avec Cohere et le nouveau modèle command-a-03-2025
   */
  async generateCohereWithNewModel(message, context) {
    try {
      const author = context.author || 'Utilisateur';
      const isPrivate = !context.isGroup;
      
      console.log(`🤖 Appel Cohere avec modèle command-a-03-2025 pour: "${message}"`);
      
      // Récupérer l'historique des messages
      const chatHistory = await this.getChatHistory(context.chatId, 6);
      
      // Construire les messages pour l'API chat
      const messages = [
        {
          role: "system",
          content: `Tu es Mr le Manager de Promillys. Tu gères les présences et tous besoins de l'entreprise et conseils.

RÈGLES ABSOLUES:
- Réponds UNIQUEMENT en français
- Sois simple et direct
- Reste dans ton rôle de gestionnaire
- Ne donne JAMAIS de recettes ou conseils non liés au travail

EXEMPLES OBLIGATOIRES:
- "Salut" → "Salut ! Comment ça va ?"
- "Ça va bien et toi ?" → "Ça va très bien, merci !"
- "Comment faire des gâteaux" → "Je ne peux pas t'aider avec ça, je gère les présences."
- "Comment tu vas ?" → "Ça va bien, merci !"`
        }
      ];

      // Ajouter l'historique des conversations
      if (chatHistory.length > 0) {
        const recentMessages = chatHistory.slice(-4); // Garder les 4 derniers messages
        
        recentMessages.forEach(msg => {
          // Déterminer l'expéditeur
          let role;
          if (msg.from_number === 'BOT') {
            role = "assistant";
          } else {
            const msgFrom = msg.from_number.replace('@c.us', '');
            const userPhone = context.userPhone.replace('@c.us', '');
            role = msgFrom === userPhone ? "user" : "assistant";
          }
          
          // Ajouter le message à l'historique
          messages.push({
            role: role,
            content: msg.content
          });
        });
      }
      
      // Ajouter le message actuel
      messages.push({
        role: "user",
        content: message
      });
      
      console.log(`📝 Messages à envoyer: ${JSON.stringify(messages, null, 2)}`);
      
      // Appeler l'API Cohere Chat avec le modèle command-a-03-2025
      const response = await this.cohereV2.chat({
        model: "command-a-03-2025",
        messages: messages,
        temperature: 0.3,
        max_tokens: 50
      });
      
      console.log(`📝 Réponse reçue: ${JSON.stringify(response, null, 2)}`);

      if (response && response.message && response.message.content && response.message.content[0] && response.message.content[0].text) {
        let generatedText = response.message.content[0].text.trim();
        
        // Nettoyer la réponse
        generatedText = generatedText
          .replace(/^(Assistant:|Bot:|AI:|Mr le Manager:)/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Vérifier si la réponse est en français
        if (!this.isFrenchText(generatedText)) {
          console.log(`⚠️ Réponse Cohere en anglais détectée, rejetée`);
          return null;
        }
        
        // Pas de limitation de longueur - laisser l'IA répondre naturellement
        
        if (generatedText.length > 5) {
          console.log(`✅ Réponse Cohere générée: ${generatedText}...`);
          return generatedText;
        }
      }
      
      console.log(`⚠️ Cohere n'a pas généré de réponse valide`);
      return null;
      
    } catch (error) {
      console.error('Erreur lors de l\'appel Cohere:', error);
      return null;
    }
  }

  /**
   * Génère une réponse avec la nouvelle API Cohere Chat (avec historique)
   */
  async generateCohereChatResponse(message, context) {
    try {
      const author = context.author || 'Utilisateur';
      const isPrivate = !context.isGroup;
      
      console.log(`🤖 Appel Cohere Chat pour: "${message}"`);
      
      // Récupérer l'historique des messages
      const chatHistory = await this.getChatHistory(context.chatId, 10);
      
      // Construire les messages pour l'API chat
      const messages = [
        {
          role: "system",
          content: `Tu es Mr le Manager de Promillys. Tu gères les présences et tous besoins de l'entreprise et conseils.

RÈGLES ABSOLUES:
- Réponds UNIQUEMENT en français
- Sois simple et direct
- Reste dans ton rôle de gestionnaire
- Ne donne JAMAIS de recettes ou conseils non liés au travail

EXEMPLES OBLIGATOIRES:
- "Salut" → "Salut ! Comment ça va ?"
- "Ça va bien et toi ?" → "Ça va très bien, merci !"
- "Comment faire des gâteaux" → "Je ne peux pas t'aider avec ça, je gère les présences."
- "Comment tu vas ?" → "Ça va bien, merci !"`
        }
      ];
      
      // Ajouter l'historique des conversations
      if (chatHistory.length > 0) {
        const recentMessages = chatHistory.slice(-8); // Garder les 8 derniers messages
        
        recentMessages.forEach(msg => {
          // Déterminer l'expéditeur
          let sender;
          if (msg.from_number === 'BOT') {
            sender = "assistant";
          } else {
            const msgFrom = msg.from_number.replace('@c.us', '');
            const userPhone = context.userPhone.replace('@c.us', '');
            sender = msgFrom === userPhone ? "user" : "assistant";
          }
          
          // Ajouter le message à l'historique
          messages.push({
            role: sender,
            content: msg.content
          });
        });
      }
      
      // Ajouter le message actuel
      messages.push({
        role: "user",
        content: message
      });
      
      // Construire le prompt pour l'API generate
      let prompt = messages[0].content + "\n\n";
      
      // Ajouter l'historique
      for (let i = 1; i < messages.length - 1; i++) {
        const msg = messages[i];
        if (msg.role === "user") {
          prompt += `Utilisateur: ${msg.content}\n`;
        } else {
          prompt += `Mr le Manager: ${msg.content}\n`;
        }
      }
      
      // Ajouter le message actuel
      prompt += `Utilisateur: ${messages[messages.length - 1].content}\nMr le Manager:`;
      
      console.log(`📝 Prompt construit: ${prompt.substring(0, 200)}...`);
      
      // Appeler l'API Cohere Generate avec le nouveau modèle
      const response = await this.cohere.generate({
        model: "command-a-03-2025",
        prompt: prompt,
        temperature: 0.3,
        max_tokens: 150
      });
      
      console.log(`📝 Réponse reçue: ${JSON.stringify(response, null, 2)}`);

      if (response && response.text) {
        let generatedText = response.text.trim();
        
        // Nettoyer la réponse
        generatedText = generatedText
          .replace(/^(Assistant:|Bot:|AI:|Mr le Manager:)/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Vérifier si la réponse est en français
        if (!this.isFrenchText(generatedText)) {
          console.log(`⚠️ Réponse Cohere Chat en anglais détectée, rejetée`);
          return null;
        }
        
        // Pas de limitation de longueur - laisser l'IA répondre naturellement
        
        if (generatedText.length > 5) {
          console.log(`✅ Réponse Cohere Chat générée: ${generatedText}...`);
          return generatedText;
        }
      }
      
      console.log(`⚠️ Cohere Chat n'a pas généré de réponse valide`);
      return null;
      
    } catch (error) {
      console.error('Erreur lors de l\'appel Cohere Chat:', error);
      return null;
    }
  }

  /**
   * Génère une réponse avec Cohere (API gratuite qui fonctionne)
   */
  async generateAlternativeAIResponse(message, context) {
    try {
      const author = context.author || 'Utilisateur';
      const isPrivate = !context.isGroup;
      
      console.log(`🔄 Tentative avec Cohere pour: "${message}"`);
      
      // Utiliser l'API Cohere avec la personnalité de Mr le Manager
      const response = await this.cohere.generate({
        model: 'command',
        prompt: `Tu es Mr le Manager de Promillys. Tu gères les présences et tous besoins de l'entreprise et conseils.

RÈGLES ABSOLUES:
- Réponds UNIQUEMENT en français
- Sois simple et direct
- Reste dans ton rôle de gestionnaire
- Ne donne JAMAIS de recettes ou conseils non liés au travail

EXEMPLES OBLIGATOIRES:
- "Salut" → "Salut ! Comment ça va ?"
- "Ça va bien et toi ?" → "Ça va très bien, merci !"
- "Comment faire des gâteaux" → "Je ne peux pas t'aider avec ça, je gère les présences."
- "Comment tu vas ?" → "Ça va bien, merci !"

Utilisateur: ${message}
Mr le Manager:`,
        max_tokens: 80,
        temperature: 0.3,
        stop_sequences: ['Utilisateur:', 'Assistant:', 'Mr le Manager:', '\n\n', 'RÈGLES:']
      });

      if (response && response.generations && response.generations[0] && response.generations[0].text) {
        let generatedText = response.generations[0].text.trim();
        
        // Nettoyer la réponse
        generatedText = generatedText
          .replace(/^(Assistant:|Bot:|AI:|Mr le Manager:)/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Vérifier si la réponse est en français
        if (!this.isFrenchText(generatedText)) {
          console.log(`⚠️ Réponse alternative en anglais détectée, rejetée`);
          return null; // Rejeter les réponses en anglais
        }
        
        // Pas de limitation de longueur - laisser l'IA répondre naturellement
        
        if (generatedText.length > 5) {
          console.log(`✅ Réponse Cohere générée: ${generatedText}...`);
          return generatedText;
        }
      }
      
      console.log(`⚠️ Cohere n'a pas généré de réponse valide`);
      return null;
      
    } catch (error) {
      console.error('Erreur Cohere:', error);
      return null;
    }
  }

  /**
   * Génère une réponse avec une vraie IA conversationnelle
   */
  async generateConversationalAIResponse(message, context) {
    try {
      if (!this.conversationalAI.enabled) {
        console.log(`⚠️ IA conversationnelle désactivée`);
        return null;
      }

      const isPrivate = !context.isGroup;
      const author = context.author || 'Utilisateur';
      
      console.log(`🤖 Construction du prompt pour l'IA...`);
      
      // Construire le prompt contextuel
      const systemPrompt = this.buildSystemPrompt(context);
      const userMessage = await this.buildUserMessage(message, context);
      
      console.log(`📝 System prompt: ${systemPrompt.substring(0, 100)}...`);
      console.log(`📝 User message: ${userMessage.substring(0, 100)}...`);
      
      // Appeler l'IA conversationnelle
      const response = await this.callConversationalAI(systemPrompt, userMessage, context);
      
      if (response && response.trim() && response.length > 5) {
        console.log(`✅ Réponse brute de l'IA: ${response.substring(0, 100)}...`);
        const formattedResponse = this.formatAIResponse(response, context);
        console.log(`✅ Réponse formatée: ${formattedResponse.substring(0, 100)}...`);
        return formattedResponse;
      }
      
      console.log(`⚠️ Aucune réponse valide de l'IA`);
      return null;
      
    } catch (error) {
      console.error('Erreur lors de l\'appel à l\'IA conversationnelle:', error);
      return null;
    }
  }

  /**
   * Construit le prompt système pour l'IA
   */
  buildSystemPrompt(context) {
    const isPrivate = !context.isGroup;
    const author = context.author || 'Utilisateur';
    
    if (isPrivate) {
      return `Tu es Mr le Manager, l'assistant IA de Promillys. Tu es convivial et professionnel.

RÈGLES STRICTES:
- Réponds UNIQUEMENT en français, JAMAIS en anglais
- Maximum 1-2 phrases courtes et naturelles
- Sois amical mais professionnel
- Réponds comme un humain normal, pas une machine
- Utilise l'historique pour être cohérent
- Si on te salue, salue en retour
- Si on te demande comment tu vas, dis que ça va bien
- Reste dans le contexte de la conversation

EXEMPLES:
- "Salut" → "Salut ! Comment ça va ?"
- "Ça va bien et toi ?" → "Ça va très bien, merci !"
- "Comment tu vas ?" → "Ça va bien, merci ! Et toi ?"`;
    } else {
      return `Tu es Mr le Manager, l'assistant IA de Promillys. Tu es convivial et professionnel.

RÈGLES STRICTES:
- Réponds UNIQUEMENT en français, JAMAIS en anglais
- Maximum 1-2 phrases courtes et naturelles
- Sois amical mais professionnel
- Réponds comme un humain normal, pas une machine

EXEMPLES:
- "Salut" → "Salut ! Comment ça va ?"
- "Ça va bien et toi ?" → "Ça va très bien, merci !"`;
    }
  }

  /**
   * Construit le message utilisateur pour l'IA avec l'historique intelligent
   */
  async buildUserMessage(message, context) {
    const isPrivate = !context.isGroup;
    const author = context.author || 'Utilisateur';
    
    if (isPrivate) {
      // Récupérer l'historique des messages privés récents
      const chatHistory = await this.getChatHistory(context.chatId, 8);
      
      if (chatHistory.length > 0) {
        let historyText = "Conversation récente:\n";
        
        // Filtrer et formater l'historique
        const recentMessages = chatHistory.slice(-6); // Garder seulement les 6 derniers
        
        recentMessages.forEach(msg => {
          // Déterminer l'expéditeur
          let sender;
          if (msg.from_number === 'BOT') {
            sender = "Mr le Manager";
          } else {
            // Normaliser les numéros pour la comparaison
            const msgFrom = msg.from_number.replace('@c.us', '');
            const userPhone = context.userPhone.replace('@c.us', '');
            sender = msgFrom === userPhone ? author : "Mr le Manager";
          }
          
          const time = new Date(msg.created_at).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          historyText += `[${time}] ${sender}: "${msg.content}"\n`;
        });
        
        historyText += `\nMaintenant, ${author} dit: "${message}"`;
        return historyText;
      }
    }
    
    if (isPrivate) {
      return `${author} dit: "${message}"`;
    } else {
      return `Dans le groupe, ${author} dit: "${message}"`;
    }
  }

  /**
   * Récupère l'historique des messages pour un chat avec plus de contexte
   */
  async getChatHistory(chatId, limit = 10) {
    try {
      // Vérifier que chatId est valide
      if (!chatId) {
        console.log('⚠️ chatId manquant pour l\'historique');
        return [];
      }

      // S'assurer que limit est un nombre entier et valide
      let limitInt = parseInt(limit) || 10;
      if (limitInt <= 0 || limitInt > 100) {
        console.log('⚠️ Limite invalide, utilisation de la valeur par défaut');
        limitInt = 10;
      }
      
      console.log(`🔍 Récupération de l'historique pour: ${chatId}`);
      console.log(`🔍 Paramètres: chatId=${chatId}, limit=${limitInt}, type limit=${typeof limitInt}`);
      
      // Pour les messages privés, chercher par group_id = chatId (ID du contact)
      // Pour les messages de groupe, chercher par group_id = groupId
      // Note: LIMIT ne peut pas utiliser de paramètres préparés avec mysql2
      const messages = await db.query(`
        SELECT 
          content,
          from_number,
          created_at,
          message_type
        FROM messages 
        WHERE group_id = ? 
        AND content IS NOT NULL 
        AND content != ''
        AND content NOT LIKE '%🤖%'
        AND content NOT LIKE '%👨‍💼%'
        AND LENGTH(content) > 2
        AND LENGTH(content) < 200
        AND content NOT LIKE '%plateforme%'
        AND content NOT LIKE '%travail%'
        AND content NOT LIKE '%bienvenu%'
        ORDER BY created_at DESC 
        LIMIT ${limitInt}
      `, [String(chatId)]);
      
      console.log(`📚 ${messages.length} messages trouvés dans l'historique`);
      return messages.reverse(); // Inverser pour avoir l'ordre chronologique
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique:', error);
      return [];
    }
  }

  /**
   * Appelle l'IA conversationnelle (Cohere par défaut)
   */
  async callConversationalAI(systemPrompt, userMessage, context) {
    try {
      if (this.conversationalAI.provider === 'cohere') {
        return await this.callCohereAI(systemPrompt, userMessage, context);
      } else if (this.conversationalAI.provider === 'huggingface') {
        return await this.callHuggingFaceAI(systemPrompt, userMessage, context);
      } else if (this.conversationalAI.provider === 'openai') {
        return await this.callOpenAI(systemPrompt, userMessage, context);
      }
      
      return null;
    } catch (error) {
      console.error('Erreur lors de l\'appel à l\'IA:', error);
      return null;
    }
  }

  /**
   * Appelle Cohere pour la génération de texte
   */
  async callCohereAI(systemPrompt, userMessage, context) {
    try {
      const isPrivate = !context.isGroup;
      const author = context.author || 'Utilisateur';
      
      console.log(`🤖 Appel Cohere pour IA conversationnelle`);
      
      const response = await this.cohere.generate({
        model: 'command',
        prompt: `${systemPrompt}

${userMessage}
Mr le Manager:`,
        max_tokens: this.conversationalAI.maxLength,
        temperature: this.conversationalAI.temperature,
        stop_sequences: ['Utilisateur:', 'Assistant:', 'Mr le Manager:', '\n\n', 'RÈGLES:']
      });

      if (response && response.generations && response.generations[0] && response.generations[0].text) {
        let generatedText = response.generations[0].text.trim();
        
        // Nettoyer la réponse
        generatedText = generatedText
          .replace(/^(Assistant:|Bot:|AI:|Mr le Manager:)/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Vérifier si la réponse est en français
        if (!this.isFrenchText(generatedText)) {
          console.log(`⚠️ Réponse en anglais détectée, utilisation du fallback`);
          return null; // Forcer l'utilisation du fallback
        }
        
        // Pas de limitation de longueur - laisser l'IA répondre naturellement
        
        if (generatedText.length > 5) {
          console.log(`✅ Réponse Cohere générée: ${generatedText}...`);
          return generatedText;
        }
      }
      
      console.log('⚠️ Aucune réponse générée par Cohere');
      return null;
      
    } catch (error) {
      console.error('Erreur lors de l\'appel à Cohere:', error);
      return null;
    }
  }

  /**
   * Vérifie si le texte est en français
   */
  isFrenchText(text) {
    const frenchWords = ['je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'mais', 'donc', 'car', 'ni', 'que', 'qui', 'quoi', 'où', 'quand', 'comment', 'pourquoi', 'bonjour', 'salut', 'merci', 'oui', 'non', 'peut', 'peux', 'peuvent', 'dois', 'doit', 'doivent', 'veux', 'veut', 'veulent', 'aide', 'aider', 'besoin', 'faire', 'être', 'avoir', 'aller', 'venir', 'voir', 'savoir', 'pouvoir', 'vouloir', 'devoir', 'falloir', 'ça', 'va', 'bien', 'mal', 'très', 'trop', 'plus', 'moins', 'tout', 'tous', 'toute', 'toutes'];
    const englishWords = ['the', 'and', 'you', 'are', 'for', 'not', 'with', 'this', 'that', 'have', 'will', 'can', 'could', 'should', 'would', 'hello', 'hi', 'yes', 'no', 'thank', 'thanks', 'sorry', 'excuse', 'understand', 'help', 'please', 'good', 'bad', 'very', 'much', 'more', 'less', 'all', 'some', 'any', 'what', 'when', 'where', 'why', 'how', 'who', 'which'];
    
    const textLower = text.toLowerCase();
    const frenchWordCount = frenchWords.filter(word => textLower.includes(word)).length;
    const englishWordCount = englishWords.filter(word => textLower.includes(word)).length;
    
    // Si plus de mots anglais que français, c'est probablement en anglais
    if (englishWordCount > frenchWordCount && englishWordCount > 0) {
      return false;
    }
    
    return frenchWordCount > 0 || text.length < 20;
  }

  /**
   * Traduit une réponse en anglais vers le français
   */
  translateToFrench(text, context) {
    const isPrivate = !context.isGroup;
    const author = context.author || 'Utilisateur';
    
    // Réponses de fallback en français pour les salutations communes
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('hello') || lowerText.includes('hi')) {
      return `Salut ! Comment ça va ?`;
    }
    
    if (lowerText.includes('how are you') || lowerText.includes('how do you do')) {
      return `Ça va bien, merci ! Et toi ?`;
    }
    
    if (lowerText.includes('good morning') || lowerText.includes('good afternoon')) {
      return `Bonjour ! Comment puis-je t'aider ?`;
    }
    
    if (lowerText.includes('thank you') || lowerText.includes('thanks')) {
      return `De rien ! Autre chose ?`;
    }
    
    if (lowerText.includes('goodbye') || lowerText.includes('bye')) {
      return `À bientôt !`;
    }
    
    if (lowerText.includes('commitment') || lowerText.includes('team') || lowerText.includes('working')) {
      return `Parfait ! Comment puis-je t'aider ?`;
    }
    
    if (lowerText.includes('understand') || lowerText.includes('comprehension')) {
      return `D'accord ! Que veux-tu savoir ?`;
    }
    
    // Réponse générique en français
    return `Salut ! Comment puis-je t'aider ?`;
  }

  /**
   * Appelle Hugging Face pour la génération de texte
   */
  async callHuggingFaceAI(systemPrompt, userMessage, context) {
    try {
      // Format pour GPT-2
      const prompt = `${systemPrompt}\n\n${userMessage}\n\nAssistant:`;
      
      console.log(`🤖 Appel Hugging Face avec GPT-2`);
      console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);
      
      const response = await this.hf.textGeneration({
        model: this.conversationalAI.model,
        inputs: prompt,
        parameters: {
          max_new_tokens: this.conversationalAI.maxLength,
          temperature: this.conversationalAI.temperature,
          return_full_text: false,
          do_sample: true,
          top_p: 0.9,
          repetition_penalty: 1.1,
          pad_token_id: 50256 // Token de padding pour DialoGPT
        }
      });

      if (response && response[0] && response[0].generated_text) {
        let generatedText = response[0].generated_text.trim();
        
        // Nettoyer la réponse GPT-2
        generatedText = this.cleanGPT2Response(generatedText);
        
        console.log(`✅ Réponse générée: ${generatedText.substring(0, 100)}...`);
        return generatedText;
      }
      
      console.log('⚠️ Aucune réponse générée par Hugging Face');
      return null;
    } catch (error) {
      console.error('❌ Erreur Hugging Face:', error);
      return null;
    }
  }

  /**
   * Nettoie les réponses de GPT-2
   */
  cleanGPT2Response(text) {
    let cleaned = text
      // Supprimer les préfixes indésirables
      .replace(/^(Assistant:|Bot:|AI:|Réponse:)/gi, '')
      .replace(/^(Je suis|Je pense|Je crois|Je vais|Je peux)/gi, '')
      // Supprimer les répétitions communes
      .replace(/\b(je|tu|il|elle|nous|vous|ils|elles)\s+\1\b/gi, '$1')
      .replace(/\b(et|mais|donc|alors|puis)\s+\1\b/gi, '$1')
      .replace(/\b(oui|non|bien|très|trop)\s+\1\b/gi, '$1')
      // Nettoyer les espaces
      .replace(/\s+/g, ' ')
      .trim();
    
    // Supprimer les réponses trop courtes ou génériques
    if (cleaned.length < 5 || 
        cleaned.toLowerCase().includes('ah oui') || 
        cleaned.toLowerCase().includes('raconte-moi') ||
        cleaned.toLowerCase().includes('c\'est intéressant') ||
        cleaned.toLowerCase().includes('c est intéressant')) {
      return null; // Rejeter les réponses génériques
    }
    
    // Limiter la longueur
    if (cleaned.length > 300) {
      cleaned = cleaned.substring(0, 300) + '...';
    }
    
    return cleaned;
  }

  /**
   * Appelle OpenAI (si configuré)
   */
  async callOpenAI(systemPrompt, userMessage, context) {
    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: this.conversationalAI.maxLength,
        temperature: this.conversationalAI.temperature
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.choices && response.data.choices[0]) {
        return response.data.choices[0].message.content.trim();
      }
      
      return null;
    } catch (error) {
      console.error('Erreur OpenAI:', error);
      return null;
    }
  }

  /**
   * Formate la réponse de l'IA
   */
  formatAIResponse(response, context) {
    const isPrivate = !context.isGroup;
    
    // Nettoyer la réponse
    let cleanResponse = response
      .replace(/Assistant:/g, '')
      .replace(/User:/g, '')
      .replace(/Bot:/g, '')
      .replace(/Mr le Manager:/g, '')
      .trim();
    
    // Ajouter un emoji si la réponse n'en a pas
    if (!cleanResponse.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u)) {
      cleanResponse = `👨‍💼 ${cleanResponse}`;
    }
    
    return cleanResponse;
  }

  /**
   * Génère un fallback intelligent si l'IA échoue
   */
  generateIntelligentFallback(message, context) {
    const isPrivate = !context.isGroup;
    const author = context.author || 'Utilisateur';
    const messageLower = message.toLowerCase();
    
    // Questions spécifiques sur les capacités du bot
    if (messageLower.includes('que peux-tu faire') || messageLower.includes('que peux tu faire') ||
        messageLower.includes('qu\'est-ce que tu peux faire') || messageLower.includes('qu est ce que tu peux faire') ||
        messageLower.includes('tes capacités') || messageLower.includes('tes capacites') ||
        messageLower.includes('que sais-tu faire') || messageLower.includes('que sais tu faire')) {
      return this.generateBotFunctionalityResponse(message, context);
    }
    
    // Questions sur ce qu'est un chat
    if (messageLower.includes('c\'est quoi un chat') || messageLower.includes('c est quoi un chat') ||
        messageLower.includes('qu\'est-ce qu\'un chat') || messageLower.includes('qu est ce qu un chat') ||
        messageLower.includes('définition chat') || messageLower.includes('definition chat')) {
      return `💬 Un chat est une conversation en temps réel, généralement par messages textuels. C'est un moyen de communication instantané où on peut échanger des idées, poser des questions et partager des informations rapidement ! 😊`;
    }
    
    // Questions sur l'heure d'arrivée
    if (messageLower.includes('à quelle heure') || messageLower.includes('a quelle heure') ||
        messageLower.includes('quelle heure') || messageLower.includes('heure d\'arrivée') ||
        messageLower.includes('heure d arrivee') || messageLower.includes('je suis venue') ||
        messageLower.includes('je suis venu') || messageLower.includes('arrivée à')) {
      return `⏰ Pour vérifier votre heure d'arrivée, je peux consulter vos présences. Cependant, cette fonctionnalité nécessite que vous soyez enregistré dans notre système. Pouvez-vous me dire votre nom ou votre numéro d'employé ? 😊`;
    }
    
    // Questions sur les présences
    if (messageLower.includes('présence') || messageLower.includes('presence') ||
        messageLower.includes('mon statut') || messageLower.includes('statut du jour') ||
        messageLower.includes('aujourd\'hui') || messageLower.includes('aujourd hui')) {
      return `📊 Pour consulter votre présence, je peux vous aider ! Dites-moi simplement "mon statut" ou "présence" et je vérifierai vos informations. 😊`;
    }
    
    // Questions sur les permissions
    if (messageLower.includes('permission') || messageLower.includes('congé') || messageLower.includes('conge') ||
        messageLower.includes('vacances') || messageLower.includes('absence')) {
      return `📋 Pour les permissions et congés, je peux vous aider à faire une demande ! Dites-moi simplement "je veux prendre congé" suivi des dates et je vous guiderai. 😊`;
    }
    
    // Réponses spécialisées basées sur le contenu exact
    if (messageLower.includes('retard') || messageLower.includes('en retard')) {
      return this.generateResponseAboutLateness(message, context);
    }
    
    if (messageLower.includes('parle mal') || messageLower.includes('mal parler') || messageLower.includes('respect')) {
      return this.generateResponseAboutRespect(message, context);
    }
    
    if (messageLower.includes('équipe') || messageLower.includes('collègue') || messageLower.includes('collaboration')) {
      return this.generateResponseAboutTeam(message, context);
    }
    
    if (messageLower.includes('communication') || messageLower.includes('communiquer')) {
      return this.generateResponseAboutCommunication(message, context);
    }
    
    if (messageLower.includes('décision') || messageLower.includes('choisir') || messageLower.includes('choix')) {
      return this.generateResponseAboutDecision(message, context);
    }
    
    if (messageLower.includes('problème') || messageLower.includes('difficulté') || messageLower.includes('souci')) {
      return this.generateResponseAboutProblem(message, context);
    }
    
    if (messageLower.includes('politesse') || messageLower.includes('poli') || messageLower.includes('respectueux')) {
      return this.generateResponseAboutPoliteness(message, context);
    }
    
    if (messageLower.includes('travail') || messageLower.includes('bureau') || messageLower.includes('entreprise')) {
      return this.generateResponseAboutWork(message, context);
    }
    
    if (messageLower.includes('météo') || messageLower.includes('temps') || messageLower.includes('pluie') || messageLower.includes('soleil')) {
      return this.generateResponseAboutWeather(message, context);
    }
    
    if (messageLower.includes('santé') || messageLower.includes('malade') || messageLower.includes('fatigue')) {
      return this.generateResponseAboutHealth(message, context);
    }
    
    if (messageLower.includes('technologie') || messageLower.includes('tech') || messageLower.includes('ordinateur')) {
      return this.generateResponseAboutTechnology(message, context);
    }
    
    if (messageLower.includes('nourriture') || messageLower.includes('manger') || messageLower.includes('cuisine')) {
      return this.generateResponseAboutFood(message, context);
    }
    
    // Questions de présence simples
    if (messageLower.includes('es-tu là') || messageLower.includes('es tu la') || 
        messageLower.includes('tu es là') || messageLower.includes('tu es la') ||
        messageLower.includes('est-ce que tu es là') || messageLower.includes('est ce que tu es la') ||
        messageLower.includes('es-tu en ligne') || messageLower.includes('es tu en ligne') ||
        messageLower.includes('tu m\'entends') || messageLower.includes('tu m entends')) {
      return `👋 Oui, je suis là ! Comment puis-je vous aider ? 😊`;
    }
    
    // Questions de bien-être
    if (messageLower.includes('comment ça va') || messageLower.includes('comment ca va') ||
        messageLower.includes('ça va') || messageLower.includes('ca va') ||
        messageLower.includes('comment allez-vous') || messageLower.includes('comment allez vous')) {
      return `😊 Ça va très bien, merci ! Et vous, comment allez-vous ? Comment puis-je vous aider ?`;
    }
    
    // Salutations
    if (messageLower.includes('bonjour') || messageLower.includes('salut')) {
      return `👋 Bonjour ${isPrivate ? author : ''} ! Comment puis-je vous aider aujourd'hui ?`;
    }
    
    // Remerciements
    if (messageLower.includes('merci') || messageLower.includes('thanks')) {
      return `😊 De rien ! C'est un plaisir de vous aider. N'hésitez pas si vous avez d'autres questions !`;
    }
    
    // Questions génériques (en dernier)
    if (messageLower.includes('?')) {
      return `🤔 C'est une excellente question ! Laissez-moi réfléchir à cela et vous donner une réponse réfléchie.`;
    }
    
    // Réponses spécifiques pour "Te raconter quoi"
    if (messageLower.includes('te raconter quoi') || messageLower.includes('raconter quoi') || 
        messageLower.includes('que raconter') || messageLower.includes('quoi raconter')) {
      return `😊 Tu peux me raconter n'importe quoi ! Je suis là pour t'écouter et discuter avec toi. 
      
Par exemple, tu peux me parler de :
• Ta journée de travail
• Tes projets et idées
• Tes loisirs et passions
• Tes questions sur la vie
• Tout ce qui te passe par la tête !

Dis-moi ce qui t'intéresse ou ce qui te préoccupe, je serai ravi d'en discuter avec toi ! 😊`;
    }
    
    // Réponse générique intelligente
    return `🤖 C'est un sujet intéressant ! Pouvez-vous me donner plus de détails pour que je puisse mieux comprendre et vous aider ?`;
  }

  /**
   * Génère une réponse vraiment intelligente basée sur le contenu du message
   */
  generateIntelligentResponse(message, context, sentiment, topic) {
    const isPrivate = !context.isGroup;
    const author = context.author || 'Utilisateur';
    const messageLower = message.toLowerCase();
    
    console.log(`🧠 Génération de réponse intelligente pour: "${message}"`);
    
    // Vérifier si c'est une question sur les fonctionnalités du bot
    if (this.isBotFunctionalityQuestion(message)) {
      console.log(`📋 Question sur les fonctionnalités détectée`);
      return this.generateBotFunctionalityResponse(message, context);
    }
    
    // AUCUNE réponse générique - retourner null pour forcer l'utilisation de l'IA
    console.log(`⚠️ Aucune réponse prédéfinie - utilisation de l'IA requise`);
    return null;
  }








  /**
   * Vérifie si c'est une justification de retard
   */
  async isLateArrivalJustification(contact, message) {
    try {
      const db = require('../config/database');
      const today = moment().format('YYYY-MM-DD');
      
      // Vérifier si l'employé a une présence en attente de justification
      const attendance = await db.query(
        'SELECT * FROM attendance WHERE employee_id = ? AND date = ? AND notes LIKE ?',
        [contact.number, today, '%En attente de justification%']
      );
      
      return attendance.length > 0;
    } catch (error) {
      console.error('Erreur lors de la vérification de justification:', error);
      return false;
    }
  }

  /**
   * Définit les heures personnalisées pour un employé
   */
  async setEmployeeCustomHours(employeeId, startTime, endTime, lateThreshold) {
    try {
      const db = require('../config/database');
      
      await db.query(
        'UPDATE employees SET custom_start_time = ?, custom_end_time = ?, custom_late_threshold = ?, updated_at = NOW() WHERE id = ?',
        [startTime, endTime, lateThreshold, employeeId]
      );
      
      console.log(`✅ Heures personnalisées définies pour l'employé ${employeeId}: ${startTime} - ${endTime} (seuil: ${lateThreshold}min)`);
      return true;
    } catch (error) {
      console.error('Erreur lors de la définition des heures personnalisées:', error);
      return false;
    }
  }

  /**
   * Récupère les heures personnalisées d'un employé
   */
  async getEmployeeCustomHours(employeeId) {
    try {
      const db = require('../config/database');
      
      const result = await db.query(
        'SELECT custom_start_time, custom_end_time, custom_late_threshold FROM employees WHERE id = ?',
        [employeeId]
      );
      
      if (result.length > 0) {
        return {
          startTime: result[0].custom_start_time,
          endTime: result[0].custom_end_time,
          lateThreshold: result[0].custom_late_threshold
        };
      }
      
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération des heures personnalisées:', error);
      return null;
    }
  }

  /**
   * Supprime les heures personnalisées d'un employé (retour aux heures par défaut)
   */
  async removeEmployeeCustomHours(employeeId) {
    try {
      const db = require('../config/database');
      
      await db.query(
        'UPDATE employees SET custom_start_time = NULL, custom_end_time = NULL, custom_late_threshold = NULL, updated_at = NOW() WHERE id = ?',
        [employeeId]
      );
      
      console.log(`✅ Heures personnalisées supprimées pour l'employé ${employeeId} - retour aux heures par défaut`);
      return true;
    } catch (error) {
      console.error('Erreur lors de la suppression des heures personnalisées:', error);
      return false;
    }
  }

  /**
   * Traite un message avec l'IA et exécute l'action appropriée
   */
  async processMessage(message, contact, chat) {
    try {
      const context = {
        author: contact.name || contact.number,
        chatId: chat?.id?._serialized || contact?.id?._serialized || contact?.number || 'unknown',
        isGroup: chat?.isGroup || false,
        timestamp: new Date(),
        userPhone: contact.number,
        contactNumber: contact.number
      };

      console.log(`🔍 Contexte créé - chatId: ${context.chatId}, isGroup: ${context.isGroup}`);

      // Vérifier si c'est une justification de retard
      const isJustification = await this.isLateArrivalJustification(contact, message);
      if (isJustification) {
        console.log(`📝 Justification de retard détectée`);
        await this.processLateArrivalJustification(contact, message, context);
        return {
          analysis: { type: 'late_justification', action: 'process_justification', confidence: 1.0 },
          response: `✅ Justification reçue et enregistrée. Merci !`,
          shouldProcess: true
        };
      }

      // Analyser le message
      const analysis = await this.analyzeMessage(message, context);
      
      // Sauvegarder l'analyse en base
      await this.saveAnalysis(analysis, contact, chat);

      // Récupérer l'employé correctement via le bot WhatsApp
      let employee = null;
      try {
        const WhatsAppBot = require('./whatsappBot');
        employee = await WhatsAppBot.getOrCreateEmployee(contact);
      } catch (error) {
        console.error('❌ Erreur lors de la récupération de l\'employé:', error);
        // Si l'employé n'existe pas, créer un objet temporaire
        employee = {
          id: contact.number,
          name: contact.name || contact.pushname || 'Employé',
          phone: contact.number,
          whatsapp_id: contact.id._serialized
        };
      }

      // Générer une réponse adaptée au contexte (groupe ou privé)
      const response = await this.generateResponse(analysis, employee, context, message);
      
      // Calculer le seuil effectif comme dans determineAction
      const hasExtractedInfo = analysis.extractedInfo && Object.keys(analysis.extractedInfo).length > 0;
      const isFreeChat = analysis.type === 'mention' || analysis.type === 'free_chat';
      const isPrivateChat = context && !context.isGroup;
      const isAttendance = analysis.type === 'attendance';
      
      // Vérifier si le bot est mentionné dans le message
      const isBotMentioned = this.isBotMentioned(message);
      
      let effectiveThreshold;
      if (isFreeChat) {
        effectiveThreshold = 0.1;
      } else if (isPrivateChat) {
        effectiveThreshold = 0.05;
      } else if (isAttendance && hasExtractedInfo) {
        effectiveThreshold = 0.05;
      } else if (hasExtractedInfo) {
        effectiveThreshold = 0.1;
      } else {
        effectiveThreshold = this.confidenceThreshold;
      }
      
      // Dans les groupes, être très strict si le bot n'est pas mentionné
      if (context && context.isGroup && !isBotMentioned) {
        // Seulement les fonctions importantes (présence, permissions, admin) sans mention
        const isImportantFunction = analysis.type === 'attendance' || 
                                   analysis.type === 'permission' || 
                                   analysis.type === 'admin_command';
        
        if (!isImportantFunction) {
          return {
            analysis,
            response: null,
            shouldProcess: false
          };
        }
      } else if (context && context.isGroup && isBotMentioned) {
        // Si le bot est mentionné dans un groupe, permettre les conversations libres
        if (analysis.type === 'free_chat' || analysis.type === 'mention') {
          analysis.action = 'free_chat';
        }
      }
      
      return {
        analysis,
        response,
        shouldProcess: analysis.action !== 'none' && analysis.confidence >= effectiveThreshold
      };

    } catch (error) {
      console.error('Erreur lors du traitement IA:', error);
      return {
        analysis: { type: 'error', confidence: 0, action: 'none' },
        response: null,
        shouldProcess: false
      };
    }
  }

  /**
   * Vérifie si l'arrivée est en retard
   */
  async checkIfLateArrival(employee) {
    try {
      const db = require('../config/database');
      const moment = require('moment');
      
      // Récupérer les paramètres personnalisés de l'employé
      const employeeData = await db.query(
        'SELECT custom_start_time, custom_late_threshold FROM employees WHERE id = ? OR phone = ?',
        [employee.id, employee.phone]
      );
      
      let startTime, threshold;
      
      if (employeeData.length > 0 && employeeData[0].custom_start_time) {
        // Utiliser les heures personnalisées de l'employé
        startTime = employeeData[0].custom_start_time;
        threshold = employeeData[0].custom_late_threshold || 15;
        console.log(`📅 Heures personnalisées pour ${employee.name}: ${startTime} (seuil: ${threshold}min)`);
      } else {
        // Utiliser les paramètres par défaut de l'entreprise
        const workStartTime = await db.query('SELECT setting_value FROM system_settings WHERE setting_key = ?', ['work_start_time']);
        const lateThreshold = await db.query('SELECT setting_value FROM system_settings WHERE setting_key = ?', ['late_threshold_minutes']);
        
        startTime = workStartTime[0]?.setting_value || '08:00';
        threshold = parseInt(lateThreshold[0]?.setting_value || '15');
        console.log(`📅 Heures par défaut pour ${employee.name}: ${startTime} (seuil: ${threshold}min)`);
      }
      
      const currentTime = moment();
      const expectedStartTime = moment(startTime, 'HH:mm');
      const lateThresholdTime = expectedStartTime.add(threshold, 'minutes');
      
      const isLate = currentTime.isAfter(lateThresholdTime);
      
      if (isLate) {
        const delayMinutes = currentTime.diff(expectedStartTime, 'minutes');
        console.log(`⚠️ Retard détecté: ${delayMinutes} minutes de retard`);
      }
      
      return isLate;
    } catch (error) {
      console.error('Erreur lors de la vérification du retard:', error);
      return false;
    }
  }

  /**
   * Demande une justification pour le retard
   */
  async requestLateArrivalJustification(employee, context) {
    try {
      const WhatsAppBot = require('./whatsappBot');
      const currentTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      
      const message = `⚠️ RETARD DÉTECTÉ - ${currentTime}\n\n` +
        `Bonjour ${employee.name},\n\n` +
        `Je remarque que vous arrivez en retard aujourd'hui. Pourriez-vous me donner une justification pour ce retard ?\n\n` +
        `💡 Répondez simplement avec la raison de votre retard (ex: "Problème de transport", "Rendez-vous médical", etc.)`;
      
      await WhatsAppBot.sendAIMessage(employee.phone + '@c.us', message);
      console.log(`📱 Demande de justification envoyée à ${employee.name}`);
      
      // Marquer que nous attendons une justification
      await this.markWaitingForJustification(employee.id);
      
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la demande de justification:', error);
    }
  }

  /**
   * Marque qu'on attend une justification de l'employé
   */
  async markWaitingForJustification(employeeId) {
    try {
      const db = require('../config/database');
      const today = moment().format('YYYY-MM-DD');
      
      // Mettre à jour la présence pour indiquer qu'on attend une justification
      await db.query(
        'UPDATE attendance SET notes = ?, updated_at = NOW() WHERE employee_id = ? AND date = ?',
        ['En attente de justification du retard', employeeId, today]
      );
      
    } catch (error) {
      console.error('Erreur lors du marquage de l\'attente de justification:', error);
    }
  }

  /**
   * Traite une justification de retard reçue
   */
  async processLateArrivalJustification(employee, justification, context) {
    try {
      const db = require('../config/database');
      const today = moment().format('YYYY-MM-DD');
      
      // Mettre à jour la présence avec la justification
      await db.query(
        'UPDATE attendance SET notes = ?, updated_at = NOW() WHERE employee_id = ? AND date = ?',
        [`Arrivée en retard - Justification: ${justification}`, employee.id, today]
      );
      
      // Envoyer un accusé de réception
      const WhatsAppBot = require('./whatsappBot');
      const message = `✅ Justification reçue\n\n` +
        `Merci ${employee.name} pour votre justification :\n"${justification}"\n\n` +
        `Votre retard a été enregistré avec cette justification.`;
      
      await WhatsAppBot.sendAIMessage(employee.phone + '@c.us', message);
      console.log(`📱 Justification traitée pour ${employee.name}: ${justification}`);
      
      // Notifier l'admin si nécessaire
      await this.notifyAdminLateJustification(employee, justification);
      
    } catch (error) {
      console.error('Erreur lors du traitement de la justification:', error);
    }
  }

  /**
   * Notifie l'admin de la justification de retard
   */
  async notifyAdminLateJustification(employee, justification) {
    try {
      const adminPhone = process.env.ADMIN_PHONE;
      if (!adminPhone) return;
      
      const WhatsAppBot = require('./whatsappBot');
      const currentTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      
      const message = `📋 JUSTIFICATION DE RETARD REÇUE - ${currentTime}\n\n` +
        `👤 Employé: ${employee.name}\n` +
        `📞 Téléphone: ${employee.phone}\n` +
        `📝 Justification: "${justification}"\n\n` +
        `✅ La justification a été enregistrée en base de données.`;
      
      await WhatsAppBot.sendAIMessage(adminPhone, message);
      console.log(`📱 Notification admin envoyée pour la justification de ${employee.name}`);
      
    } catch (error) {
      console.error('Erreur lors de la notification admin:', error);
    }
  }

  /**
   * Sauvegarde la présence en base de données
   */
  async saveAttendanceToDatabase(employee, action, extractedInfo, context) {
    try {
      const db = require('../config/database');
      const moment = require('moment');
      
      const today = moment().format('YYYY-MM-DD');
      const currentTime = moment().format('HH:mm:ss');
      
      // Vérifier si l'employé existe
      if (!employee) {
        console.error('❌ Aucun employé fourni pour l\'enregistrement de présence');
        return;
      }
      
      // Vérifier si l'employé existe en base de données
      let existingEmployee = await db.query(
        'SELECT * FROM employees WHERE id = ?',
        [employee.id]
      );
      
      if (existingEmployee.length === 0) {
        console.error(`❌ Employé ${employee.name} (${employee.phone}) n'existe pas en base de données`);
        console.log('💡 L\'employé devrait être synchronisé via WebSocket au démarrage du bot');
        return;
      }
      
      // Vérifier si l'employé a déjà une entrée pour aujourd'hui
      const existingAttendance = await db.query(
        'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
        [employee.id, today]
      );
      
      let status = 'present';
      let notes = '';
      
      // Vérifier si la même action a déjà été effectuée aujourd'hui
      if (existingAttendance.length > 0) {
        const attendance = existingAttendance[0];
        
        // Vérifier les doublons selon l'action
        switch (action) {
          case 'arrival':
            if (attendance.arrival_time) {
              console.log(`⚠️ ${employee.name} a déjà marqué son arrivée aujourd'hui à ${attendance.arrival_time}`);
              return { 
                error: 'duplicate', 
                message: `Vous avez déjà marqué votre arrivée aujourd'hui à ${attendance.arrival_time}. Pour modifier, contactez l'administrateur.`,
                existingTime: attendance.arrival_time
              };
            }
            break;
          case 'departure':
            if (attendance.departure_time) {
              console.log(`⚠️ ${employee.name} a déjà marqué son départ aujourd'hui à ${attendance.departure_time}`);
              return { 
                error: 'duplicate', 
                message: `Vous avez déjà marqué votre départ aujourd'hui à ${attendance.departure_time}. Pour modifier, contactez l'administrateur.`,
                existingTime: attendance.departure_time
              };
            }
            break;
          case 'lunch_break':
            if (attendance.lunch_start) {
              console.log(`⚠️ ${employee.name} a déjà commencé sa pause déjeuner aujourd'hui à ${attendance.lunch_start}`);
              return { 
                error: 'duplicate', 
                message: `Vous avez déjà commencé votre pause déjeuner aujourd'hui à ${attendance.lunch_start}. Pour modifier, contactez l'administrateur.`,
                existingTime: attendance.lunch_start
              };
            }
            break;
          case 'lunch_return':
            if (attendance.lunch_end) {
              console.log(`⚠️ ${employee.name} a déjà terminé sa pause déjeuner aujourd'hui à ${attendance.lunch_end}`);
              return { 
                error: 'duplicate', 
                message: `Vous avez déjà terminé votre pause déjeuner aujourd'hui à ${attendance.lunch_end}. Pour modifier, contactez l'administrateur.`,
                existingTime: attendance.lunch_end
              };
            }
            break;
          case 'absence':
          case 'mission':
          case 'mission_return':
          case 'remote_work':
          case 'leave':
            // Ces actions peuvent être marquées plusieurs fois dans la journée
            break;
        }
      }
      
      // Déterminer le statut selon l'action
      switch (action) {
        case 'arrival':
          status = 'present';
          notes = 'Arrivée enregistrée';
          
          // Vérifier si c'est un retard
          const isLate = await this.checkIfLateArrival(employee);
          if (isLate) {
            console.log(`⚠️ Retard détecté pour ${employee.name}`);
            notes = 'Arrivée en retard - Justification demandée';
            status = 'late';
            
            // Demander une justification en message privé
            await this.requestLateArrivalJustification(employee, context);
          }
          break;
        case 'departure':
          status = 'present';
          notes = 'Départ enregistré';
          break;
        case 'lunch_break':
          status = 'present';
          notes = 'Pause déjeuner';
          break;
        case 'lunch_return':
          status = 'present';
          notes = 'Retour de pause';
          break;
        case 'absence':
          status = 'absent';
          notes = 'Absence déclarée';
          break;
        case 'mission':
          status = 'on_mission';
          notes = 'Sortie en mission';
          break;
        case 'mission_return':
          status = 'present';
          notes = 'Retour de mission';
          break;
        case 'remote_work':
          status = 'remote';
          notes = 'Télétravail';
          break;
        case 'leave':
          status = 'on_leave';
          notes = 'Congé/Repos';
          break;
      }
      
      if (existingAttendance.length > 0) {
        // Mettre à jour l'entrée existante
        if (action === 'arrival') {
          await db.query(
            'UPDATE attendance SET arrival_time = ?, status = ?, notes = ?, updated_at = NOW() WHERE employee_id = ? AND date = ?',
            [currentTime, status, notes, employee.id, today]
          );
          
          // Retourner l'information sur le retard
          return { isLate: status === 'late' };
        } else if (action === 'departure') {
          // Calculer les heures de travail
          const arrivalTime = moment(existingAttendance[0].arrival_time, 'HH:mm:ss');
          const departureTime = moment(currentTime, 'HH:mm:ss');
          const lunchStart = existingAttendance[0].lunch_start ? moment(existingAttendance[0].lunch_start, 'HH:mm:ss') : null;
          const lunchEnd = existingAttendance[0].lunch_end ? moment(existingAttendance[0].lunch_end, 'HH:mm:ss') : null;
          
          let totalHours = departureTime.diff(arrivalTime, 'hours', true);
          
          // Soustraire la pause déjeuner si elle a été marquée
          if (lunchStart && lunchEnd) {
            const lunchDuration = lunchEnd.diff(lunchStart, 'hours', true);
            totalHours -= lunchDuration;
          }
          
          await db.query(
            'UPDATE attendance SET departure_time = ?, total_work_hours = ?, status = ?, notes = ?, updated_at = NOW() WHERE employee_id = ? AND date = ?',
            [currentTime, totalHours, status, notes, employee.id, today]
          );
        } else if (action === 'lunch_break') {
          await db.query(
            'UPDATE attendance SET lunch_start = ?, status = ?, notes = ?, updated_at = NOW() WHERE employee_id = ? AND date = ?',
            [currentTime, status, notes, employee.id, today]
          );
        } else if (action === 'lunch_return') {
          await db.query(
            'UPDATE attendance SET lunch_end = ?, status = ?, notes = ?, updated_at = NOW() WHERE employee_id = ? AND date = ?',
            [currentTime, status, notes, employee.id, today]
          );
        } else {
          // Autres actions (absence, mission, etc.)
          await db.query(
            'UPDATE attendance SET status = ?, notes = ?, updated_at = NOW() WHERE employee_id = ? AND date = ?',
            [status, notes, employee.id, today]
          );
        }
      } else {
        // Créer une nouvelle entrée
        if (action === 'arrival') {
          await db.query(
            'INSERT INTO attendance (employee_id, date, arrival_time, status, notes) VALUES (?, ?, ?, ?, ?)',
            [employee.id, today, currentTime, status, notes]
          );
          
          // Retourner l'information sur le retard
          return { isLate: status === 'late' };
        } else {
          await db.query(
            'INSERT INTO attendance (employee_id, date, status, notes) VALUES (?, ?, ?, ?)',
            [employee.id, today, status, notes]
          );
        }
      }
      
      console.log(`✅ Présence enregistrée en base: ${action} pour ${employee.name}`);
      
      // Émettre un événement WebSocket pour notifier les clients
      if (global.io) {
        console.log(`🚀 ÉMISSION WEBSOCKET - Envoi de l'événement attendance_update pour ${action} de ${employee.name}`);
        global.io.emit('attendance_update', {
          type: action,
          employee_id: employee.id,
          employee_name: employee.name,
          status: status,
          timestamp: new Date().toISOString(),
          notes: notes
        });
        console.log(`📡 Événement WebSocket "attendance_update" émis pour ${action}`);
      } else {
        console.log(`❌ global.io n'est pas disponible pour émettre l'événement attendance_update`);
      }
      
      // Retourner les informations calculées pour le départ
      if (action === 'departure' && existingAttendance.length > 0) {
        const arrivalTime = moment(existingAttendance[0].arrival_time, 'HH:mm:ss');
        const departureTime = moment(currentTime, 'HH:mm:ss');
        const lunchStart = existingAttendance[0].lunch_start ? moment(existingAttendance[0].lunch_start, 'HH:mm:ss') : null;
        const lunchEnd = existingAttendance[0].lunch_end ? moment(existingAttendance[0].lunch_end, 'HH:mm:ss') : null;
        
        let totalHours = departureTime.diff(arrivalTime, 'hours', true);
        
        // Soustraire la pause déjeuner si elle a été marquée
        if (lunchStart && lunchEnd) {
          const lunchDuration = lunchEnd.diff(lunchStart, 'hours', true);
          totalHours -= lunchDuration;
        }
        
        return { totalHours };
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'enregistrement de la présence:', error);
      return null;
    }
  }

  /**
   * Sauvegarde l'analyse en base de données
   */
  async saveAnalysis(analysis, contact, chat) {
    try {
      await db.query(`
        INSERT INTO ai_analysis (
          message_id, from_number, group_id, message_content,
          analysis_type, confidence, action, extracted_info,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `ai_${Date.now()}`,
        contact?.number || 'unknown',
        chat?.id?._serialized || contact?.id?._serialized || 'unknown',
        analysis.originalMessage,
        analysis.type,
        analysis.confidence,
        analysis.action,
        JSON.stringify(analysis.extractedInfo),
        new Date()
      ]);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'analyse:', error);
    }
  }

  /**
   * Obtient les statistiques de l'IA
   */
  async getStats() {
    try {
      const stats = await db.query(`
        SELECT 
          COUNT(*) as total_analyses,
          COUNT(CASE WHEN confidence >= 0.7 THEN 1 END) as high_confidence,
          COUNT(CASE WHEN action != 'none' THEN 1 END) as actions_taken,
          analysis_type,
          COUNT(*) as count_by_type
        FROM ai_analysis 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY analysis_type
      `);

      return stats;
    } catch (error) {
      console.error('Erreur lors de la récupération des stats IA:', error);
      return [];
    }
  }

  /**
   * Gère les commandes d'administration
   */
  async handleAdminCommand(message, context) {
    try {
      const messageLower = message.toLowerCase().trim();
      const isGroup = context.isGroup;
      const author = context.author || 'Utilisateur';
      
      // Vérifier si l'utilisateur est un administrateur du groupe WhatsApp
      if (!this.whatsappBot) {
        return `❌ Bot WhatsApp non disponible. Contactez le développeur.`;
      }
      
      // Créer un objet contact simulé pour la vérification
      const phoneNumber = context.contactNumber || context.userPhone;
      const contact = {
        id: { _serialized: phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us` },
        name: author,
        number: phoneNumber
      };
      
      let isGroupAdmin = false;
      
      if (isGroup) {
        // Pour les messages de groupe, récupérer le chat et vérifier le statut admin
        try {
          const chatId = context.chatId;
          const chat = await this.whatsappBot.client.getChatById(chatId);
          isGroupAdmin = await this.whatsappBot.isGroupAdmin(contact, chat);
        } catch (error) {
          console.error('Erreur lors de la vérification admin du groupe:', error);
          return `❌ Erreur lors de la vérification des permissions.`;
        }
      } else {
        // Pour les messages privés, vérifier si c'est un membre du groupe
        try {
          const isMember = await this.whatsappBot.isGroupMember(contact);
          if (isMember) {
            // Si c'est un membre, vérifier s'il est admin du groupe
            const groupId = process.env.WHATSAPP_GROUP_ID;
            if (groupId) {
              const chat = await this.whatsappBot.client.getChatById(groupId);
              isGroupAdmin = await this.whatsappBot.isGroupAdmin(contact, chat);
            }
          }
        } catch (error) {
          console.error('Erreur lors de la vérification admin pour message privé:', error);
          return `❌ Erreur lors de la vérification des permissions.`;
        }
      }
      
      if (!isGroupAdmin) {
        return `❌ Accès refusé. Seuls les administrateurs du groupe WhatsApp peuvent utiliser ces commandes.`;
      }
      
      // Mapping des raccourcis vers les commandes complètes
      const commandMapping = {
        '/a': '/admin',
        '/p': '/presences',
        '/pp': '/presences présent',
        '/pr': '/presences retard', 
        '/pa': '/presences absent',
        '/pperm': '/presences permission',
        '/s': '/stats',
        '/e': '/employés',
        '/r': '/rapport'
      };
      
      // Convertir les raccourcis en commandes complètes
      let processedMessage = messageLower;
      for (const [shortcut, fullCommand] of Object.entries(commandMapping)) {
        if (messageLower.startsWith(shortcut)) {
          processedMessage = fullCommand + messageLower.substring(shortcut.length);
          break;
        }
      }
      
      // Traitement des commandes (complètes et raccourcis convertis)
      if (processedMessage.includes('/admin') || processedMessage.includes('/admin-help') || processedMessage.includes('/help admin')) {
        return this.getAdminHelpMessage();
      }
      
      if (processedMessage.includes('/presences') || processedMessage.includes('/présences') || processedMessage.includes('/liste présences')) {
        return await this.getTodayPresences(processedMessage);
      }
      
      if (processedMessage.includes('/stats') || processedMessage.includes('/statistiques')) {
        return await this.getTodayStats();
      }
      
      if (processedMessage.includes('/employés') || processedMessage.includes('/employes') || processedMessage.includes('/liste employés')) {
        return await this.getEmployeesList();
      }
      
      if (processedMessage.includes('/rapport') || processedMessage.includes('/rapports')) {
        return this.getReportHelp();
      }
      
      // Commande non reconnue
      return `❓ Commande admin non reconnue. Tapez "/admin" ou "/a" pour voir toutes les commandes disponibles.`;
      
    } catch (error) {
      console.error('Erreur lors du traitement de la commande admin:', error);
      return `❌ Erreur lors du traitement de la commande admin.`;
    }
  }

  /**
   * Retourne l'aide pour les commandes d'admin
   */
  getAdminHelpMessage() {
    return `🔧 **Commandes d'Administration**

📋 **Gestion des présences :**
• \`/presences\` ou \`/p\` - Liste des présences du jour
• \`/presences présent\` ou \`/pp\` - Seulement les présents
• \`/presences retard\` ou \`/pr\` - Seulement les retards
• \`/presences absent\` ou \`/pa\` - Seulement les absents
• \`/presences permission\` ou \`/pperm\` - Seulement les permissions
• \`/stats\` ou \`/s\` - Statistiques du jour

👥 **Gestion des employés :**
• \`/employés\` ou \`/e\` - Liste des employés

📊 **Rapports :**
• \`/rapport\` ou \`/r\` - Aide pour les rapports


Tapez une commande pour l'exécuter !`;
  }

  /**
   * Récupère les présences du jour avec filtres optionnels
   */
  async getTodayPresences(message = '') {
    try {
      const today = moment().format('YYYY-MM-DD');
      const messageLower = message.toLowerCase();
      
      // Détecter les filtres dans le message
      let statusFilter = null;
      let departmentFilter = null;
      
      if (messageLower.includes('présent') || messageLower.includes('present')) {
        statusFilter = 'present';
      } else if (messageLower.includes('retard') || messageLower.includes('en retard')) {
        statusFilter = 'late';
      } else if (messageLower.includes('absent')) {
        statusFilter = 'absent';
      } else if (messageLower.includes('permission')) {
        statusFilter = 'permission';
      }
      
      // Construire la requête avec filtres
      let query = `
        SELECT 
          e.name as employee_name,
          e.position,
          e.department,
          a.arrival_time,
          a.departure_time,
          a.status,
          a.notes
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        WHERE DATE(a.date) = ?
      `;
      
      const params = [today];
      
      if (statusFilter) {
        query += ` AND a.status = ?`;
        params.push(statusFilter);
      }
      
      query += ` ORDER BY a.arrival_time ASC`;
      
      const attendance = await db.query(query, params);

      if (attendance.length === 0) {
        const filterText = statusFilter ? ` (Filtre: ${statusFilter})` : '';
        return `📅 **Présences du ${moment().format('DD/MM/YYYY')}**${filterText}

Aucune présence enregistrée aujourd'hui.`;
      }

      const filterText = statusFilter ? ` (Filtre: ${statusFilter})` : '';
      let response = `📅 **Présences du ${moment().format('DD/MM/YYYY')}**${filterText}\n\n`;
      
      attendance.forEach((record, index) => {
        const status = record.status === 'present' ? '✅ Présent' : 
                     record.status === 'late' ? '⚠️ En retard' : 
                     record.status === 'absent' ? '❌ Absent' : 
                     record.status === 'permission' ? '🏠 Permission' : '❓ Inconnu';
        
        response += `${index + 1}. **${record.employee_name}**\n`;
        response += `   📍 ${record.position || 'Poste non défini'}\n`;
        response += `   🏢 ${record.department || 'Département non défini'}\n`;
        response += `   ⏰ Arrivée: ${record.arrival_time || 'Non marqué'}\n`;
        response += `   🚪 Départ: ${record.departure_time || 'Non marqué'}\n`;
        response += `   📊 ${status}\n`;
        if (record.notes) {
          response += `   📝 Note: ${record.notes}\n`;
        }
        response += `\n`;
      });

      return response;
      
    } catch (error) {
      console.error('Erreur lors de la récupération des présences:', error);
      return `❌ Erreur lors de la récupération des présences.`;
    }
  }

  /**
   * Récupère les statistiques du jour
   */
  async getTodayStats() {
    try {
      const today = moment().format('YYYY-MM-DD');
      
      // Statistiques générales
      const stats = await db.query(`
        SELECT 
          COUNT(*) as total_records,
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
          SUM(CASE WHEN status = 'permission' THEN 1 ELSE 0 END) as permission_count
        FROM attendance 
        WHERE DATE(date) = ?
      `, [today]);

      // Nombre total d'employés
      const totalEmployees = await db.query(`SELECT COUNT(*) as count FROM employees`);
      
      const stat = stats[0];
      const totalEmps = totalEmployees[0].count;
      
      const presentRate = totalEmps > 0 ? Math.round((stat.present_count / totalEmps) * 100) : 0;
      const lateRate = totalEmps > 0 ? Math.round((stat.late_count / totalEmps) * 100) : 0;
      
      return `📊 **Statistiques du ${moment().format('DD/MM/YYYY')}**

👥 **Effectifs :**
• Total employés: ${totalEmps}
• Présences enregistrées: ${stat.total_records}

✅ **Présents :** ${stat.present_count} (${presentRate}%)
⚠️ **En retard :** ${stat.late_count} (${lateRate}%)
❌ **Absents :** ${stat.absent_count}
🏠 **Permissions :** ${stat.permission_count}

📈 **Taux de présence :** ${presentRate}%`;
      
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      return `❌ Erreur lors de la récupération des statistiques.`;
    }
  }

  /**
   * Récupère la liste des employés
   */
  async getEmployeesList() {
    try {
      const employees = await db.query(`
        SELECT 
          name,
          position,
          department,
          phone
        FROM employees 
        ORDER BY name ASC
      `);

      if (employees.length === 0) {
        return `👥 **Liste des employés**

Aucun employé enregistré.`;
      }

      let response = `👥 **Liste des employés** (${employees.length})\n\n`;
      
      employees.forEach((employee, index) => {
        response += `${index + 1}. **${employee.name}**\n`;
        response += `   📍 ${employee.position || 'Poste non défini'}\n`;
        response += `   🏢 ${employee.department || 'Département non défini'}\n`;
        if (employee.phone) {
          response += `   📱 ${employee.phone}\n`;
        }
        response += `\n`;
      });

      return response;
      
    } catch (error) {
      console.error('Erreur lors de la récupération des employés:', error);
      return `❌ Erreur lors de la récupération des employés.`;
    }
  }

  /**
   * Retourne l'aide pour les rapports
   */
  getReportHelp() {
    return `📊 **Aide Rapports**

Pour générer des rapports détaillés, utilisez l'interface web :
• Accédez à la section "Rapports"
• Sélectionnez le type (quotidien, hebdomadaire, mensuel)
• Définissez la période
• Générez le rapport

📋 **Commandes rapides :**
• \`/presences\` ou \`/p\` - Présences du jour
• \`/stats\` ou \`/s\` - Statistiques du jour

💡 Pour plus de détails, utilisez l'interface web complète.`;
  }
}

module.exports = new AIAgent();

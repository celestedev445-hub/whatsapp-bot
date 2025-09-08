const { HfInference } = require('@huggingface/inference');
const db = require('../config/database');
const moment = require('moment');
const axios = require('axios');

class AIAgent {
  constructor() {
    this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY || 'hf_demo');
    this.isEnabled = process.env.AI_AGENT_ENABLED !== 'false'; // Activé par défaut
    this.confidenceThreshold = 0.3; // Seuil plus bas pour les tests
    
    // Configuration pour l'IA conversationnelle
    this.conversationalAI = {
      enabled: false, // Désactivé par défaut, utilise l'IA intelligente locale
      provider: 'local', // Utilise notre IA intelligente locale
      model: 'intelligent-local',
      maxLength: 150,
      temperature: 0.7
    };
    
    // Modèles pour différentes tâches
    this.models = {
      classification: 'camembert-base',
      sentiment: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
      ner: 'dbmdz/bert-large-cased-finetuned-conll03-english'
    };
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
      const isDirectMention = messageLower.includes('mr bot') || 
                             messageLower.includes('mister bot') ||
                             messageLower.includes('@bot') ||
                             messageLower.includes('hey bot') ||
                             messageLower.includes('salut bot') ||
                             messageLower.includes('bonjour bot') ||
                             messageLower.includes('bot,') ||
                             messageLower.includes('bot !');
      
      if (isDirectMention && bestMatch.confidence < 0.5) {
        bestMatch = { type: 'mention', confidence: 0.8 };
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
      return bestMatch;

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
    
    if (classification.confidence < effectiveThreshold) {
      return 'none';
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
            await this.saveAttendanceToDatabase(employee, 'arrival', analysis.extractedInfo, context);
            const arrivalTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            response = `✅ Arrivée enregistrée à ${arrivalTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
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
            const departureTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const workHours = departureResult ? departureResult.totalHours.toFixed(2) : '0.00';
            response = `✅ Départ enregistré à ${departureTime}\n📊 Heures travaillées: ${workHours}h\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
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
            await this.saveAttendanceToDatabase(employee, 'lunch_break', analysis.extractedInfo, context);
            const lunchTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            response = `🍽️ Pause déjeuner commencée à ${lunchTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
          }
          break;
        
        case 'lunch_return':
          // Enregistrer le retour de pause en base de données
          await this.saveAttendanceToDatabase(employee, 'lunch_return', analysis.extractedInfo, context);
          const returnTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          response = `✅ Retour de pause à ${returnTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
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
            response = `🤖 Salut ! Je suis votre assistant personnel. Voici ce que je peux faire pour vous :

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
            response = `🤖 Je peux vous aider avec :
• Marquer votre présence (arrivée, départ, pause)
• Demander des permissions
• Consulter votre statut
• Autres questions administratives`;
          }
          break;
        
        case 'greet_back':
          if (isPrivate) {
            response = `👋 Salut ! Je suis votre assistant personnel. Comment puis-je vous aider aujourd'hui ? 😊`;
          } else {
            response = `👋 Bonjour ! Comment puis-je vous aider aujourd'hui ?`;
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
      const messageLower = message.toLowerCase();
      const isPrivate = !context.isGroup;
      const author = context.author || 'Utilisateur';
      
      // Vérifier si c'est une question sur les fonctionnalités du bot
      if (this.isBotFunctionalityQuestion(message)) {
        return this.generateBotFunctionalityResponse(message, context);
      }
      
      // Pour toutes les autres conversations, utiliser l'IA générative
      const aiResponse = await this.generateAIGenerativeResponse(message, context);
      if (aiResponse) {
        return aiResponse;
      }
      
      // Fallback minimal seulement si l'IA échoue complètement
      return `😊 C'est intéressant ! Peux-tu me dire plus sur ce sujet ? 😊`;
      
    } catch (error) {
      console.error('Erreur lors de la génération de réponse libre:', error);
      return `😊 Désolé, je n'ai pas bien compris. Peux-tu reformuler ? 😊`;
    }
  }

  /**
   * Vérifie si c'est une question sur les fonctionnalités du bot
   */
  isBotFunctionalityQuestion(message) {
    const functionalityKeywords = [
      'présence', 'presence', 'arrivée', 'arrive', 'départ', 'depart',
      'permission', 'congé', 'conge', 'pause', 'déjeuner', 'dejeuner',
      'statut', 'aide', 'help', 'que faire', 'comment faire'
    ];
    
    return functionalityKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  /**
   * Génère une réponse pour les questions sur les fonctionnalités du bot
   */
  generateBotFunctionalityResponse(message, context) {
    const isPrivate = !context.isGroup;
    const author = context.author || 'Utilisateur';
    
    if (isPrivate) {
      return `🤖 Salut ${author} ! Je suis ton assistant IA personnel. Je peux t'aider avec :

*📅 Gestion de présence :*
• "Je suis arrivé" ou "Bonjour" → Marquer votre arrivée
• "Je pars" ou "Au revoir" → Marquer votre départ  
• "Je vais en pause" → Commencer la pause déjeuner
• "Je reviens de pause" → Finir la pause
• "Je ne viens pas" → Déclarer une absence

*📋 Demandes de permissions :*
• "Je veux prendre congé du 15/12 au 20/12" → Demander un congé
• "Je suis malade du 10/12 au 12/12" → Demander un arrêt maladie

*💬 Conversations libres :*
• Parle-moi de n'importe quoi, je te réponds !

Que veux-tu faire ? 😊`;
    } else {
      return `🤖 Je peux aider avec les présences, permissions et répondre aux questions ! 😊`;
    }
  }

  /**
   * Génère une réponse vraiment intelligente avec une vraie IA conversationnelle
   */
  async generateAIGenerativeResponse(message, context) {
    try {
      const isPrivate = !context.isGroup;
      const author = context.author || 'Utilisateur';
      
      // Vérifier si c'est une question sur les fonctionnalités du bot
      if (this.isBotFunctionalityQuestion(message)) {
        return this.generateBotFunctionalityResponse(message, context);
      }
      
      // Utiliser une vraie IA conversationnelle
      const aiResponse = await this.generateConversationalAIResponse(message, context);
      if (aiResponse) {
        return aiResponse;
      }
      
      // Fallback intelligent basé sur le contexte
      return this.generateIntelligentFallback(message, context);
      
    } catch (error) {
      console.error('Erreur lors de la génération IA:', error);
      return this.generateIntelligentFallback(message, context);
    }
  }

  /**
   * Génère une réponse avec une vraie IA conversationnelle
   */
  async generateConversationalAIResponse(message, context) {
    try {
      if (!this.conversationalAI.enabled) {
        return null;
      }

      const isPrivate = !context.isGroup;
      const author = context.author || 'Utilisateur';
      
      // Construire le prompt contextuel
      const systemPrompt = this.buildSystemPrompt(context);
      const userMessage = this.buildUserMessage(message, context);
      
      // Appeler l'IA conversationnelle
      const response = await this.callConversationalAI(systemPrompt, userMessage, context);
      
      if (response && response.trim()) {
        return this.formatAIResponse(response, context);
      }
      
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
      return `Tu es un assistant IA personnel et amical pour ${author}. Tu peux discuter de tout sujet de manière naturelle et intelligente. Tu es là pour aider, conseiller et avoir des conversations intéressantes. Réponds en français de manière chaleureuse et professionnelle.`;
    } else {
      return `Tu es un assistant IA pour un groupe d'employés. Tu peux participer aux discussions de groupe de manière utile et pertinente. Tu es intelligent, amical et professionnel. Réponds en français de manière concise et appropriée pour un groupe.`;
    }
  }

  /**
   * Construit le message utilisateur pour l'IA
   */
  buildUserMessage(message, context) {
    const isPrivate = !context.isGroup;
    const author = context.author || 'Utilisateur';
    
    if (isPrivate) {
      return `${author} dit: "${message}"`;
    } else {
      return `Dans le groupe, ${author} dit: "${message}"`;
    }
  }

  /**
   * Appelle l'IA conversationnelle (Hugging Face ou autre)
   */
  async callConversationalAI(systemPrompt, userMessage, context) {
    try {
      if (this.conversationalAI.provider === 'huggingface') {
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
   * Appelle Hugging Face pour la génération de texte
   */
  async callHuggingFaceAI(systemPrompt, userMessage, context) {
    try {
      const prompt = `${systemPrompt}\n\n${userMessage}\n\nAssistant:`;
      
      const response = await this.hf.textGeneration({
        model: this.conversationalAI.model,
        inputs: prompt,
        parameters: {
          max_new_tokens: this.conversationalAI.maxLength,
          temperature: this.conversationalAI.temperature,
          return_full_text: false,
          do_sample: true
        }
      });

      if (response && response[0] && response[0].generated_text) {
        return response[0].generated_text.trim();
      }
      
      return null;
    } catch (error) {
      console.error('Erreur Hugging Face:', error);
      return null;
    }
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
      .trim();
    
    // Ajouter un emoji si la réponse n'en a pas
    if (!cleanResponse.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u)) {
      cleanResponse = `🤖 ${cleanResponse}`;
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
    
    // Analyser le sentiment et le sujet
    const sentiment = this.analyzeSentiment(message);
    const topic = this.identifyTopic(message);
    
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
    
    // Réponses basées sur le sentiment
    if (sentiment === 'positive') {
      return `😊 C'est formidable ! Je suis ravi que vous ayez une expérience positive. Pouvez-vous me dire plus sur ce qui vous rend si content ?`;
    }
    
    if (sentiment === 'negative') {
      return `😔 Je comprends que la situation soit difficile. Je suis là pour vous écouter et vous aider. Que puis-je faire pour vous soutenir ?`;
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
    
    // Analyser le contenu spécifique du message pour générer une réponse pertinente
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
    
    // Pour les questions directes à l'IA
    if (messageLower.includes('que penses-tu') || messageLower.includes('ton avis') || messageLower.includes('que dis-tu')) {
      return this.generateResponseToDirectQuestion(message, context);
    }
    
    // Réponse générique intelligente basée sur le sentiment
    if (sentiment === 'positive') {
      return `😊 C'est formidable ! Je suis ravi que vous ayez une expérience positive. Pouvez-vous me dire plus sur ce qui vous rend si content ?`;
    }
    
    if (sentiment === 'negative') {
      return `😔 Je comprends que la situation soit difficile. Je suis là pour vous écouter et vous aider. Que puis-je faire pour vous soutenir ?`;
    }
    
    // Réponse générique pour encourager la conversation
    return `🤔 C'est un sujet intéressant ! Pouvez-vous me donner plus de détails pour que je puisse mieux comprendre et vous aider ?`;
  }

  /**
   * Génère une réponse sur les retards
   */
  generateResponseAboutLateness(message, context) {
    const responses = [
      `⏰ Concernant les retards, je pense qu'il est important de comprendre les raisons. Une approche bienveillante avec des explications claires des conséquences fonctionne souvent mieux que des sanctions immédiates.`,
      `🤝 Pour gérer les retards, je recommande d'abord d'écouter les raisons, puis d'établir des règles claires et équitables pour toute l'équipe.`,
      `💡 Les retards peuvent avoir plusieurs causes. Il serait bien de discuter avec la personne concernée pour comprendre et trouver une solution ensemble.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Génère une réponse sur le respect
   */
  generateResponseAboutRespect(message, context) {
    const responses = [
      `🤝 Si quelqu'un vous parle mal, je recommande de rester calme et professionnel. Exprimez clairement que ce comportement n'est pas acceptable et proposez de discuter de manière respectueuse.`,
      `💪 Face à un manque de respect, il est important de fixer des limites claires tout en gardant votre dignité. Documentez les incidents si nécessaire.`,
      `🗣️ La communication respectueuse est essentielle. Si quelqu'un vous parle mal, dites-lui poliment mais fermement que vous préférez une communication professionnelle.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Génère une réponse sur l'équipe
   */
  generateResponseAboutTeam(message, context) {
    const responses = [
      `👥 Une équipe performante se construit sur la confiance, la communication ouverte et le respect mutuel. Chaque membre apporte une valeur unique.`,
      `🤝 Pour une bonne dynamique d'équipe, je recommande de favoriser la collaboration, l'écoute active et la reconnaissance des efforts de chacun.`,
      `💪 Une équipe solide partage des objectifs communs, communique efficacement et se soutient mutuellement dans les défis.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Génère une réponse sur la communication
   */
  generateResponseAboutCommunication(message, context) {
    const responses = [
      `💬 Une bonne communication implique l'écoute active, la clarté dans les messages et l'ouverture aux différents points de vue.`,
      `🗣️ Pour améliorer la communication, je suggère d'être précis dans vos demandes, d'écouter sans juger et de poser des questions pour clarifier.`,
      `🤝 La communication efficace nécessite de l'empathie, de la patience et la volonté de comprendre l'autre avant d'être compris.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Génère une réponse sur les décisions
   */
  generateResponseAboutDecision(message, context) {
    const responses = [
      `🎯 Pour prendre une bonne décision, je recommande de rassembler toutes les informations pertinentes, d'évaluer les options et de considérer les conséquences à long terme.`,
      `🤔 Une décision réfléchie implique d'analyser les avantages et inconvénients, de consulter les personnes concernées et de prendre le temps nécessaire.`,
      `💡 Les meilleures décisions sont souvent prises en équipe, en combinant différentes perspectives et en pesant les risques et opportunités.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Génère une réponse sur les problèmes
   */
  generateResponseAboutProblem(message, context) {
    const responses = [
      `🔧 Pour résoudre un problème, je suggère de l'analyser étape par étape, d'identifier les causes racines et de proposer plusieurs solutions possibles.`,
      `💡 Les problèmes sont souvent des opportunités déguisées. Approchez-les avec curiosité et créativité pour trouver des solutions innovantes.`,
      `🤝 N'hésitez pas à demander de l'aide. Parfois, une perspective extérieure peut apporter des solutions auxquelles vous n'aviez pas pensé.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Génère une réponse sur la politesse
   */
  generateResponseAboutPoliteness(message, context) {
    const responses = [
      `😊 La politesse en entreprise inclut l'utilisation de "s'il vous plaît", "merci", "bonjour", et le respect des horaires et des espaces de travail.`,
      `🤝 Être poli, c'est aussi écouter activement, respecter les opinions des autres et maintenir un ton professionnel même en désaccord.`,
      `✨ La politesse crée un environnement de travail agréable et favorise la collaboration. Un simple sourire et des mots courtois font toute la différence.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Génère une réponse sur le travail
   */
  generateResponseAboutWork(message, context) {
    const responses = [
      `💼 Le travail est plus qu'une activité, c'est un lieu d'épanouissement et de contribution. L'équilibre entre performance et bien-être est essentiel.`,
      `👥 Un bon environnement de travail favorise la créativité, la collaboration et la satisfaction personnelle.`,
      `🎯 Le travail devient plus motivant quand il a du sens, qu'il permet d'apprendre et qu'il est reconnu à sa juste valeur.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Génère une réponse sur la météo
   */
  generateResponseAboutWeather(message, context) {
    const responses = [
      `🌤️ La météo influence souvent notre humeur et notre énergie. C'est fascinant comment la nature peut impacter notre quotidien !`,
      `☀️ Le temps qu'il fait peut affecter notre productivité et notre bien-être. C'est important de s'adapter et de rester positif.`,
      `🌧️ Même par mauvais temps, on peut trouver des aspects positifs et des opportunités de créativité ou de réflexion.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Génère une réponse sur la santé
   */
  generateResponseAboutHealth(message, context) {
    const responses = [
      `🏥 La santé est notre bien le plus précieux. Il est important d'écouter son corps et de prendre soin de soi.`,
      `💪 Prendre soin de sa santé physique et mentale améliore non seulement votre bien-être personnel mais aussi votre performance au travail.`,
      `🤗 Si vous ne vous sentez pas bien, n'hésitez pas à consulter un professionnel de santé. Votre bien-être est prioritaire.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Génère une réponse sur la technologie
   */
  generateResponseAboutTechnology(message, context) {
    const responses = [
      `🤖 La technologie évolue rapidement et transforme notre façon de travailler. C'est passionnant de voir les innovations qui nous aident au quotidien !`,
      `💻 Les nouvelles technologies offrent des opportunités incroyables, mais il est important de les utiliser de manière équilibrée et éthique.`,
      `⚡ La technologie peut être un formidable outil d'amélioration de la productivité et de la collaboration en entreprise.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Génère une réponse sur la nourriture
   */
  generateResponseAboutFood(message, context) {
    const responses = [
      `🍽️ La nourriture est un plaisir de la vie et un moment de partage. C'est merveilleux de découvrir de nouvelles saveurs et cultures !`,
      `😋 Manger ensemble renforce les liens sociaux et peut créer de beaux moments de convivialité en équipe.`,
      `🍴 La cuisine est un art qui rassemble les gens. C'est un excellent sujet de conversation et de découverte mutuelle !`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Génère une réponse aux questions directes
   */
  generateResponseToDirectQuestion(message, context) {
    const responses = [
      `🤔 C'est une excellente question ! Laissez-moi réfléchir à cela...`,
      `💭 C'est intéressant ! Voici ce que je pense à ce sujet...`,
      `🤖 Excellente question ! Permettez-moi de vous donner mon point de vue...`,
      `😊 C'est une question pertinente ! Voici mon analyse...`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Vérifie si c'est une question directe à l'IA
   */
  isDirectQuestionToAI(message) {
    const directQuestions = [
      'que penses-tu', 'qu\'en penses-tu', 'ton avis', 'que dis-tu',
      'que pense l\'ia', 'l\'ia peut', 'peux-tu', 'peux tu',
      'est-ce que tu peux', 'est ce que tu peux', 'peut-on', 'peut on',
      'comment faire', 'que faire', 'aide-moi', 'aide moi',
      'peux-tu m\'aider', 'peux tu m aider', 'comment', 'pourquoi',
      'quand', 'où', 'qui', 'quoi'
    ];
    
    const messageLower = message.toLowerCase();
    return directQuestions.some(question => messageLower.includes(question));
  }

  /**
   * Génère une réponse directe de l'IA
   */
  generateDirectAIResponse(message, context, sentiment, topic) {
    const isPrivate = !context.isGroup;
    const author = context.author || 'Utilisateur';
    const messageLower = message.toLowerCase();
    
    // Réponses pour les questions sur le travail et l'entreprise
    if (messageLower.includes('travail') || messageLower.includes('entreprise') || messageLower.includes('bureau')) {
      const workResponses = [
        `💼 ${isPrivate ? 'Voici mon avis' : 'Voici ce que je pense'} sur le travail : L'équipe et la communication sont essentielles !`,
        `👥 ${isPrivate ? 'Pour le travail' : 'Au travail'}, je recommande la collaboration et l'entraide entre collègues.`,
        `💪 ${isPrivate ? 'Mon conseil' : 'Mon avis'} : Un bon environnement de travail favorise la productivité !`,
        `😊 ${isPrivate ? 'Je pense que' : 'Selon moi'}, le respect mutuel et la communication sont la clé du succès !`
      ];
      return workResponses[Math.floor(Math.random() * workResponses.length)];
    }
    
    // Réponses pour les questions sur la politesse et la communication
    if (messageLower.includes('poliment') || messageLower.includes('politesse') || messageLower.includes('respect')) {
      const politenessResponses = [
        `😊 ${isPrivate ? 'Voici mes conseils' : 'Voici mes recommandations'} pour être poli en entreprise :`,
        `🤝 ${isPrivate ? 'Pour être respectueux' : 'Pour le respect'}, utilisez "s'il vous plaît", "merci", et "bonjour" !`,
        `💬 ${isPrivate ? 'Mon avis' : 'Je recommande'} : Écoutez activement et soyez patient avec vos collègues.`,
        `✨ ${isPrivate ? 'Conseil' : 'Astuce'} : Un sourire et une attitude positive font toute la différence !`
      ];
      return politenessResponses[Math.floor(Math.random() * politenessResponses.length)];
    }
    
    // Réponses pour les questions sur les employés
    if (messageLower.includes('employé') || messageLower.includes('collègue') || messageLower.includes('équipe')) {
      const employeeResponses = [
        `👥 ${isPrivate ? 'Concernant les employés' : 'Pour l\'équipe'}, je pense que chaque personne a ses forces !`,
        `🤝 ${isPrivate ? 'Mon avis' : 'Je crois'} que la diversité des talents enrichit l'équipe.`,
        `💪 ${isPrivate ? 'Concernant l\'équipe' : 'Pour les collègues'}, la collaboration est la clé du succès !`,
        `😊 ${isPrivate ? 'Je pense que' : 'Selon moi'}, chaque membre apporte une valeur unique !`
      ];
      return employeeResponses[Math.floor(Math.random() * employeeResponses.length)];
    }
    
    // Réponses pour les questions sur les actions du groupe
    if (messageLower.includes('action') || messageLower.includes('faire') || messageLower.includes('décision')) {
      const actionResponses = [
        `🎯 ${isPrivate ? 'Pour les actions' : 'Concernant les décisions'}, je recommande la réflexion collective !`,
        `💡 ${isPrivate ? 'Mon conseil' : 'Mon avis'} : Analyser les options avant de décider est important.`,
        `🤔 ${isPrivate ? 'Je pense que' : 'Selon moi'}, il faut peser le pour et le contre ensemble.`,
        `✨ ${isPrivate ? 'Conseil' : 'Recommandation'} : La communication transparente évite les malentendus !`
      ];
      return actionResponses[Math.floor(Math.random() * actionResponses.length)];
    }
    
    // Réponses génériques pour les questions directes
    const genericDirectResponses = [
      `🤖 ${isPrivate ? 'Excellente question' : 'Bonne question'} ! Laissez-moi réfléchir...`,
      `💭 ${isPrivate ? 'C\'est intéressant' : 'C\'est une bonne question'} ! Voici ce que je pense :`,
      `😊 ${isPrivate ? 'Je vais vous donner' : 'Je vais donner'} mon avis sur ce sujet :`,
      `✨ ${isPrivate ? 'Mon point de vue' : 'Mon opinion'} sur cette question :`
    ];
    
    return genericDirectResponses[Math.floor(Math.random() * genericDirectResponses.length)];
  }

  /**
   * Analyse le sentiment du message
   */
  analyzeSentiment(message) {
    const positiveWords = ['bien', 'super', 'génial', 'excellent', 'parfait', 'content', 'heureux', 'joie'];
    const negativeWords = ['difficile', 'dur', 'problème', 'souci', 'fatigué', 'stressé', 'triste', 'mal'];
    const neutralWords = ['ok', 'normal', 'correct', 'moyen', 'comme ci comme ça'];
    
    const messageLower = message.toLowerCase();
    
    const positiveCount = positiveWords.filter(word => messageLower.includes(word)).length;
    const negativeCount = negativeWords.filter(word => messageLower.includes(word)).length;
    const neutralCount = neutralWords.filter(word => messageLower.includes(word)).length;
    
    if (positiveCount > negativeCount && positiveCount > neutralCount) return 'positive';
    if (negativeCount > positiveCount && negativeCount > neutralCount) return 'negative';
    return 'neutral';
  }

  /**
   * Identifie le sujet principal du message
   */
  identifyTopic(message) {
    const topics = {
      work: ['travail', 'bureau', 'projet', 'réunion', 'collègue', 'patron', 'équipe'],
      personal: ['famille', 'ami', 'weekend', 'vacances', 'loisir', 'hobby', 'sport'],
      weather: ['météo', 'temps', 'pluie', 'soleil', 'chaud', 'froid', 'nuage'],
      technology: ['ordinateur', 'téléphone', 'internet', 'app', 'logiciel', 'technologie'],
      health: ['santé', 'malade', 'médecin', 'hôpital', 'médicament', 'fatigue'],
      food: ['manger', 'repas', 'restaurant', 'cuisine', 'nourriture', 'boire']
    };
    
    const messageLower = message.toLowerCase();
    
    for (const [topic, keywords] of Object.entries(topics)) {
      if (keywords.some(keyword => messageLower.includes(keyword))) {
        return topic;
      }
    }
    
    return 'general';
  }

  /**
   * Génère une réponse contextuelle intelligente
   */
  generateContextualResponse(message, context, sentiment, topic) {
    const isPrivate = !context.isGroup;
    const author = context.author || 'Utilisateur';
    const messageLower = message.toLowerCase();
    
    // Réponses basées sur le sentiment
    if (sentiment === 'positive') {
      const positiveResponses = [
        `😊 C'est génial ! Je suis content que ça aille bien pour toi !`,
        `😄 Super ! Ça me fait plaisir d'entendre ça !`,
        `😊 Excellent ! Continue comme ça !`,
        `😄 Parfait ! Tu as l'air en pleine forme !`
      ];
      return positiveResponses[Math.floor(Math.random() * positiveResponses.length)];
    }
    
    if (sentiment === 'negative') {
      const supportiveResponses = [
        `😔 Je comprends que ce soit difficile. Veux-tu en parler ?`,
        `🤗 Je suis là pour t'écouter si tu veux partager ce qui ne va pas.`,
        `😊 Courage ! Les moments difficiles passent toujours.`,
        `💪 Tu es plus fort que tu ne le penses ! N'hésite pas si tu as besoin de parler.`
      ];
      return supportiveResponses[Math.floor(Math.random() * supportiveResponses.length)];
    }
    
    // Réponses basées sur le sujet
    switch (topic) {
      case 'work':
        const workResponses = [
          `💼 Le travail, c'est important ! Comment ça se passe ?`,
          `👥 L'équipe, c'est la clé du succès ! Raconte-moi !`,
          `💪 Le travail d'équipe, c'est génial ! Comment ça avance ?`,
          `😊 Le boulot, c'est du sérieux ! Dis-moi tout !`
        ];
        return workResponses[Math.floor(Math.random() * workResponses.length)];
        
      case 'personal':
        const personalResponses = [
          `😊 C'est chouette ! Raconte-moi en plus !`,
          `😄 J'adore entendre parler de la vie personnelle ! Continue !`,
          `😊 C'est important de prendre du temps pour soi !`,
          `😄 La vie privée, c'est précieux ! Dis-moi tout !`
        ];
        return personalResponses[Math.floor(Math.random() * personalResponses.length)];
        
      case 'weather':
        const weatherResponses = [
          `🌤️ La météo, c'est capricieux ! Qu'est-ce que tu en penses ?`,
          `☀️ Le temps, ça influence l'humeur ! Comment tu le vis ?`,
          `🌧️ Même par mauvais temps, on peut avoir de bonnes journées !`,
          `🌤️ Le temps, c'est relatif ! L'important c'est l'ambiance !`
        ];
        return weatherResponses[Math.floor(Math.random() * weatherResponses.length)];
        
      case 'technology':
        const techResponses = [
          `🤖 La technologie, c'est fascinant ! Qu'est-ce qui t'intéresse ?`,
          `💻 Les nouvelles tech, c'est passionnant ! Raconte-moi !`,
          `📱 L'innovation, c'est génial ! Comment tu vois ça ?`,
          `🔧 La tech, c'est l'avenir ! Dis-moi tout !`
        ];
        return techResponses[Math.floor(Math.random() * techResponses.length)];
        
      case 'health':
        const healthResponses = [
          `🏥 La santé, c'est le plus important ! Comment tu te sens ?`,
          `💊 Prends soin de toi ! C'est primordial !`,
          `😊 La santé, c'est précieux ! Écoute ton corps !`,
          `🤗 Je suis là si tu as besoin de parler de ça !`
        ];
        return healthResponses[Math.floor(Math.random() * healthResponses.length)];
        
      case 'food':
        const foodResponses = [
          `🍽️ La nourriture, c'est la vie ! Qu'est-ce que tu aimes ?`,
          `😋 Manger, c'est un plaisir ! Raconte-moi !`,
          `🍴 La cuisine, c'est un art ! Comment tu vois ça ?`,
          `😊 La gastronomie, c'est culturel ! Dis-moi tout !`
        ];
        return foodResponses[Math.floor(Math.random() * foodResponses.length)];
        
      default:
        // Réponses génériques intelligentes
        const genericResponses = [
          `😊 C'est intéressant ! Dis-moi en plus !`,
          `😄 Ah oui ? Raconte-moi !`,
          `😊 Je vois ! Et alors ?`,
          `😄 Intéressant ! Qu'est-ce que tu en penses ?`,
          `😊 C'est cool ! Continue !`,
          `😄 J'aime bien discuter avec toi !`,
          `😊 Tu as l'air de bien connaître ça !`,
          `😄 C'est passionnant ! Dis-moi plus !`
        ];
        return genericResponses[Math.floor(Math.random() * genericResponses.length)];
    }
  }


  /**
   * Traite un message avec l'IA et exécute l'action appropriée
   */
  async processMessage(message, contact, chat) {
    try {
      const context = {
        author: contact.name || contact.number,
        chatId: chat?.id?._serialized || contact?.id?._serialized || 'unknown',
        isGroup: chat?.isGroup || false,
        timestamp: new Date()
      };

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
      
      // Déterminer le statut selon l'action
      switch (action) {
        case 'arrival':
          status = 'present';
          notes = 'Arrivée enregistrée';
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
        } else {
          await db.query(
            'INSERT INTO attendance (employee_id, date, status, notes) VALUES (?, ?, ?, ?)',
            [employee.id, today, status, notes]
          );
        }
      }
      
      console.log(`✅ Présence enregistrée en base: ${action} pour ${employee.name}`);
      
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
          phone_number,
          email
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
        if (employee.phone_number) {
          response += `   📱 ${employee.phone_number}\n`;
        }
        if (employee.email) {
          response += `   📧 ${employee.email}\n`;
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

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const db = require('../config/database');
const moment = require('moment');
const aiAgent = require('./aiAgent');
const smartResponse = require('./smartResponse');

class WhatsAppBot {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.groupId = process.env.WHATSAPP_GROUP_ID;
  }

  async initialize() {
    try {

      // Configuration du client WhatsApp
      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: "whatsapp-bot-entreprise"
        }),
        puppeteer: {
          headless: true, // Mode headless - pas d'interface graphique
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--mute-audio',
            '--no-default-browser-check',
            '--no-pings',
            '--user-data-dir=./chrome-profile',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=VizDisplayCompositor',
            '--window-size=1920,1080'
          ],
          timeout: 60000,
          protocolTimeout: 60000
        }
      });

      // Stocker le QR code pour l'API
      this.client.qr = null;

      // Événements du client
      this.setupEvents();

      // Démarrage du client
      await this.client.initialize();
      
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du bot WhatsApp:', error);
      throw error;
    }
  }

  setupEvents() {
    // QR Code pour la première connexion
    this.client.on('qr', (qr) => {
      console.log('📱 QR Code généré - Disponible dans l\'interface web');
      
      // Stocker le QR code pour l'API
      this.client.qr = qr;
    });

    // Client prêt
    this.client.on('ready', async () => {
      console.log('✅ Bot WhatsApp prêt!');
      console.log(`📱 Numéro du bot: ${this.client.info.wid.user}`);
      console.log(`🏷️ ID du groupe configuré: ${this.groupId}`);
      this.isReady = true;
      
      // Effacer le QR code une fois connecté
      this.client.qr = null;
      
      // Attendre un peu pour que WhatsApp soit complètement prêt
      console.log('⏳ Attente de 3 secondes pour que WhatsApp soit complètement prêt...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Afficher tous les groupes disponibles
      await this.listAvailableGroups();
      
      // Synchronisation forcée immédiate AVANT la vérification du groupe
      console.log('🚀 Démarrage de la synchronisation automatique...');
      await this.forceSyncAllGroups();
      
      // Nettoyer les messages qui ne proviennent pas du groupe configuré
      await this.cleanupNonGroupMessages();
      
      // Vérifier si le bot est dans le groupe configuré
      await this.verifyGroupMembership();
      
      // Envoyer un message de test
      await this.sendTestMessage();
    });

    // Messages reçus
    this.client.on('message', async (message) => {
      console.log('🔔 Événement message déclenché!');
      try {
        await this.handleMessage(message);
      } catch (error) {
        console.error('Erreur lors du traitement du message:', error);
      }
    });

    // Erreurs
    this.client.on('auth_failure', (msg) => {
      console.error('❌ Échec de l\'authentification WhatsApp:', msg);
    });

    this.client.on('disconnected', (reason) => {
      console.log('📱 WhatsApp déconnecté:', reason);
      this.isReady = false;
    });
  }

  // Fonction pour lister tous les groupes disponibles
  async listAvailableGroups() {
    try {
      const chats = await this.client.getChats();
      const groups = chats.filter(chat => chat.isGroup);
      
      console.log('\n📋 GROUPES WHATSAPP DISPONIBLES :');
      console.log('=====================================');
      
      if (groups.length === 0) {
        console.log('❌ Aucun groupe trouvé');
        console.log('💡 Ajoutez le bot à un groupe pour le voir ici');
      } else {
        groups.forEach((group, index) => {
          console.log(`${index + 1}. ${group.name}`);
          console.log(`   ID: ${group.id._serialized}`);
          console.log(`   Participants: ${group.participants.length}`);
          console.log('');
        });
        
        console.log('💡 Pour configurer un groupe, copiez son ID dans le fichier .env');
        console.log('   Exemple: WHATSAPP_GROUP_ID=120363123456789012@g.us');
      }
      console.log('=====================================\n');
    } catch (error) {
      console.error('Erreur lors de la récupération des groupes:', error);
    }
  }

  // Fonction pour vérifier si le bot est dans le groupe configuré
  async verifyGroupMembership() {
    try {
      if (!this.groupId) {
        console.log('⚠️ Aucun groupe configuré dans WHATSAPP_GROUP_ID');
        return;
      }

      const chat = await this.client.getChatById(this.groupId);
      if (chat) {
        console.log(`✅ Groupe trouvé: ${chat.name}`);
        console.log(`👥 Participants: ${chat.participants.length}`);
        
        // Vérifier si le bot est dans le groupe
        const botNumber = this.client.info.wid.user;
        const isBotInGroup = chat.participants.some(p => p.id.user === botNumber);
        
        if (isBotInGroup) {
          console.log('✅ Bot est membre du groupe');
          // Synchroniser les membres du groupe avec la base de données
          await this.syncGroupMembers(chat);
        } else {
          console.log('❌ Bot N\'EST PAS membre du groupe');
          console.log('💡 Ajoutez le bot au groupe pour qu\'il puisse recevoir les messages');
        }
      } else {
        console.log('❌ Groupe non trouvé avec l\'ID:', this.groupId);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du groupe:', error);
    }
  }

  // Fonction pour synchroniser les membres du groupe avec la base de données
  async syncGroupMembers(chat) {
    try {
      console.log('🔄 Synchronisation des membres du groupe...');
      
      // Vérifier que c'est bien un groupe
      if (!chat.isGroup) {
        console.log('⚠️ Ce n\'est pas un groupe, synchronisation ignorée');
        return;
      }
      
      // Obtenir les participants du groupe de manière correcte
      let participants = [];
      try {
        // Méthode 1: Essayer d'obtenir les participants directement
        if (chat.participants && Array.isArray(chat.participants)) {
          participants = chat.participants;
        } else {
          // Méthode 2: Utiliser getChatById pour obtenir les infos complètes
          const fullChat = await this.client.getChatById(chat.id._serialized);
          if (fullChat.participants && Array.isArray(fullChat.participants)) {
            participants = fullChat.participants;
          }
        }
      } catch (error) {
        console.error('❌ Erreur lors de la récupération des participants:', error.message);
        return;
      }
      
      console.log(`👥 ${participants.length} participants trouvés dans le groupe "${chat.name}"`);
      
      if (participants.length === 0) {
        console.log('⚠️ Aucun participant trouvé dans ce groupe');
        return;
      }
      
      let addedCount = 0;
      let updatedCount = 0;
      
      for (const participant of participants) {
        const whatsappId = participant.id._serialized;
        const phone = participant.id.user;
        
        // Vérifier si le membre existe déjà dans la base de données
        const existingMember = await db.query(
          'SELECT * FROM employees WHERE whatsapp_id = ? OR phone = ?',
          [whatsappId, phone]
        );
        
        if (existingMember.length === 0) {
          // Ajouter le nouveau membre
          try {
            // Essayer de récupérer le nom du contact
            let name = phone; // Nom par défaut
            try {
              const contact = await this.client.getContactById(whatsappId);
              if (contact && contact.name) {
                name = contact.name;
              } else if (contact && contact.pushname) {
                name = contact.pushname;
              }
            } catch (contactError) {
              console.log(`⚠️ Impossible de récupérer le nom pour ${phone}, utilisation du numéro`);
            }
            
            await db.query(
              'INSERT INTO employees (whatsapp_id, name, phone, group_id, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NOW(), NOW())',
              [whatsappId, name, phone, chat.id._serialized]
            );
            
            console.log(`✅ Nouveau membre ajouté: ${name} (${phone})`);
            addedCount++;
          } catch (insertError) {
            console.error(`❌ Erreur lors de l'ajout de ${phone}:`, insertError.message);
          }
        } else {
          // Mettre à jour les informations existantes si nécessaire
          const member = existingMember[0];
          let needsUpdate = false;
          let updates = [];
          
          // Vérifier si le nom a changé
          try {
            const contact = await this.client.getContactById(whatsappId);
            if (contact && contact.name && contact.name !== member.name) {
              updates.push(`name = '${contact.name.replace(/'/g, "''")}'`);
              needsUpdate = true;
            }
          } catch (contactError) {
            // Ignorer les erreurs de contact
          }
          
          // Vérifier si l'ID WhatsApp a changé
          if (member.whatsapp_id !== whatsappId) {
            updates.push(`whatsapp_id = '${whatsappId}'`);
            needsUpdate = true;
          }
          
          // Vérifier si le group_id a changé
          if (member.group_id !== chat.id._serialized) {
            updates.push(`group_id = '${chat.id._serialized}'`);
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            updates.push('updated_at = NOW()');
            await db.query(
              `UPDATE employees SET ${updates.join(', ')} WHERE id = ?`,
              [member.id]
            );
            console.log(`🔄 Membre mis à jour: ${member.name} (${phone})`);
            updatedCount++;
          } else {
            // Réactiver le membre s'il était désactivé et mettre à jour le group_id
            if (!member.is_active || member.group_id !== chat.id._serialized) {
              await db.query(
                'UPDATE employees SET is_active = 1, group_id = ?, updated_at = NOW() WHERE id = ?',
                [chat.id._serialized, member.id]
              );
              console.log(`✅ Membre réactivé: ${member.name} (${phone})`);
              updatedCount++;
            }
          }
        }
      }
      
      console.log(`📊 Synchronisation terminée:`);
      console.log(`   - ${addedCount} nouveaux membres ajoutés`);
      console.log(`   - ${updatedCount} membres mis à jour`);
      console.log(`   - ${participants.length} membres au total dans le groupe`);
      
      // Nettoyer la base de données - supprimer les membres qui ne sont plus dans le groupe
      await this.cleanupNonGroupMembers(participants);
      
    } catch (error) {
      console.error('Erreur lors de la synchronisation des membres:', error);
    }
  }

  // Fonction pour nettoyer les membres qui ne sont plus dans le groupe
  async cleanupNonGroupMembers(currentParticipants) {
    try {
      console.log('🧹 Nettoyage des membres non présents dans le groupe...');
      
      // Obtenir tous les membres actuels de la base de données
      const allMembers = await db.query('SELECT * FROM employees WHERE is_active = 1');
      
      // Créer un Set des IDs WhatsApp des participants actuels
      const currentParticipantIds = new Set(
        currentParticipants.map(p => p.id._serialized)
      );
      
      let removedCount = 0;
      
      // Vérifier chaque membre de la base de données
      for (const member of allMembers) {
        if (!currentParticipantIds.has(member.whatsapp_id)) {
          // Le membre n'est plus dans le groupe, le désactiver
          await db.query(
            'UPDATE employees SET is_active = 0, updated_at = NOW() WHERE id = ?',
            [member.id]
          );
          console.log(`🗑️ Membre désactivé: ${member.name} (${member.phone})`);
          removedCount++;
        }
      }
      
      if (removedCount > 0) {
        console.log(`🧹 Nettoyage terminé: ${removedCount} membres désactivés`);
      } else {
        console.log('✅ Aucun nettoyage nécessaire');
      }
      
    } catch (error) {
      console.error('Erreur lors du nettoyage des membres:', error);
    }
  }

  // Fonction pour synchroniser tous les groupes où le bot est présent
  async forceSyncAllGroups() {
    try {
      console.log('🔄 Synchronisation forcée des groupes...');
      
      // Attendre un peu pour s'assurer que WhatsApp est prêt
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Si un groupe spécifique est configuré, synchroniser seulement celui-ci
      if (this.groupId) {
        console.log(`🎯 Synchronisation du groupe configuré: ${this.groupId}`);
        try {
          const chat = await this.client.getChatById(this.groupId);
          if (chat && chat.isGroup) {
            await this.syncGroupMembers(chat);
            console.log('✅ Synchronisation du groupe configuré terminée');
          } else {
            console.log('⚠️ Le groupe configuré n\'a pas été trouvé ou n\'est pas un groupe');
          }
        } catch (error) {
          console.error('❌ Erreur lors de la synchronisation du groupe configuré:', error.message);
        }
        return;
      }
      
      // Sinon, synchroniser tous les groupes (mais avec prudence)
      const chats = await this.client.getChats();
      const groups = chats.filter(chat => chat.isGroup);
      
      console.log(`📊 ${groups.length} groupes trouvés`);
      
      if (groups.length === 0) {
        console.log('⚠️ Aucun groupe trouvé pour la synchronisation');
        return;
      }

      let totalSynced = 0;
      
      for (const group of groups) {
        try {
          console.log(`🔄 Synchronisation du groupe: ${group.name} (${group.id._serialized})`);
          await this.syncGroupMembers(group);
          totalSynced++;
        } catch (error) {
          console.error(`❌ Erreur lors de la synchronisation du groupe ${group.name}:`, error.message);
        }
      }
      
      console.log(`✅ Synchronisation terminée: ${totalSynced} groupes synchronisés`);
      
    } catch (error) {
      console.error('Erreur lors de la synchronisation forcée des groupes:', error);
    }
  }

  // Fonction pour envoyer un message de test
  async sendTestMessage() {
    try {
      if (!this.groupId) {
        console.log('⚠️ Aucun groupe configuré pour le test');
        return;
      }

      console.log('🧪 Envoi d\'un message de test...');
      
      // Utiliser la nouvelle méthode d'envoi de message
      await this.client.sendMessage(this.groupId, '🤖 Bienvenue dans le Bot WhatsApp Entreprise !\n\n💡 Utilisez "/" pour voir toutes mes fonctionnalités\n📅 Gestion de présence • 📋 Permissions • 🤖 IA conversationnelle\n\n✅ Bot prêt à vous assister !');
      console.log('✅ Message de test envoyé');
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi du message de test:', error);
    }
  }

  async handleMessage(message) {
    const contact = await message.getContact();
    const chat = await message.getChat();
    const messageBody = message.body.toLowerCase().trim();

    // Logs de debug
    console.log(`📨 Message reçu de: ${contact.name || contact.number}`);
    console.log(`💬 Contenu: "${message.body}"`);
    console.log(`🏷️ Chat ID: ${chat.id._serialized}`);
    console.log(`👥 Est un groupe: ${chat.isGroup}`);
    console.log(`🎯 Groupe configuré: ${this.groupId}`);
    console.log(`✅ Correspond au groupe: ${chat.id._serialized === this.groupId}`);
    console.log('---');

    // 🚫 IGNORER LES MESSAGES DE SPAM/PUBLICITÉ
    if (this.isSpamMessage(contact, message.body)) {
      console.log('🚫 Message de spam ignoré');
      return;
    }

    // Vérifier si c'est un message de groupe
    if (chat.isGroup && chat.id._serialized === this.groupId) {
      console.log('🔄 Traitement du message de groupe...');
      // Sauvegarder le message seulement s'il provient du bon groupe
      await this.saveMessage(message);
      // Obtenir le contact de l'utilisateur qui a envoyé le message
      const userContact = await this.client.getContactById(message.author);
      
      // 🤖 NOUVELLE FONCTIONNALITÉ : Analyse IA
      await this.handleMessageWithAI(message, userContact, messageBody);
      
    } else if (chat.isGroup) {
      console.log('⚠️ Message de groupe ignoré (mauvais ID)');
    } else {
      console.log('🔒 Traitement du message privé...');
      // 🤖 NOUVELLE FONCTIONNALITÉ : Messages privés avec IA
      await this.handlePrivateMessageWithAI(message, contact, messageBody);
    }
  }

  /**
   * 🚫 DÉTECTION DES MESSAGES DE SPAM/PUBLICITÉ
   */
  isSpamMessage(contact, messageBody) {
    try {
      const messageLower = messageBody.toLowerCase();
      const contactName = (contact.name || '').toLowerCase();
      const chatId = contact.id._serialized;
      
      // 🚫 CRITÈRES DE SPAM STRICTS
      
      // 1. Vérifier les IDs de chat suspects (newsletter, broadcast, etc.)
      if (chatId.includes('@newsletter') || 
          chatId.includes('@broadcast') || 
          chatId.includes('@status') ||
          chatId === 'status@broadcast') {
        return true;
      }
      
      // 2. Vérifier les noms de contact suspects (plus spécifiques)
      const spamNames = [
        'jobs', 'emploi', 'emplois', 'recrutement', 'newsletter', 'news', 
        'bulletin', 'publicité', 'pub', 'marketing', 'promo', 'promotion', 
        'vente', 'sécurité', 'paiement', 'facture', 'compte'
      ];
      
      for (const spamName of spamNames) {
        if (contactName.includes(spamName)) {
          return true;
        }
      }
      
      // 3. Vérifier les patterns de spam spécifiques (plus précis)
      const spamPatterns = [
        // Liens de publicité avec mots-clés
        /(cliquer|cliquez|clique).*https?:\/\/[^\s]+/i,
        // Offres d'emploi avec liens
        /(offre|offres|emploi|emplois|job|jobs|recrutement).*https?:\/\/[^\s]+/i,
        // Messages de newsletter
        /(newsletter|news|bulletin|abonnement|désabonnement|unsubscribe)/i,
        // Publicité avec prix
        /(prix|€|\$|cfa|franc).*https?:\/\/[^\s]+/i,
        // Messages de service commercial
        /(service client|support|aide|assistance|contact).*https?:\/\/[^\s]+/i
      ];
      
      // Vérifier les patterns de spam
      for (const pattern of spamPatterns) {
        if (pattern.test(messageBody)) {
          return true;
        }
      }
      
      // 4. Vérifier la longueur excessive (spam typique)
      if (messageBody.length > 500) {
        return true;
      }
      
      // 5. Vérifier les messages avec beaucoup de caractères spéciaux
      const specialCharCount = (messageBody.match(/[🔴🟢🟡🔵🟣🟠⚫⚪🟤]/g) || []).length;
      if (specialCharCount > 5) {
        return true;
      }
      
      // 6. Vérifier les messages avec plusieurs liens (spam typique)
      const linkCount = (messageBody.match(/https?:\/\/[^\s]+/g) || []).length;
      if (linkCount > 2) {
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Erreur lors de la détection de spam:', error);
      return false;
    }
  }

  /**
   * 🆕 NOUVELLE FONCTIONNALITÉ : Gestion des suggestions de commandes avec "/"
   */
  async handleCommandSuggestions(message, contact, chat) {
    try {
      const messageText = message.body.trim();
      
      // Vérifier si le message commence par "/"
      if (!messageText.startsWith('/')) {
        return false;
      }

      const command = messageText.substring(1).toLowerCase();
      const isPrivate = !chat.isGroup;
      const isMember = await this.isGroupMember(contact);

      // Si ce n'est pas un membre du groupe et c'est privé, refuser l'accès
      if (isPrivate && !isMember) {
        await this.sendAIMessage(contact.id._serialized, 
          '❌ Accès refusé. Vous devez être membre du groupe autorisé pour utiliser ce bot.');
        return true;
      }

      // Gérer les commandes de suggestions
      if (command === '' || command === 'aide' || command === 'help') {
        await this.sendCommandSuggestions(contact, isPrivate);
        return true;
      }

      // Gérer les commandes spécifiques
      if (command === 'presence' || command === 'présence') {
        await this.sendPresenceCommands(contact, isPrivate);
        return true;
      }

      if (command === 'permission' || command === 'permissions') {
        await this.sendPermissionCommands(contact, isPrivate);
        return true;
      }

      if (command === 'statut' || command === 'status') {
        await this.sendAttendanceStatus(message, contact);
        return true;
      }

      if (command === 'ia' || command === 'ai' || command === 'chat') {
        await this.sendAIChatCommands(contact, isPrivate);
        return true;
      }

      // Commandes d'admin - accessibles seulement aux admins du groupe WhatsApp
      if (command.startsWith('admin') || 
          command.startsWith('presences') || 
          command.startsWith('présences') ||
          command.startsWith('stats') || 
          command.startsWith('statistiques') ||
          command.startsWith('employés') || 
          command.startsWith('employes') ||
          command.startsWith('rapport') || 
          command.startsWith('rapports')) {
        
        // Vérifier si l'utilisateur est admin du groupe WhatsApp
        let isGroupAdmin = false;
        
        if (chat && chat.isGroup) {
          // Pour les messages de groupe, vérifier le statut admin
          isGroupAdmin = await this.isGroupAdmin(contact, chat);
        } else {
          // Pour les messages privés, vérifier si c'est un membre du groupe
          // (nous considérons que tous les membres peuvent être des admins potentiels)
          const isMember = await this.isGroupMember(contact);
          isGroupAdmin = isMember;
        }
        
        if (!isGroupAdmin) {
          await this.sendAIMessage(contact.id._serialized, 
            '❌ Accès refusé. Seuls les administrateurs du groupe peuvent utiliser ces commandes.');
          return true;
        }
        
        // Laisser passer ces commandes à l'IA pour traitement
        return false;
      }

      // Commande non reconnue
      await this.sendAIMessage(contact.id._serialized, 
        `❓ Commande "/${command}" non reconnue.\n\nTapez "/aide" pour voir toutes les commandes disponibles.`);
      return true;

    } catch (error) {
      console.error('Erreur lors du traitement des suggestions de commandes:', error);
      return false;
    }
  }

  /**
   * Envoie les suggestions de commandes principales
   */
  async sendCommandSuggestions(contact, isPrivate) {
    const context = isPrivate ? 'privé' : 'groupe';
    
    let suggestions = `🤖 *Commandes disponibles (${context})*\n\n`;
    
    suggestions += `*📅 PRÉSENCE :*\n`;
    suggestions += `• \`/presence\` → Voir les commandes de présence\n`;
    suggestions += `• \`/statut\` → Voir mon statut du jour\n\n`;
    
    suggestions += `*📋 PERMISSIONS :*\n`;
    suggestions += `• \`/permission\` → Voir les commandes de permissions\n\n`;
    
    suggestions += `*🤖 IA & CHAT :*\n`;
    suggestions += `• \`/ia\` → Voir les commandes de conversation avec l'IA\n`;
    suggestions += `• Parlez naturellement → L'IA vous répond intelligemment\n\n`;
    
    if (contact.number === process.env.ADMIN_PHONE) {
      suggestions += `*⚙️ ADMIN :*\n`;
      suggestions += `• \`/admin\` → Commandes administrateur\n\n`;
    }
    
    suggestions += `*💡 ASTUCE :*\n`;
    suggestions += `• Tapez "/" suivi d'une commande pour des suggestions\n`;
    suggestions += `• Ou parlez naturellement, l'IA vous comprend !`;

    await this.sendAIMessage(contact.id._serialized, suggestions);
  }

  /**
   * Envoie les commandes de présence
   */
  async sendPresenceCommands(contact, isPrivate) {
    let commands = `📅 *Commandes de présence*\n\n`;
    
    commands += `*✅ ARRIVÉE :*\n`;
    commands += `• "Arrivée" ou "Bonjour" → Marquer l'arrivée\n`;
    commands += `• "Je suis là" → Marquer l'arrivée\n\n`;
    
    commands += `*🚪 DÉPART :*\n`;
    commands += `• "Départ" ou "Au revoir" → Marquer le départ\n`;
    commands += `• "Je pars" → Marquer le départ\n\n`;
    
    commands += `*🍽️ PAUSE :*\n`;
    commands += `• "Pause" ou "Déjeuner" → Commencer la pause\n`;
    commands += `• "Retour de pause" → Finir la pause\n\n`;
    
    commands += `*❌ ABSENCE :*\n`;
    commands += `• "Absent" ou "Malade" → Déclarer une absence\n\n`;
    
    commands += `*🚀 MISSIONS :*\n`;
    commands += `• "Mission" ou "Sortie" → Sortie en mission\n`;
    commands += `• "Retour de mission" → Retour de mission\n\n`;
    
    commands += `*🏠 TÉLÉTRAVAIL :*\n`;
    commands += `• "Télétravail" ou "Remote" → Travail à distance\n\n`;
    
    commands += `*🏖️ CONGÉS :*\n`;
    commands += `• "Congé" ou "Vacances" → Déclarer un congé\n\n`;
    
    commands += `*📊 STATUT :*\n`;
    commands += `• \`/statut\` → Voir ma présence du jour`;

    await this.sendAIMessage(contact.id._serialized, commands);
  }

  /**
   * Envoie les commandes de permissions
   */
  async sendPermissionCommands(contact, isPrivate) {
    let commands = `📋 *Commandes de permissions*\n\n`;
    
    commands += `*📝 DEMANDER UNE PERMISSION :*\n`;
    commands += `• "Permission congé du 15/12/2023 au 20/12/2023 pour vacances"\n`;
    commands += `• "Maladie du 10/12/2023 au 12/12/2023"\n`;
    commands += `• "Permission médicale du 05/12/2023 au 06/12/2023"\n`;
    commands += `• "Permission personnelle du 01/12/2023 au 02/12/2023"\n\n`;
    
    commands += `*📅 FORMAT DES DATES :*\n`;
    commands += `• JJ/MM/AAAA (ex: 15/12/2023)\n`;
    commands += `• JJ-MM-AAAA (ex: 15-12-2023)\n\n`;
    
    commands += `*📋 TYPES DE PERMISSIONS :*\n`;
    commands += `• Congé / Vacances\n`;
    commands += `• Maladie / Arrêt maladie\n`;
    commands += `• Médical / Rendez-vous\n`;
    commands += `• Personnel / Famille\n\n`;
    
    commands += `*💡 EXEMPLE COMPLET :*\n`;
    commands += `"Permission congé du 15/12/2023 au 20/12/2023 pour vacances familiales"`;

    await this.sendAIMessage(contact.id._serialized, commands);
  }

  /**
   * Envoie les commandes de chat avec l'IA
   */
  async sendAIChatCommands(contact, isPrivate) {
    let commands = `🤖 *Commandes de chat avec l'IA*\n\n`;
    
    commands += `*💬 CONVERSATIONS LIBRES :*\n`;
    commands += `• Parlez naturellement → L'IA vous répond intelligemment\n`;
    commands += `• "Comment ça va ?" → L'IA vous répond\n`;
    commands += `• "Que penses-tu de..." → L'IA donne son avis\n\n`;
    
    commands += `*🏢 QUESTIONS D'ENTREPRISE :*\n`;
    commands += `• "Comment gérer les retards ?"\n`;
    commands += `• "Que faire si quelqu'un me parle mal ?"\n`;
    commands += `• "Comment améliorer la communication ?"\n`;
    commands += `• "Comment prendre une bonne décision ?"\n\n`;
    
    commands += `*🎯 MENTIONS DIRECTES :*\n`;
    commands += `• "Mr bot, j'ai besoin de ton avis..."\n`;
    commands += `• "Bot, que penses-tu de..."\n`;
    commands += `• "IA, aide-moi avec..."\n\n`;
    
    commands += `*💡 ASTUCE :*\n`;
    commands += `• L'IA comprend le contexte (groupe vs privé)\n`;
    commands += `• Elle s'adapte à votre situation\n`;
    commands += `• Elle peut vous conseiller sur le travail`;

    await this.sendAIMessage(contact.id._serialized, commands);
  }

  /**
   * Envoie les commandes administrateur
   */
  async sendAdminCommands(contact) {
    let commands = `⚙️ *Commandes administrateur*\n\n`;
    
    commands += `*📊 RAPPORTS :*\n`;
    commands += `• "rapport" → Générer un rapport de présence du jour\n\n`;
    
    commands += `*🔄 SYNCHRONISATION :*\n`;
    commands += `• "/sync" → Synchroniser les membres du groupe\n`;
    commands += `• "groupes" → Lister tous les groupes disponibles\n\n`;
    
    commands += `*📋 PERMISSIONS :*\n`;
    commands += `• "APPROUVER [ID]" → Approuver une permission\n`;
    commands += `• "REJETER [ID]" → Rejeter une permission\n\n`;
    
    commands += `*🔧 MAINTENANCE :*\n`;
    commands += `• Le bot se synchronise automatiquement\n`;
    commands += `• Les membres sont mis à jour en temps réel`;

    await this.sendAIMessage(contact.id._serialized, commands);
  }

  /**
   * Envoie une réponse quand l'IA ne recommande pas de traiter le message
   */
  async sendNoActionResponse(contact, message, isPrivate) {
    try {
      const messageLower = message.toLowerCase();
      const context = isPrivate ? 'privé' : 'groupe';
      
      // Analyser le type de message pour donner une réponse appropriée
      if (messageLower.includes('?')) {
        // C'est une question
        const responses = [
          `🤔 Je ne peux pas répondre à cette question spécifique. Pour des questions sur le travail, tapez \`/ia\` pour voir comment discuter avec moi !`,
          `❓ Cette question ne semble pas liée aux fonctionnalités du bot. Utilisez \`/aide\` pour voir ce que je peux faire pour vous.`,
          `🤖 Je ne comprends pas cette question. Parlez-moi naturellement ou utilisez \`/ia\` pour discuter !`
        ];
        const response = responses[Math.floor(Math.random() * responses.length)];
        await this.sendAIMessage(contact.id._serialized, response);
        
      } else if (messageLower.includes('bonjour') || messageLower.includes('salut') || messageLower.includes('hello')) {
        // C'est une salutation
        const responses = [
          `👋 Salut ! Utilisez \`/aide\` pour voir ce que je peux faire pour vous.`,
          `👋 Bonjour ! Tapez \`/\` pour voir toutes les commandes disponibles.`,
          `👋 Hello ! Je suis là pour vous aider. Utilisez \`/presence\` pour marquer votre présence.`
        ];
        const response = responses[Math.floor(Math.random() * responses.length)];
        await this.sendAIMessage(contact.id._serialized, response);
        
      } else if (messageLower.includes('merci') || messageLower.includes('thanks')) {
        // C'est un remerciement
        await this.sendAIMessage(contact.id._serialized, 
          `😊 De rien ! N'hésitez pas à utiliser \`/aide\` si vous avez besoin d'aide.`);
        
      } else if (messageLower.includes('aide') || messageLower.includes('help')) {
        // Demande d'aide
        await this.sendCommandSuggestions(contact, isPrivate);
        
      } else {
        // Message générique
        const responses = [
          `🤖 Je ne comprends pas ce message. Utilisez \`/aide\` pour voir ce que je peux faire pour vous.`,
          `❓ Ce message ne semble pas correspondre à mes fonctionnalités. Tapez \`/\` pour voir les commandes disponibles.`,
          `🤔 Je ne peux pas traiter ce message. Utilisez \`/ia\` pour discuter avec moi ou \`/presence\` pour marquer votre présence.`,
          `💡 Je ne reconnais pas cette commande. Utilisez \`/aide\` pour voir toutes les possibilités.`
        ];
        const response = responses[Math.floor(Math.random() * responses.length)];
        await this.sendAIMessage(contact.id._serialized, response);
      }
      
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la réponse no-action:', error);
      // Fallback simple
      await this.sendAIMessage(contact.id._serialized, 
        `🤖 Je ne comprends pas ce message. Utilisez \`/aide\` pour voir ce que je peux faire.`);
    }
  }

  /**
   * 🤖 NOUVELLE MÉTHODE : Traitement des messages avec IA
   */
  async handleMessageWithAI(message, contact, messageBody) {
    try {
      console.log('🤖 Démarrage de l\'analyse IA...');
      
      // Vérifier d'abord si c'est une commande avec "/"
      const chat = await message.getChat();
      const isCommandHandled = await this.handleCommandSuggestions(message, contact, chat);
      if (isCommandHandled) {
        console.log('✅ Commande "/" traitée');
        return;
      }
      
      // Analyser le message avec l'IA
      const aiResult = await aiAgent.processMessage(message.body, contact, chat);
      
      console.log('📊 Résultat de l\'analyse IA:', {
        type: aiResult.analysis.type,
        confidence: aiResult.analysis.confidence,
        action: aiResult.analysis.action,
        shouldProcess: aiResult.shouldProcess
      });

      // Si l'IA recommande de traiter le message
      if (aiResult.shouldProcess) {
        console.log('✅ L\'IA recommande de traiter ce message');
        
        // Exécuter l'action recommandée
        await this.executeAIAction(aiResult.analysis, message, contact);
        
        // Envoyer une réponse intelligente
        if (aiResult.response) {
          await this.sendAIMessage(contact.id._serialized, aiResult.response);
        }
      } else {
        console.log('ℹ️ L\'IA ne recommande pas de traiter ce message');
        
        // Envoyer une réponse pour expliquer pourquoi le message n'est pas traité
        await this.sendNoActionResponse(contact, message.body, false);
      }

    } catch (error) {
      console.error('❌ Erreur lors du traitement IA:', error);
      
      // Fallback vers le traitement classique
      console.log('🔄 Fallback vers le traitement classique...');
      await this.handleGroupMessage(message, contact, messageBody);
    }
  }

  /**
   * 🤖 NOUVELLE MÉTHODE : Traitement des messages privés avec IA
   */
  async handlePrivateMessageWithAI(message, contact, messageBody) {
    try {
      console.log('🤖 Démarrage de l\'analyse IA pour message privé...');
      
      // Vérifier d'abord si la personne est membre du groupe
      const isMember = await this.isGroupMember(contact);
      if (!isMember) {
        await this.sendAIMessage(contact.id._serialized, 
          '❌ Accès refusé. Vous devez être membre du groupe autorisé pour utiliser ce bot.');
        return;
      }

      // Vérifier d'abord si c'est une commande avec "/"
      const chat = await message.getChat();
      const isCommandHandled = await this.handleCommandSuggestions(message, contact, chat);
      if (isCommandHandled) {
        console.log('✅ Commande "/" traitée (privé)');
        return;
      }

      // Analyser le message avec l'IA
      const chatInfo = chat ? {
        id: { _serialized: chat.id._serialized || contact.id._serialized },
        isGroup: chat.isGroup || false
      } : {
        id: { _serialized: contact.id._serialized },
        isGroup: false
      };
      
      const aiResult = await aiAgent.processMessage(message.body, contact, chatInfo);
      
      console.log('📊 Résultat de l\'analyse IA (privé):', {
        type: aiResult.analysis.type,
        confidence: aiResult.analysis.confidence,
        action: aiResult.analysis.action,
        shouldProcess: aiResult.shouldProcess
      });

      // Si l'IA recommande de traiter le message
      if (aiResult.shouldProcess) {
        console.log('✅ L\'IA recommande de traiter ce message privé');
        
        // Exécuter l'action recommandée
        await this.executeAIAction(aiResult.analysis, message, contact);
        
        // Envoyer une réponse intelligente
        if (aiResult.response) {
          await this.sendAIMessage(contact.id._serialized, aiResult.response);
        }
      } else {
        console.log('ℹ️ L\'IA ne recommande pas de traiter ce message privé');
        
        // Envoyer une réponse pour expliquer pourquoi le message n'est pas traité
        await this.sendNoActionResponse(contact, message.body, true);
      }

    } catch (error) {
      console.error('❌ Erreur lors du traitement IA privé:', error);
      
      // Fallback vers le traitement classique
      console.log('🔄 Fallback vers le traitement classique...');
      await this.handlePrivateMessage(message, contact, messageBody);
    }
  }

  /**
   * Exécute l'action recommandée par l'IA
   */
  async executeAIAction(analysis, message, contact) {
    try {
      console.log(`🎯 Exécution de l'action IA: ${analysis.action}`);

      switch (analysis.action) {
        case 'arrival':
        case 'departure':
        case 'lunch_break':
        case 'lunch_return':
        case 'absence':
        case 'mission':
        case 'mission_return':
        case 'remote_work':
        case 'leave':
          // L'IA gère tout, pas d'action spécifique du bot
          break;
        case 'create_permission':
          await this.handleAIPermissionRequest(analysis, message, contact);
          break;
        case 'provide_help':
          await this.sendHelpMessage(contact.id._serialized);
          break;
        case 'greet_back':
          await this.sendGreetingMessage(contact.id._serialized);
          break;
        case 'status_check':
          await this.sendAttendanceStatus(message, contact);
          break;
        case 'free_chat':
          // Pas d'action spécifique, juste répondre
          break;
        case 'admin_command':
          // Les commandes d'admin sont gérées par l'IA, pas d'action spécifique
          // La réponse sera envoyée par l'IA
          break;
        default:
          console.log('ℹ️ Aucune action spécifique à exécuter');
      }

    } catch (error) {
      console.error('❌ Erreur lors de l\'exécution de l\'action IA:', error);
    }
  }

  /**
   * Gère les demandes de permission via IA
   */
  async handleAIPermissionRequest(analysis, message, contact) {
    try {
      const extractedInfo = analysis.extractedInfo;
      
      if (!extractedInfo.startDate || !extractedInfo.endDate) {
        await this.sendAIMessage(contact.id._serialized, 
          '📋 Demande reçue. Veuillez préciser les dates (ex: du 15/12/2023 au 20/12/2023).');
        return;
      }

      // Vérifier si la personne est membre du groupe
      const isMember = await this.isGroupMember(contact);
      if (!isMember) {
        await this.sendAIMessage(contact.id._serialized, 
          '❌ Accès refusé. Vous devez être membre du groupe autorisé pour demander une permission.');
        return;
      }

      const employee = await this.getOrCreateEmployee(contact);
      
      // Créer la demande de permission
      await db.query(
        'INSERT INTO permissions (employee_id, type, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
        [employee.id, extractedInfo.type, extractedInfo.startDate, extractedInfo.endDate, extractedInfo.reason, 'pending']
      );

      await this.sendAIMessage(contact.id._serialized, 
        `📋 Demande de permission créée du ${extractedInfo.startDate} au ${extractedInfo.endDate}. En attente d'approbation.`);

      // Notifier l'admin
      await this.notifyAdminNewPermission(employee, extractedInfo.type, extractedInfo.startDate, extractedInfo.endDate, extractedInfo.reason);

    } catch (error) {
      console.error('Erreur lors du traitement de la demande de permission IA:', error);
      await this.sendAIMessage(contact.id._serialized, 
        '❌ Erreur lors du traitement de votre demande de permission');
    }
  }

  /**
   * Envoie un message via l'IA
   */
  async sendAIMessage(contactId, message) {
    try {
      // Utiliser la nouvelle API de whatsapp-web.js
      await this.client.sendMessage(contactId, message);
      console.log('🤖 Message IA envoyé:', message);
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi du message IA:', error);
      // Fallback: essayer d'envoyer via le chat
      try {
        const chat = await this.client.getChatById(contactId);
        await chat.sendMessage(message);
        console.log('🤖 Message IA envoyé (fallback):', message);
      } catch (fallbackError) {
        console.error('❌ Erreur fallback lors de l\'envoi du message IA:', fallbackError);
      }
    }
  }

  /**
   * Envoie un message d'aide
   */
  async sendHelpMessage(contactId) {
    const helpMessage = `🤖 *Commandes disponibles :*

*Présence :*
• "Arrivée" ou "Bonjour" → Marquer l'arrivée
• "Départ" ou "Au revoir" → Marquer le départ  
• "Pause" → Commencer la pause déjeuner
• "Retour de pause" → Finir la pause
• "Absent" → Déclarer une absence

*Permissions :*
• "Permission congé du 15/12 au 20/12" → Demander un congé
• "Maladie du 10/12 au 12/12" → Demander un arrêt maladie

*Autres :*
• "Statut" → Voir ma présence du jour
• "Aide" → Afficher cette aide`;

    await this.sendAIMessage(contactId, helpMessage);
  }

  /**
   * Envoie un message de salutation
   */
  async sendGreetingMessage(contactId) {
    const greetings = [
      '👋 Bonjour ! Comment puis-je vous aider aujourd\'hui ?',
      '👋 Salut ! Que puis-je faire pour vous ?',
      '👋 Hello ! En quoi puis-je vous assister ?'
    ];
    
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    await this.sendAIMessage(contactId, randomGreeting);
  }

  async handleGroupMessage(message, contact, messageBody) {
    const phoneNumber = contact.number;
    
    // Commandes de présence
    if (messageBody.includes('arrivée') || messageBody.includes('arrive') || messageBody.includes('bonjour')) {
      await this.handleArrival(message, contact);
    }
    else if (messageBody.includes('départ') || messageBody.includes('depart') || messageBody.includes('au revoir')) {
      await this.handleDeparture(message, contact);
    }
    else if (messageBody.includes('pause') || messageBody.includes('déjeuner')) {
      await this.handleLunchBreak(message, contact);
    }
    else if (messageBody.includes('retour') && messageBody.includes('pause')) {
      await this.handleLunchReturn(message, contact);
    }
    else if (messageBody.includes('absent') || messageBody.includes('malade')) {
      await this.handleAbsence(message, contact);
    }
    else if (messageBody.includes('rapport') && contact.number === process.env.ADMIN_PHONE) {
      await this.generateReport(message, contact);
    }
    else if (messageBody.includes('/sync') && contact.number === process.env.ADMIN_PHONE) {
      await this.handleSyncMembers(message, contact);
    }
  }

  async handleSyncMembers(message, contact) {
    try {
      await message.reply('🔄 Synchronisation des membres en cours...');
      
      const chat = await this.client.getChatById(this.groupId);
      if (chat) {
        await this.syncGroupMembers(chat);
        await message.reply('✅ Synchronisation des membres terminée !');
      } else {
        await message.reply('❌ Impossible de récupérer les informations du groupe');
      }
    } catch (error) {
      console.error('Erreur lors de la synchronisation manuelle:', error);
      await message.reply('❌ Erreur lors de la synchronisation des membres');
    }
  }

  async handlePrivateMessage(message, contact, messageBody) {
    const phoneNumber = contact.number;
    
    // Vérifier d'abord si la personne est membre du groupe
    const isMember = await this.isGroupMember(contact);
    if (!isMember) {
      console.log(`🚫 Message privé ignoré - ${contact.name || contact.number} n'est pas membre du groupe`);
      await message.reply('❌ Accès refusé. Vous devez être membre du groupe autorisé pour utiliser ce bot.');
      return;
    }
    
    // Commande spéciale pour lister les groupes (admin seulement)
    if (messageBody.includes('groupes') || messageBody.includes('liste-groupes')) {
      if (contact.number === process.env.ADMIN_PHONE) {
        await this.listAvailableGroups();
        await message.reply('📋 Liste des groupes affichée dans la console du serveur');
      } else {
        await message.reply('❌ Cette commande est réservée à l\'administrateur');
      }
      return;
    }
    
    // Vérifier si c'est une demande de permission
    if (messageBody.includes('permission') || messageBody.includes('congé') || messageBody.includes('absence')) {
      await this.handlePermissionRequest(message, contact);
    }
    else if (messageBody.includes('statut') || messageBody.includes('présence')) {
      await this.sendAttendanceStatus(message, contact);
    }
    else {
      // Message d'aide
      await message.reply(`📋 Commandes disponibles :
      
🔹 *Demander une permission :*
\`permission [type] [date] [raison]\`

🔹 *Voir mon statut :*
\`statut\` ou \`présence\`

📞 Pour toute question, contactez votre administrateur.`);
    }
  }

  async handleArrival(message, contact) {
    try {
      const employee = await this.getOrCreateEmployee(contact);
      const today = moment().format('YYYY-MM-DD');
      const currentTime = moment().format('HH:mm:ss');

      // Vérifier si l'employé a déjà marqué son arrivée aujourd'hui
      const existingAttendance = await db.query(
        'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
        [employee.id, today]
      );

      if (existingAttendance.length > 0 && existingAttendance[0].arrival_time) {
        await this.client.sendMessage(contact.id._serialized, `✅ Vous avez déjà marqué votre arrivée à ${existingAttendance[0].arrival_time}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`);
        return;
      }

      // Déterminer le statut (en retard ou à l'heure)
      const workStartTime = await this.getSetting('work_start_time');
      const lateThreshold = parseInt(await this.getSetting('late_threshold_minutes'));
      const isLate = moment(currentTime, 'HH:mm:ss').isAfter(
        moment(workStartTime, 'HH:mm:ss').add(lateThreshold, 'minutes')
      );

      const status = isLate ? 'late' : 'present';

      if (existingAttendance.length > 0) {
        // Mettre à jour l'arrivée existante
        await db.query(
          'UPDATE attendance SET arrival_time = ?, status = ?, updated_at = NOW() WHERE employee_id = ? AND date = ?',
          [currentTime, status, employee.id, today]
        );
      } else {
        // Créer une nouvelle entrée de présence
        await db.query(
          'INSERT INTO attendance (employee_id, date, arrival_time, status) VALUES (?, ?, ?, ?)',
          [employee.id, today, currentTime, status]
        );
      }

      const statusMessage = isLate ? '⚠️ Arrivée enregistrée (retard)' : '✅ Arrivée enregistrée';
      const fullMessage = `${statusMessage} à ${currentTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`;
      await this.client.sendMessage(contact.id._serialized, fullMessage);

      // Émettre un événement WebSocket pour l'arrivée
      if (global.io) {
        global.io.emit('attendance_update', {
          type: 'arrival',
          employee_id: employee.id,
          employee_name: employee.name,
          time: currentTime,
          status: status,
          is_late: isLate,
          timestamp: new Date()
        });
        console.log('📡 Événement WebSocket "attendance_update" émis (arrivée)');
      }

    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de l\'arrivée:', error);
      await this.client.sendMessage(contact.id._serialized, '❌ Erreur lors de l\'enregistrement de votre arrivée');
    }
  }

  async handleDeparture(message, contact) {
    try {
      const employee = await this.getOrCreateEmployee(contact);
      const today = moment().format('YYYY-MM-DD');
      const currentTime = moment().format('HH:mm:ss');

      // Vérifier si l'employé a marqué son arrivée
      const attendance = await db.query(
        'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
        [employee.id, today]
      );

      if (attendance.length === 0 || !attendance[0].arrival_time) {
        await this.client.sendMessage(contact.id._serialized, '❌ Vous devez d\'abord marquer votre arrivée');
        return;
      }

      if (attendance[0].departure_time) {
        await this.client.sendMessage(contact.id._serialized, `✅ Vous avez déjà marqué votre départ à ${attendance[0].departure_time}`);
        return;
      }

      // Calculer les heures de travail
      const arrivalTime = moment(attendance[0].arrival_time, 'HH:mm:ss');
      const departureTime = moment(currentTime, 'HH:mm:ss');
      const lunchStart = attendance[0].lunch_start ? moment(attendance[0].lunch_start, 'HH:mm:ss') : null;
      const lunchEnd = attendance[0].lunch_end ? moment(attendance[0].lunch_end, 'HH:mm:ss') : null;

      let totalHours = departureTime.diff(arrivalTime, 'hours', true);
      
      // Soustraire la pause déjeuner si elle a été marquée
      if (lunchStart && lunchEnd) {
        const lunchDuration = lunchEnd.diff(lunchStart, 'hours', true);
        totalHours -= lunchDuration;
      }

      // Mettre à jour le départ
      await db.query(
        'UPDATE attendance SET departure_time = ?, total_work_hours = ? WHERE employee_id = ? AND date = ?',
        [currentTime, totalHours, employee.id, today]
      );

      await this.client.sendMessage(contact.id._serialized, `✅ Départ enregistré à ${currentTime}\n📊 Heures travaillées: ${totalHours.toFixed(2)}h\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`);

      // Émettre un événement WebSocket pour le départ
      if (global.io) {
        global.io.emit('attendance_update', {
          type: 'departure',
          employee_id: employee.id,
          employee_name: employee.name,
          time: currentTime,
          total_hours: totalHours,
          timestamp: new Date()
        });
        console.log('📡 Événement WebSocket "attendance_update" émis (départ)');
      }

    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du départ:', error);
      await this.client.sendMessage(contact.id._serialized, '❌ Erreur lors de l\'enregistrement de votre départ');
    }
  }

  async handleLunchBreak(message, contact) {
    try {
      const employee = await this.getOrCreateEmployee(contact);
      const today = moment().format('YYYY-MM-DD');
      const currentTime = moment().format('HH:mm:ss');

      const attendance = await db.query(
        'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
        [employee.id, today]
      );

      if (attendance.length === 0) {
        await this.client.sendMessage(contact.id._serialized, '❌ Vous devez d\'abord marquer votre arrivée');
        return;
      }

      if (attendance[0].lunch_start) {
        await this.client.sendMessage(contact.id._serialized, `✅ Vous avez déjà marqué le début de votre pause à ${attendance[0].lunch_start}`);
        return;
      }

      await db.query(
        'UPDATE attendance SET lunch_start = ? WHERE employee_id = ? AND date = ?',
        [currentTime, employee.id, today]
      );

      await this.client.sendMessage(contact.id._serialized, `🍽️ Pause déjeuner commencée à ${currentTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`);

    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la pause:', error);
      await this.client.sendMessage(contact.id._serialized, '❌ Erreur lors de l\'enregistrement de votre pause');
    }
  }

  async handleLunchReturn(message, contact) {
    try {
      const employee = await this.getOrCreateEmployee(contact);
      const today = moment().format('YYYY-MM-DD');
      const currentTime = moment().format('HH:mm:ss');

      const attendance = await db.query(
        'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
        [employee.id, today]
      );

      if (attendance.length === 0 || !attendance[0].lunch_start) {
        await this.client.sendMessage(contact.id._serialized, '❌ Vous devez d\'abord marquer le début de votre pause');
        return;
      }

      if (attendance[0].lunch_end) {
        await this.client.sendMessage(contact.id._serialized, `✅ Vous avez déjà marqué la fin de votre pause à ${attendance[0].lunch_end}`);
        return;
      }

      await db.query(
        'UPDATE attendance SET lunch_end = ? WHERE employee_id = ? AND date = ?',
        [currentTime, employee.id, today]
      );

      await this.client.sendMessage(contact.id._serialized, `✅ Retour de pause à ${currentTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`);

    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du retour de pause:', error);
      await this.client.sendMessage(contact.id._serialized, '❌ Erreur lors de l\'enregistrement de votre retour de pause');
    }
  }

  async handleAbsence(message, contact) {
    try {
      const employee = await this.getOrCreateEmployee(contact);
      const today = moment().format('YYYY-MM-DD');

      // Vérifier si l'employé a déjà une entrée pour aujourd'hui
      const existingAttendance = await db.query(
        'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
        [employee.id, today]
      );

      if (existingAttendance.length > 0) {
        await db.query(
          'UPDATE attendance SET status = ?, notes = ? WHERE employee_id = ? AND date = ?',
          ['absent', 'Absence déclarée', employee.id, today]
        );
      } else {
        await db.query(
          'INSERT INTO attendance (employee_id, date, status, notes) VALUES (?, ?, ?, ?)',
          [employee.id, today, 'absent', 'Absence déclarée']
        );
      }

      await this.client.sendMessage(contact.id._serialized, '📝 Absence enregistrée pour aujourd\'hui\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !');

    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de l\'absence:', error);
      await this.client.sendMessage(contact.id._serialized, '❌ Erreur lors de l\'enregistrement de votre absence');
    }
  }

  async handleMission(message, contact) {
    try {
      const employee = await this.getOrCreateEmployee(contact);
      const today = moment().format('YYYY-MM-DD');
      const currentTime = moment().format('HH:mm:ss');

      // Vérifier si l'employé a déjà une entrée pour aujourd'hui
      const existingAttendance = await db.query(
        'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
        [employee.id, today]
      );

      if (existingAttendance.length > 0) {
        await db.query(
          'UPDATE attendance SET status = ?, notes = ? WHERE employee_id = ? AND date = ?',
          ['on_mission', 'Sortie en mission', employee.id, today]
        );
      } else {
        await db.query(
          'INSERT INTO attendance (employee_id, date, status, notes) VALUES (?, ?, ?, ?)',
          [employee.id, today, 'on_mission', 'Sortie en mission']
        );
      }

      await this.client.sendMessage(contact.id._serialized, `🚀 Sortie en mission enregistrée à ${currentTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`);

    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la mission:', error);
      await this.client.sendMessage(contact.id._serialized, '❌ Erreur lors de l\'enregistrement de votre sortie en mission');
    }
  }

  async handleMissionReturn(message, contact) {
    try {
      const employee = await this.getOrCreateEmployee(contact);
      const today = moment().format('YYYY-MM-DD');
      const currentTime = moment().format('HH:mm:ss');

      const attendance = await db.query(
        'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
        [employee.id, today]
      );

      if (attendance.length === 0) {
        await this.client.sendMessage(contact.id._serialized, '❌ Aucune sortie en mission enregistrée pour aujourd\'hui');
        return;
      }

      if (attendance[0].status !== 'on_mission') {
        await this.client.sendMessage(contact.id._serialized, '❌ Vous n\'étiez pas en mission');
        return;
      }

      await db.query(
        'UPDATE attendance SET status = ?, notes = ? WHERE employee_id = ? AND date = ?',
        ['present', 'Retour de mission', employee.id, today]
      );

      await this.client.sendMessage(contact.id._serialized, `✅ Retour de mission enregistré à ${currentTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`);

    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du retour de mission:', error);
      await this.client.sendMessage(contact.id._serialized, '❌ Erreur lors de l\'enregistrement de votre retour de mission');
    }
  }

  async handleRemoteWork(message, contact) {
    try {
      const employee = await this.getOrCreateEmployee(contact);
      const today = moment().format('YYYY-MM-DD');
      const currentTime = moment().format('HH:mm:ss');

      // Vérifier si l'employé a déjà une entrée pour aujourd'hui
      const existingAttendance = await db.query(
        'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
        [employee.id, today]
      );

      if (existingAttendance.length > 0) {
        await db.query(
          'UPDATE attendance SET status = ?, notes = ? WHERE employee_id = ? AND date = ?',
          ['remote', 'Télétravail', employee.id, today]
        );
      } else {
        await db.query(
          'INSERT INTO attendance (employee_id, date, status, notes) VALUES (?, ?, ?, ?)',
          [employee.id, today, 'remote', 'Télétravail']
        );
      }

      await this.client.sendMessage(contact.id._serialized, `🏠 Télétravail enregistré à ${currentTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`);

    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du télétravail:', error);
      await this.client.sendMessage(contact.id._serialized, '❌ Erreur lors de l\'enregistrement de votre télétravail');
    }
  }

  async handleLeave(message, contact) {
    try {
      const employee = await this.getOrCreateEmployee(contact);
      const today = moment().format('YYYY-MM-DD');
      const currentTime = moment().format('HH:mm:ss');

      // Vérifier si l'employé a déjà une entrée pour aujourd'hui
      const existingAttendance = await db.query(
        'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
        [employee.id, today]
      );

      if (existingAttendance.length > 0) {
        await db.query(
          'UPDATE attendance SET status = ?, notes = ? WHERE employee_id = ? AND date = ?',
          ['on_leave', 'Congé/Repos', employee.id, today]
        );
      } else {
        await db.query(
          'INSERT INTO attendance (employee_id, date, status, notes) VALUES (?, ?, ?, ?)',
          [employee.id, today, 'on_leave', 'Congé/Repos']
        );
      }

      await this.client.sendMessage(contact.id._serialized, `🏖️ Congé/Repos enregistré à ${currentTime}\n\n💡 Tapez "/" pour découvrir ce que je peux faire pour vous !`);

    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du congé:', error);
      await this.client.sendMessage(contact.id._serialized, '❌ Erreur lors de l\'enregistrement de votre congé');
    }
  }

  async handlePermissionRequest(message, contact) {
    try {
      // Vérifier d'abord si la personne est membre du groupe
      const isMember = await this.isGroupMember(contact);
      if (!isMember) {
        await message.reply('❌ Accès refusé. Vous devez être membre du groupe autorisé pour demander une permission.');
        return;
      }

      const employee = await this.getOrCreateEmployee(contact);
      
      // Analyser le message pour extraire les informations
      const messageText = message.body;
      
      // Logique simple pour extraire les dates (à améliorer)
      const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g;
      const dates = messageText.match(dateRegex);
      
      if (!dates || dates.length < 2) {
        await message.reply(
          '📝 Pour demander une permission, veuillez préciser:\n' +
          '• Type de permission (congé, maladie, personnel, etc.)\n' +
          '• Date de début (JJ/MM/AAAA)\n' +
          '• Date de fin (JJ/MM/AAAA)\n' +
          '• Raison\n\n' +
          'Exemple: "Permission congé du 15/12/2023 au 20/12/2023 pour vacances familiales"'
        );
        return;
      }

      const startDate = moment(dates[0], ['DD/MM/YYYY', 'DD-MM-YYYY']).format('YYYY-MM-DD');
      const endDate = moment(dates[1], ['DD/MM/YYYY', 'DD-MM-YYYY']).format('YYYY-MM-DD');
      
      // Déterminer le type de permission
      let type = 'other';
      if (messageText.includes('congé') || messageText.includes('vacance')) type = 'vacation';
      else if (messageText.includes('malade') || messageText.includes('maladie')) type = 'sick_leave';
      else if (messageText.includes('médical') || messageText.includes('medical')) type = 'medical';
      else if (messageText.includes('personnel') || messageText.includes('personnel')) type = 'personal';

      // Extraire la raison
      const reason = messageText.replace(dateRegex, '').replace(/permission|congé|maladie|personnel|médical/gi, '').trim();

      // Créer la demande de permission
      await db.query(
        'INSERT INTO permissions (employee_id, type, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
        [employee.id, type, startDate, endDate, reason, 'pending']
      );

      await message.reply(
        `📋 Demande de permission enregistrée:\n` +
        `• Type: ${type}\n` +
        `• Du: ${startDate}\n` +
        `• Au: ${endDate}\n` +
        `• Raison: ${reason}\n\n` +
        `⏳ En attente d'approbation`
      );

      // Notifier l'admin
      await this.notifyAdminNewPermission(employee, type, startDate, endDate, reason);

    } catch (error) {
      console.error('Erreur lors du traitement de la demande de permission:', error);
      if (error.message.includes('Personne non autorisée')) {
        await message.reply('❌ Accès refusé. Vous devez être membre du groupe autorisé.');
      } else {
        await message.reply('❌ Erreur lors du traitement de votre demande de permission');
      }
    }
  }

  // Vérifier si un contact est membre du groupe configuré
  async isGroupMember(contact) {
    try {
      if (!this.groupId) return false;
      
      // Vérifier dans la base de données si l'employé existe et est actif
      const employee = await db.query(
        'SELECT * FROM employees WHERE (whatsapp_id = ? OR phone = ?) AND is_active = 1 AND group_id = ?',
        [contact.id._serialized, contact.number, this.groupId]
      );
      
      return employee.length > 0;
    } catch (error) {
      console.error('Erreur lors de la vérification d\'appartenance au groupe:', error);
      return false;
    }
  }

  /**
   * Vérifie si un contact est administrateur du groupe WhatsApp
   */
  async isGroupAdmin(contact, chat) {
    try {
      // Si ce n'est pas un groupe, refuser l'accès
      if (!chat || !chat.isGroup) {
        return false;
      }

      // Obtenir les participants du groupe avec la bonne méthode
      const participants = await chat.participants;
      
      if (!participants || participants.length === 0) {
        console.log('Aucun participant trouvé dans le groupe');
        return false;
      }
      
      // Chercher le contact dans les participants
      const participant = participants.find(p => p.id._serialized === contact.id._serialized);
      
      if (!participant) {
        console.log(`Contact ${contact.id._serialized} non trouvé dans les participants`);
        return false;
      }

      // Vérifier si le participant est admin
      const isAdmin = participant.isAdmin || participant.isSuperAdmin;
      console.log(`Contact ${contact.name} - isAdmin: ${participant.isAdmin}, isSuperAdmin: ${participant.isSuperAdmin}, Résultat: ${isAdmin}`);
      
      return isAdmin;
      
    } catch (error) {
      console.error('Erreur lors de la vérification admin du groupe:', error);
      return false;
    }
  }

  async getOrCreateEmployee(contact) {
    try {
      // Vérifier d'abord si la personne est membre du groupe
      const isMember = await this.isGroupMember(contact);
      if (!isMember) {
        throw new Error('Personne non autorisée - pas membre du groupe');
      }

      // Chercher l'employé existant
      let employee = await db.query(
        'SELECT * FROM employees WHERE whatsapp_id = ? OR phone = ?',
        [contact.id._serialized, contact.number]
      );

      if (employee.length === 0) {
        // Créer un nouvel employé SEULEMENT s'il est membre du groupe
        const result = await db.query(
          'INSERT INTO employees (whatsapp_id, name, phone, group_id, is_active) VALUES (?, ?, ?, ?, 1)',
          [contact.id._serialized, contact.name || contact.pushname || 'Employé', contact.number, this.groupId]
        );
        
        employee = await db.query('SELECT * FROM employees WHERE id = ?', [result.insertId]);
      }

      return employee[0];
    } catch (error) {
      console.error('Erreur lors de la récupération/création de l\'employé:', error);
      throw error;
    }
  }

  async saveMessage(message) {
    try {
      await db.query(
        'INSERT INTO messages (message_id, from_number, group_id, content, message_type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [message.id._serialized, message.from, this.groupId, message.body, 'text', new Date()]
      );
      
      // Émettre un événement WebSocket pour notifier les clients
      if (global.io) {
        global.io.emit('new_message', {
          message_id: message.id._serialized,
          from_number: message.from,
          content: message.body,
          message_type: 'text',
          timestamp: new Date()
        });
        console.log('📡 Événement WebSocket "new_message" émis');
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du message:', error);
    }
  }

  async getSetting(key) {
    try {
      const result = await db.query('SELECT setting_value FROM system_settings WHERE setting_key = ?', [key]);
      return result.length > 0 ? result[0].setting_value : null;
    } catch (error) {
      console.error('Erreur lors de la récupération du paramètre:', error);
      return null;
    }
  }

  async notifyAdminNewPermission(employee, type, startDate, endDate, reason) {
    try {
      const adminPhone = process.env.ADMIN_PHONE;
      if (!adminPhone) return;

      const message = 
        `🔔 Nouvelle demande de permission:\n` +
        `👤 Employé: ${employee.name}\n` +
        `📋 Type: ${type}\n` +
        `📅 Du: ${startDate}\n` +
        `📅 Au: ${endDate}\n` +
        `📝 Raison: ${reason}\n\n` +
        `Répondez "APPROUVER ${employee.id}" ou "REJETER ${employee.id}"`;

      await this.client.sendMessage(adminPhone, message);
    } catch (error) {
      console.error('Erreur lors de la notification admin:', error);
    }
  }

  async sendAttendanceStatus(message, contact) {
    try {
      // Vérifier d'abord si la personne est membre du groupe
      const isMember = await this.isGroupMember(contact);
      if (!isMember) {
        await message.reply('❌ Accès refusé. Vous devez être membre du groupe autorisé pour consulter votre statut.');
        return;
      }

      const employee = await this.getOrCreateEmployee(contact);
      const today = moment().format('YYYY-MM-DD');

      const attendance = await db.query(
        'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
        [employee.id, today]
      );

      if (attendance.length === 0) {
        await message.reply('📊 Aucune présence enregistrée pour aujourd\'hui');
        return;
      }

      const att = attendance[0];
      let statusMessage = `📊 Votre présence aujourd'hui:\n`;
      statusMessage += `• Statut: ${att.status}\n`;
      
      if (att.arrival_time) statusMessage += `• Arrivée: ${att.arrival_time}\n`;
      if (att.lunch_start) statusMessage += `• Pause début: ${att.lunch_start}\n`;
      if (att.lunch_end) statusMessage += `• Pause fin: ${att.lunch_end}\n`;
      if (att.departure_time) statusMessage += `• Départ: ${att.departure_time}\n`;
      if (att.total_work_hours) statusMessage += `• Heures travaillées: ${att.total_work_hours}h\n`;

      await message.reply(statusMessage);

    } catch (error) {
      console.error('Erreur lors de l\'envoi du statut:', error);
      if (error.message.includes('Personne non autorisée')) {
        await message.reply('❌ Accès refusé. Vous devez être membre du groupe autorisé.');
      } else {
        await message.reply('❌ Erreur lors de la récupération de votre statut');
      }
    }
  }

  async generateReport(message, contact) {
    try {
      const today = moment().format('YYYY-MM-DD');
      
      // Récupérer toutes les présences du jour
      const attendances = await db.query(`
        SELECT e.name, a.* 
        FROM attendance a 
        JOIN employees e ON a.employee_id = e.id 
        WHERE a.date = ? 
        ORDER BY e.name
      `, [today]);

      let report = `📊 Rapport de présence - ${today}\n\n`;
      
      if (attendances.length === 0) {
        report += 'Aucune présence enregistrée aujourd\'hui.';
      } else {
        attendances.forEach(att => {
          report += `👤 ${att.name}\n`;
          report += `   • Statut: ${att.status}\n`;
          if (att.arrival_time) report += `   • Arrivée: ${att.arrival_time}\n`;
          if (att.departure_time) report += `   • Départ: ${att.departure_time}\n`;
          if (att.total_work_hours) report += `   • Heures: ${att.total_work_hours}h\n`;
          report += '\n';
        });
      }

      await message.reply(report);

    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      await message.reply('❌ Erreur lors de la génération du rapport');
    }
  }

  async cleanupNonGroupMessages() {
    try {
      console.log('🧹 Nettoyage des messages non liés au groupe configuré...');
      
      const db = require('../config/database');
      const result = await db.query(
        'DELETE FROM messages WHERE group_id != ?',
        [this.groupId]
      );
      
      if (result.affectedRows > 0) {
        console.log(`✅ ${result.affectedRows} messages supprimés (ne provenaient pas du groupe configuré)`);
      } else {
        console.log('✅ Aucun message à nettoyer');
      }
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage des messages:', error);
    }
  }

  async cleanup() {
    if (this.client) {
      await this.client.destroy();
    }
  }
}

module.exports = new WhatsAppBot();

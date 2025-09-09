/**
 * Script de configuration de l'IA pour le bot WhatsApp
 * Usage: node scripts/setup-ai.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class AISetup {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Pose une question à l'utilisateur
   */
  async askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  /**
   * Affiche le menu principal
   */
  displayMenu() {
    console.log('\n' + '='.repeat(60));
    console.log('🤖 CONFIGURATION DE L\'IA POUR LE BOT WHATSAPP');
    console.log('='.repeat(60));
    console.log('\n1. 🔑 Configurer la clé API Hugging Face');
    console.log('2. 🧠 Choisir un modèle IA');
    console.log('3. ⚙️ Configurer les paramètres avancés');
    console.log('4. 🧪 Tester les modèles disponibles');
    console.log('5. 📋 Afficher la configuration actuelle');
    console.log('6. 🚀 Démarrer le bot avec l\'IA');
    console.log('0. ❌ Quitter');
    console.log('\n' + '-'.repeat(40));
  }

  /**
   * Configure la clé API Hugging Face
   */
  async configureAPIKey() {
    console.log('\n🔑 CONFIGURATION DE LA CLÉ API HUGGING FACE');
    console.log('-'.repeat(50));
    console.log('1. Allez sur https://huggingface.co/settings/tokens');
    console.log('2. Créez un nouveau token (Read access)');
    console.log('3. Copiez le token et collez-le ci-dessous\n');

    const apiKey = await this.askQuestion('Votre clé API Hugging Face: ');
    
    if (apiKey && apiKey.length > 10) {
      await this.updateEnvFile('HUGGINGFACE_API_KEY', apiKey);
      console.log('✅ Clé API configurée avec succès !');
    } else {
      console.log('❌ Clé API invalide');
    }
  }

  /**
   * Choisit un modèle IA
   */
  async chooseModel() {
    console.log('\n🧠 CHOIX DU MODÈLE IA');
    console.log('-'.repeat(30));
    console.log('1. microsoft/DialoGPT-small (Rapide, léger)');
    console.log('2. microsoft/DialoGPT-medium (Équilibré) ⭐ RECOMMANDÉ');
    console.log('3. microsoft/DialoGPT-large (Intelligent, gourmand)');
    console.log('4. facebook/blenderbot-400M-distill (Très bon)');
    console.log('5. facebook/blenderbot-1B-distill (Excellent, très gourmand)');
    console.log('6. dbmdz/gpt2-french (Spécialisé français)');

    const choice = await this.askQuestion('\nVotre choix (1-6): ');
    
    const models = {
      '1': 'microsoft/DialoGPT-small',
      '2': 'microsoft/DialoGPT-medium',
      '3': 'microsoft/DialoGPT-large',
      '4': 'facebook/blenderbot-400M-distill',
      '5': 'facebook/blenderbot-1B-distill',
      '6': 'dbmdz/gpt2-french'
    };

    const selectedModel = models[choice];
    if (selectedModel) {
      await this.updateEnvFile('AI_MODEL', selectedModel);
      await this.updateEnvFile('AI_CONVERSATIONAL_ENABLED', 'true');
      console.log(`✅ Modèle configuré: ${selectedModel}`);
    } else {
      console.log('❌ Choix invalide');
    }
  }

  /**
   * Configure les paramètres avancés
   */
  async configureAdvanced() {
    console.log('\n⚙️ CONFIGURATION AVANCÉE');
    console.log('-'.repeat(30));

    // Longueur des réponses
    const maxLength = await this.askQuestion('Longueur max des réponses (50-500, défaut: 200): ');
    if (maxLength && !isNaN(maxLength)) {
      await this.updateEnvFile('AI_MAX_LENGTH', maxLength);
    }

    // Température
    const temperature = await this.askQuestion('Créativité (0.0-1.0, défaut: 0.8): ');
    if (temperature && !isNaN(temperature)) {
      await this.updateEnvFile('AI_TEMPERATURE', temperature);
    }

    // Seuil de confiance
    const confidence = await this.askQuestion('Seuil de confiance (0.0-1.0, défaut: 0.3): ');
    if (confidence && !isNaN(confidence)) {
      await this.updateEnvFile('AI_CONFIDENCE_THRESHOLD', confidence);
    }

    console.log('✅ Paramètres avancés configurés !');
  }

  /**
   * Teste les modèles
   */
  async testModels() {
    console.log('\n🧪 TEST DES MODÈLES');
    console.log('-'.repeat(20));
    console.log('Lancement des tests... (cela peut prendre quelques minutes)');
    
    try {
      const { spawn } = require('child_process');
      const testProcess = spawn('node', ['scripts/test-ai-models.js'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      testProcess.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ Tests terminés avec succès !');
        } else {
          console.log('\n❌ Erreur lors des tests');
        }
      });
    } catch (error) {
      console.log('❌ Erreur lors du lancement des tests:', error.message);
    }
  }

  /**
   * Affiche la configuration actuelle
   */
  async showCurrentConfig() {
    console.log('\n📋 CONFIGURATION ACTUELLE');
    console.log('-'.repeat(30));

    const envFile = path.join(process.cwd(), '.env');
    if (fs.existsSync(envFile)) {
      const envContent = fs.readFileSync(envFile, 'utf8');
      const lines = envContent.split('\n');
      
      const aiConfig = lines.filter(line => 
        line.startsWith('AI_') || line.startsWith('HUGGINGFACE_')
      );

      if (aiConfig.length > 0) {
        aiConfig.forEach(line => {
          if (line.trim()) {
            const [key, value] = line.split('=');
            if (key && value) {
              const displayValue = key.includes('KEY') ? '***' + value.slice(-4) : value;
              console.log(`${key}: ${displayValue}`);
            }
          }
        });
      } else {
        console.log('Aucune configuration IA trouvée');
      }
    } else {
      console.log('Fichier .env non trouvé');
    }
  }

  /**
   * Démarre le bot
   */
  async startBot() {
    console.log('\n🚀 DÉMARRAGE DU BOT');
    console.log('-'.repeat(20));
    console.log('Lancement du bot avec l\'IA configurée...');
    
    try {
      const { spawn } = require('child_process');
      const botProcess = spawn('node', ['server.js'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      botProcess.on('close', (code) => {
        console.log(`\nBot arrêté avec le code: ${code}`);
      });
    } catch (error) {
      console.log('❌ Erreur lors du démarrage du bot:', error.message);
    }
  }

  /**
   * Met à jour le fichier .env
   */
  async updateEnvFile(key, value) {
    const envFile = path.join(process.cwd(), '.env');
    let envContent = '';

    if (fs.existsSync(envFile)) {
      envContent = fs.readFileSync(envFile, 'utf8');
    }

    // Chercher si la clé existe déjà
    const lines = envContent.split('\n');
    let keyExists = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(key + '=')) {
        lines[i] = `${key}=${value}`;
        keyExists = true;
        break;
      }
    }

    if (!keyExists) {
      lines.push(`${key}=${value}`);
    }

    fs.writeFileSync(envFile, lines.join('\n'));
  }

  /**
   * Lance le menu principal
   */
  async run() {
    while (true) {
      this.displayMenu();
      const choice = await this.askQuestion('\nVotre choix: ');

      switch (choice) {
        case '1':
          await this.configureAPIKey();
          break;
        case '2':
          await this.chooseModel();
          break;
        case '3':
          await this.configureAdvanced();
          break;
        case '4':
          await this.testModels();
          break;
        case '5':
          await this.showCurrentConfig();
          break;
        case '6':
          await this.startBot();
          break;
        case '0':
          console.log('\n👋 Au revoir !');
          this.rl.close();
          process.exit(0);
        default:
          console.log('\n❌ Choix invalide');
      }

      await this.askQuestion('\nAppuyez sur Entrée pour continuer...');
    }
  }
}

// Exécuter le script
if (require.main === module) {
  const setup = new AISetup();
  setup.run().catch(console.error);
}

module.exports = AISetup;
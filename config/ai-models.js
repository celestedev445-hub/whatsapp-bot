/**
 * Configuration des modèles IA disponibles
 * Chaque modèle a ses propres paramètres optimaux
 */

const AI_MODELS = {
  // Modèles de conversation recommandés
  conversation: {
    // Microsoft DialoGPT - Très bon pour les conversations
    'microsoft/DialoGPT-small': {
      name: 'DialoGPT Small',
      description: 'Modèle léger et rapide pour les conversations simples',
      maxTokens: 150,
      temperature: 0.8,
      topP: 0.9,
      repetitionPenalty: 1.1,
      pros: ['Rapide', 'Léger', 'Bon pour conversations courtes'],
      cons: ['Réponses parfois répétitives', 'Vocabulaire limité']
    },
    
    'microsoft/DialoGPT-medium': {
      name: 'DialoGPT Medium',
      description: 'Modèle équilibré, bon compromis performance/ressources',
      maxTokens: 200,
      temperature: 0.8,
      topP: 0.9,
      repetitionPenalty: 1.1,
      pros: ['Équilibré', 'Bonnes réponses', 'Ressources modérées'],
      cons: ['Peut être lent sur serveurs faibles']
    },
    
    'microsoft/DialoGPT-large': {
      name: 'DialoGPT Large',
      description: 'Modèle le plus intelligent, réponses de qualité supérieure',
      maxTokens: 250,
      temperature: 0.8,
      topP: 0.9,
      repetitionPenalty: 1.1,
      pros: ['Très intelligent', 'Réponses cohérentes', 'Vocabulaire riche'],
      cons: ['Gourmand en ressources', 'Plus lent']
    },

    // Facebook BlenderBot - Excellent pour les conversations
    'facebook/blenderbot-400M-distill': {
      name: 'BlenderBot 400M',
      description: 'Modèle conversationnel très performant',
      maxTokens: 200,
      temperature: 0.7,
      topP: 0.9,
      repetitionPenalty: 1.2,
      pros: ['Très bon pour conversations', 'Cohérent', 'Bien entraîné'],
      cons: ['Plus gros que DialoGPT', 'Peut être lent']
    },

    'facebook/blenderbot-1B-distill': {
      name: 'BlenderBot 1B',
      description: 'Version plus grande et plus intelligente',
      maxTokens: 250,
      temperature: 0.7,
      topP: 0.9,
      repetitionPenalty: 1.2,
      pros: ['Très intelligent', 'Réponses de qualité', 'Cohérent'],
      cons: ['Très gourmand', 'Lent sur serveurs faibles']
    },

    // Modèles français spécialisés
    'dbmdz/gpt2-french': {
      name: 'GPT-2 French',
      description: 'GPT-2 spécialement entraîné en français',
      maxTokens: 200,
      temperature: 0.8,
      topP: 0.9,
      repetitionPenalty: 1.1,
      pros: ['Spécialisé français', 'Bon vocabulaire', 'Cohérent'],
      cons: ['Peut être répétitif', 'Moins conversationnel']
    }
  },

  // Modèles de classification (pour l'analyse des messages)
  classification: {
    'camembert-base': {
      name: 'CamemBERT Base',
      description: 'Modèle français pour classification de texte',
      pros: ['Spécialisé français', 'Bon pour classification'],
      cons: ['Pas pour génération']
    },
    
    'cardiffnlp/twitter-roberta-base-sentiment-latest': {
      name: 'RoBERTa Sentiment',
      description: 'Analyse de sentiment',
      pros: ['Excellent pour sentiment', 'Bien entraîné'],
      cons: ['Anglais principalement']
    }
  }
};

/**
 * Obtient la configuration d'un modèle
 */
function getModelConfig(modelName) {
  // Chercher dans les modèles de conversation
  for (const category in AI_MODELS) {
    if (AI_MODELS[category][modelName]) {
      return AI_MODELS[category][modelName];
    }
  }
  return null;
}

/**
 * Obtient tous les modèles de conversation disponibles
 */
function getAvailableConversationModels() {
  return Object.keys(AI_MODELS.conversation).map(modelId => ({
    id: modelId,
    ...AI_MODELS.conversation[modelId]
  }));
}

/**
 * Recommande un modèle selon les ressources disponibles
 */
function recommendModel(resources = 'medium') {
  const recommendations = {
    low: 'microsoft/DialoGPT-small',
    medium: 'microsoft/DialoGPT-medium',
    high: 'microsoft/DialoGPT-large',
    very_high: 'facebook/blenderbot-1B-distill'
  };
  
  return recommendations[resources] || recommendations.medium;
}

module.exports = {
  AI_MODELS,
  getModelConfig,
  getAvailableConversationModels,
  recommendModel
};

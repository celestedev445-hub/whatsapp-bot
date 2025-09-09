# 🤖 Guide de Configuration de l'IA pour le Bot WhatsApp

Ce guide vous explique comment configurer et utiliser des modèles IA plus intelligents pour votre bot WhatsApp.

## 🚀 Démarrage Rapide

### 1. Configuration Automatique
```bash
node scripts/setup-ai.js
```

### 2. Configuration Manuelle
Copiez le fichier de configuration :
```bash
cp config.env.ai .env
```

Puis éditez le fichier `.env` avec vos paramètres.

## 🔑 Obtenir une Clé API Hugging Face

1. Allez sur [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Créez un nouveau token avec les permissions "Read"
3. Copiez le token et ajoutez-le dans votre `.env` :
   ```
   HUGGINGFACE_API_KEY=votre_cle_ici
   ```

## 🧠 Modèles Recommandés

### Pour des Ressources Faibles
- **microsoft/DialoGPT-small** : Rapide et léger
- **dbmdz/gpt2-french** : Spécialisé français

### Pour des Ressources Moyennes ⭐ RECOMMANDÉ
- **microsoft/DialoGPT-medium** : Bon équilibre performance/ressources

### Pour des Ressources Élevées
- **microsoft/DialoGPT-large** : Très intelligent
- **facebook/blenderbot-400M-distill** : Excellent pour conversations

### Pour des Ressources Très Élevées
- **facebook/blenderbot-1B-distill** : Le plus intelligent

## ⚙️ Configuration Avancée

### Variables d'Environnement Principales

```env
# Activation de l'IA conversationnelle
AI_CONVERSATIONAL_ENABLED=true

# Fournisseur (huggingface, openai, local)
AI_PROVIDER=huggingface

# Modèle à utiliser
AI_MODEL=microsoft/DialoGPT-medium

# Longueur des réponses (tokens)
AI_MAX_LENGTH=200

# Créativité (0.0 = prévisible, 1.0 = créatif)
AI_TEMPERATURE=0.8

# Seuil de confiance pour traiter les messages
AI_CONFIDENCE_THRESHOLD=0.3
```

### Paramètres de Qualité

```env
# Top-p pour la diversité des réponses
AI_TOP_P=0.9

# Pénalité de répétition
AI_REPETITION_PENALTY=1.1

# Langue par défaut
AI_LANGUAGE=fr
```

## 🧪 Tester les Modèles

### Test de Tous les Modèles
```bash
node scripts/test-ai-models.js
```

### Test d'un Modèle Spécifique
```bash
node scripts/test-ai-models.js microsoft/DialoGPT-medium
```

## 📊 Comparaison des Modèles

| Modèle | Vitesse | Intelligence | Ressources | Français |
|--------|---------|--------------|------------|----------|
| DialoGPT-small | ⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐ |
| DialoGPT-medium | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| DialoGPT-large | ⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| BlenderBot-400M | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| BlenderBot-1B | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| GPT-2-French | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |

## 🔧 Dépannage

### Problème : "Clé API manquante"
- Vérifiez que `HUGGINGFACE_API_KEY` est définie dans `.env`
- Assurez-vous que la clé est valide

### Problème : "Modèle non trouvé"
- Vérifiez que le nom du modèle est correct
- Certains modèles peuvent être privés ou supprimés

### Problème : "Réponses de mauvaise qualité"
- Ajustez `AI_TEMPERATURE` (0.7-0.9)
- Augmentez `AI_MAX_LENGTH` (150-300)
- Changez de modèle

### Problème : "Réponses trop lentes"
- Utilisez un modèle plus petit (DialoGPT-small)
- Réduisez `AI_MAX_LENGTH`
- Vérifiez votre connexion internet

## 🎯 Optimisation des Performances

### Pour de Meilleures Réponses
1. Utilisez un modèle plus grand (DialoGPT-large ou BlenderBot)
2. Ajustez la température (0.8-0.9)
3. Augmentez la longueur max (200-300)

### Pour de Meilleures Vitesses
1. Utilisez un modèle plus petit (DialoGPT-small)
2. Réduisez la longueur max (100-150)
3. Baissez la température (0.6-0.7)

## 🔄 Fallback et Robustesse

Le bot est conçu pour fonctionner même si l'IA échoue :

- **Système de fallback** : Si l'IA échoue, le bot utilise le système classique
- **Fonctionnalités de base** : Présences, permissions, commandes admin
- **Mode dégradé** : Messages d'information si l'IA n'est pas disponible

## 📈 Monitoring et Logs

### Activer les Logs Détaillés
```env
AI_DEBUG_LOGS=true
AI_SAVE_RESPONSES=true
```

### Vérifier les Performances
- Consultez les logs du serveur
- Utilisez l'interface web pour voir les statistiques IA
- Surveillez les temps de réponse

## 🆘 Support

### Logs Utiles
- `🤖 Appel Hugging Face avec le modèle: ...`
- `✅ Réponse générée: ...`
- `❌ Erreur Hugging Face: ...`

### Commandes de Debug
```bash
# Voir la configuration actuelle
node scripts/setup-ai.js

# Tester un modèle spécifique
node scripts/test-ai-models.js microsoft/DialoGPT-medium

# Démarrer avec logs détaillés
DEBUG=ai* node server.js
```

## 🎉 Félicitations !

Votre bot WhatsApp est maintenant équipé d'une IA conversationnelle intelligente ! 

Les utilisateurs peuvent maintenant :
- Avoir des conversations naturelles avec le bot
- Obtenir des réponses contextuelles et intelligentes
- Bénéficier de toutes les fonctionnalités de base (présences, permissions)
- Profiter d'un système robuste avec fallback automatique

---

*Pour plus d'informations, consultez la documentation des modèles sur [Hugging Face](https://huggingface.co/models)*

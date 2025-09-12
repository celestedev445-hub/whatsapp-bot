# 🔐 Système d'Authentification - Promillys Bot

## 📋 **Vue d'ensemble**

Le système d'authentification a été implémenté pour sécuriser l'accès à l'interface web de Promillys Bot. Seuls les utilisateurs authentifiés peuvent accéder à l'interface et scanner le QR code WhatsApp.

## 🚀 **Fonctionnalités**

### ✅ **Ce qui est protégé :**
- **Toutes les routes API** (`/api/*`) sauf `/api/auth/*`
- **Interface web complète** (dashboard, employés, présences, etc.)
- **QR code WhatsApp** (affiché uniquement après authentification pour Promillys Bot)
- **Données sensibles** (employés, présences, permissions)

### 🔓 **Ce qui reste accessible :**
- **Route de connexion** (`/api/auth/login`)
- **Page de login** (`/login`)
- **Route de santé** (`/health`)

## 🔑 **Identifiants par défaut**

```
Nom d'utilisateur : admin
Mot de passe : admin123
```

⚠️ **IMPORTANT :** Changez ces identifiants en production !

## 🛠️ **Configuration**

### **Variables d'environnement requises :**

```env
# JWT Secret (obligatoire)
JWT_SECRET=votre_secret_jwt_tres_long_et_securise

# Identifiants d'authentification
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### **Installation des dépendances :**

```bash
# Backend
npm install jsonwebtoken

# Frontend (déjà installé)
# Aucune dépendance supplémentaire requise
```

## 🔄 **Flux d'authentification**

### **1. Connexion :**
1. L'utilisateur accède à l'interface web
2. Redirection automatique vers la page de login
3. Saisie des identifiants
4. Génération d'un token JWT (valide 24h)
5. Stockage du token dans localStorage
6. Accès à l'interface complète

### **2. Protection des routes :**
1. Chaque requête API inclut le token dans l'en-tête `Authorization`
2. Le middleware vérifie la validité du token
3. Si valide : accès autorisé
4. Si invalide : redirection vers la page de login

### **3. Déconnexion :**
1. Suppression du token du localStorage
2. Redirection vers la page de login
3. Toutes les requêtes suivantes sont bloquées

## 📱 **Utilisation du QR Code**

### **Avant l'authentification :**
- ❌ QR code non visible
- ❌ Interface inaccessible
- ❌ Données protégées

### **Après l'authentification :**
- ✅ QR code affiché
- ✅ Interface complète accessible
- ✅ Scan du QR code possible
- ✅ Contrôle total du bot

## 🔧 **Architecture technique**

### **Backend :**
- **Middleware d'authentification** (`middleware/auth.js`)
- **Routes d'authentification** (`routes/auth.js`)
- **Protection JWT** sur toutes les routes API
- **Vérification des tokens** à chaque requête

### **Frontend :**
- **Contexte d'authentification** (`contexts/auth-context.tsx`)
- **Composant de protection** (`components/auth-guard.tsx`)
- **Page de connexion** (`components/login-page.tsx`)
- **Intercepteurs Axios** pour l'injection automatique des tokens

## 🚨 **Sécurité**

### **Mesures implémentées :**
- ✅ **Tokens JWT** avec expiration (24h)
- ✅ **Validation côté serveur** de chaque requête
- ✅ **Suppression automatique** des tokens expirés
- ✅ **Redirection forcée** en cas d'échec d'authentification
- ✅ **Protection CSRF** via les tokens

### **Recommandations :**
- 🔒 **Changez les identifiants par défaut** en production
- 🔒 **Utilisez un JWT_SECRET fort** et unique
- 🔒 **Activez HTTPS** en production
- 🔒 **Limitez l'accès par IP** si nécessaire

## 🐛 **Dépannage**

### **Problèmes courants :**

1. **"Token invalide ou expiré"**
   - Solution : Se reconnecter
   - Cause : Token expiré (24h) ou modifié

2. **"Accès non autorisé"**
   - Solution : Vérifier les identifiants
   - Cause : Mauvais nom d'utilisateur/mot de passe

3. **"Erreur de connexion au serveur"**
   - Solution : Vérifier que le backend est démarré
   - Cause : Serveur API inaccessible

### **Logs utiles :**
```bash
# Backend
console.log('🔐 Tentative de connexion:', username);
console.log('✅ Token généré pour:', user.username);
console.log('❌ Token invalide:', error.message);
```

## 📈 **Prochaines améliorations possibles**

- 🔄 **Rafraîchissement automatique** des tokens
- 👥 **Gestion des rôles** (admin/employé)
- 🔐 **Authentification 2FA**
- 📧 **Récupération de mot de passe**
- 🕒 **Sessions multiples** avec gestion des conflits

---

## ✅ **Résumé**

Le système d'authentification est maintenant **pleinement fonctionnel** et **sécurisé**. Seuls les utilisateurs authentifiés peuvent :

1. **Accéder à l'interface web**
2. **Voir le QR code WhatsApp**
3. **Scanner le QR code** pour connecter le bot
4. **Gérer les données** de l'entreprise

**L'objectif est atteint :** Plus personne ne peut scanner le QR code sans être authentifié ! 🎯

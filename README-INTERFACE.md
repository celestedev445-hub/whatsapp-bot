# Interface Web - Bot WhatsApp Entreprise

## 🚀 **Interface Web Moderne**

Votre bot WhatsApp dispose maintenant d'une **interface web complète** construite avec :
- **Next.js 15** - Framework React moderne
- **Tailwind CSS** - Framework CSS utilitaire
- **shadcn/ui** - Composants UI modernes et accessibles
- **TypeScript** - Typage statique pour plus de sécurité

## 📱 **Fonctionnalités de l'Interface**

### **Dashboard Principal**
- 📊 Statistiques en temps réel
- 👥 Nombre d'employés actifs
- ✅ Présences du jour
- ⏳ Permissions en attente
- 📨 Messages traités

### **Gestion des Employés**
- ➕ Ajouter de nouveaux employés
- ✏️ Modifier les informations
- 🗑️ Supprimer des employés
- 👤 Profils détaillés avec avatars

### **Suivi des Présences**
- 📅 Calendrier interactif
- 🔍 Filtres par date et employé
- 📈 Statistiques de présence
- ⏰ Horaires d'arrivée/départ

### **Gestion des Permissions**
- 📋 Liste des demandes
- ✅ Approbation en un clic
- ❌ Rejet avec raison
- 📊 Statistiques par type

### **Rapports**
- 📊 Génération de rapports
- 📅 Quotidien, hebdomadaire, mensuel
- 💾 Export des données
- 📈 Graphiques et tendances

### **Messages WhatsApp**
- 📱 Historique des messages
- 🔍 Recherche et filtres
- 📊 Statistiques de traitement
- 💬 Envoi de messages

### **Paramètres**
- ⚙️ Configuration des horaires
- 🔔 Paramètres de notifications
- 🛡️ Sécurité et permissions
- 📊 Statut du système

## 🚀 **Démarrage de l'Interface**

### **1. Installation des dépendances**
```bash
# Installer toutes les dépendances (backend + frontend)
npm run install:all
```

### **2. Démarrage en mode développement**
```bash
# Démarrer le backend ET le frontend en même temps
npm run dev:full
```

### **3. Accès à l'interface**
- **Backend API** : http://localhost:3000
- **Interface Web** : http://localhost:3001
- **Bot WhatsApp** : Fonctionne en arrière-plan

## 📁 **Structure du Projet**

```
whatsapp-bot/
├── server.js                 # Serveur Express (Backend)
├── config/                   # Configuration base de données
├── services/                 # Services (Bot WhatsApp, Cron)
├── routes/                   # Routes API
├── frontend/                 # Interface Web Next.js
│   ├── src/
│   │   ├── app/             # Pages Next.js
│   │   ├── components/      # Composants React
│   │   └── lib/             # Utilitaires et API
│   └── package.json
└── package.json             # Scripts de gestion
```

## 🎨 **Design et UX**

### **Caractéristiques**
- 🎨 **Design moderne** avec shadcn/ui
- 📱 **Responsive** - Fonctionne sur mobile et desktop
- 🌙 **Mode sombre** disponible
- ♿ **Accessible** - Respect des standards WCAG
- ⚡ **Performant** - Optimisé avec Next.js

### **Navigation**
- 🧭 **Sidebar** avec navigation intuitive
- 🏠 **Dashboard** central avec vue d'ensemble
- 🔍 **Recherche** et filtres avancés
- 📊 **Graphiques** interactifs

## 🔧 **Configuration**

### **Variables d'environnement**
Créez un fichier `.env.local` dans le dossier `frontend/` :
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### **Personnalisation**
- 🎨 **Couleurs** : Modifiez `frontend/src/app/globals.css`
- 📝 **Textes** : Personnalisez les composants
- 🔧 **Fonctionnalités** : Ajoutez de nouvelles pages

## 📊 **API Integration**

L'interface communique avec le backend via des **API REST** :
- `GET /api/admin/dashboard-stats` - Statistiques du dashboard
- `GET /api/employees` - Liste des employés
- `GET /api/attendance` - Données de présence
- `GET /api/permissions` - Permissions
- `POST /api/permissions/:id/approve` - Approuver une permission

## 🚀 **Déploiement**

### **Production**
```bash
# Build de l'interface
npm run build

# Démarrage en production
npm start
```

### **Docker** (optionnel)
```dockerfile
# Dockerfile pour déploiement containerisé
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000 3001
CMD ["npm", "start"]
```

## 🎯 **Prochaines Améliorations**

- 📱 **Application mobile** (React Native)
- 🔔 **Notifications push** en temps réel
- 📊 **Graphiques avancés** avec Chart.js
- 🔐 **Authentification** utilisateur
- 📈 **Analytics** et métriques avancées
- 🌐 **Multi-langues** (i18n)

## 🆘 **Support**

- 📖 **Documentation** : Ce fichier README
- 🐛 **Bugs** : Vérifiez les logs dans la console
- 💡 **Suggestions** : Proposez de nouvelles fonctionnalités

---

**🎉 Votre interface web est maintenant prête ! Profitez de cette expérience utilisateur moderne pour gérer votre bot WhatsApp d'entreprise.**

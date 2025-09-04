# 🤖 Bot WhatsApp Entreprise

Un bot WhatsApp intelligent pour automatiser la gestion de la présence, des permissions et des rapports d'entreprise.

## 🚀 Fonctionnalités

### 📱 Gestion de la Présence
- **Arrivée** : Marquer son arrivée au travail
- **Départ** : Enregistrer son départ
- **Pause déjeuner** : Gérer les pauses
- **Absence** : Déclarer une absence
- **Calcul automatique** des heures travaillées

### 📋 Gestion des Permissions
- **Demande de permission** via message privé
- **Approbation/rejet** par l'administrateur
- **Types de permissions** : congé, maladie, personnel, médical
- **Suivi des demandes** en attente

### 📊 Rapports Automatiques
- **Rapport quotidien** à 18h00
- **Rapport hebdomadaire** le vendredi
- **Notifications de retard** à 8h15
- **Rappels de départ** à 17h30

### 🔧 API REST Complète
- Gestion des employés
- Historique de présence
- Statistiques détaillées
- Export CSV des rapports

## 📋 Prérequis

- Node.js 16+ 
- MySQL 5.7+ (compatible O2Switch)
- WhatsApp Business ou WhatsApp personnel
- Serveur avec accès internet

## 🛠️ Installation

### 1. Cloner le projet
```bash
git clone <votre-repo>
cd whatsapp-bot-entreprise
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configuration de la base de données

Créez une base de données MySQL sur O2Switch :
```sql
CREATE DATABASE whatsapp_bot_entreprise CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Configuration des variables d'environnement

Copiez le fichier de configuration :
```bash
cp config.env.example .env
```

Éditez le fichier `.env` :
```env
# Configuration de la base de données (O2Switch)
DB_HOST=votre-host-o2switch
DB_USER=votre_utilisateur
DB_PASSWORD=votre_mot_de_passe
DB_NAME=whatsapp_bot_entreprise
DB_PORT=3306

# Configuration WhatsApp
WHATSAPP_GROUP_ID=votre_groupe_id
ADMIN_PHONE=votre_numero_whatsapp

# Configuration du serveur
PORT=3000
NODE_ENV=production

# JWT Secret pour l'authentification
JWT_SECRET=votre_secret_jwt_tres_long_et_securise
```

### 5. Démarrage du bot

**Mode développement :**
```bash
npm run dev
```

**Mode production :**
```bash
npm start
```

## 📱 Utilisation du Bot

### Première Connexion

1. Démarrez le bot
2. Scannez le QR Code affiché avec WhatsApp
3. Le bot sera connecté et prêt à fonctionner

### Commandes dans le Groupe WhatsApp

#### Pour les Employés
- **"Bonjour"** ou **"Arrivée"** → Marquer son arrivée
- **"Au revoir"** ou **"Départ"** → Marquer son départ  
- **"Pause"** ou **"Déjeuner"** → Commencer la pause
- **"Retour de pause"** → Finir la pause
- **"Absent"** ou **"Malade"** → Déclarer une absence
- **"Statut"** → Voir sa présence du jour

#### Pour l'Administrateur
- **"Rapport"** → Générer un rapport du jour

### Demandes de Permission (Message Privé)

Envoyez un message privé au bot avec :
```
Permission congé du 15/12/2023 au 20/12/2023 pour vacances familiales
```

Le bot comprend automatiquement :
- Le type de permission (congé, maladie, personnel, médical)
- Les dates de début et fin
- La raison

### Approbation des Permissions

L'administrateur reçoit une notification et peut répondre :
- **"APPROUVER [ID]"** → Approuver la permission
- **"REJETER [ID]"** → Rejeter la permission

## 🔌 API REST

### Endpoints Principaux

#### Employés
- `GET /api/employees` - Liste des employés
- `POST /api/employees` - Créer un employé
- `PUT /api/employees/:id` - Modifier un employé
- `DELETE /api/employees/:id` - Désactiver un employé

#### Présence
- `GET /api/attendance` - Historique de présence
- `GET /api/attendance/today` - Présences du jour
- `GET /api/attendance/statistics` - Statistiques
- `POST /api/attendance` - Enregistrer une présence

#### Permissions
- `GET /api/permissions` - Liste des permissions
- `GET /api/permissions/pending` - Permissions en attente
- `POST /api/permissions` - Créer une permission
- `PUT /api/permissions/:id/approve` - Approuver
- `PUT /api/permissions/:id/reject` - Rejeter

#### Rapports
- `GET /api/reports` - Générer un rapport
- `GET /api/reports/export` - Exporter en CSV
- `GET /api/reports/history` - Historique des rapports

#### Administration
- `GET /api/admin/dashboard` - Tableau de bord
- `GET /api/admin/settings` - Paramètres système
- `PUT /api/admin/settings` - Modifier les paramètres
- `GET /api/admin/system-status` - Statut du système

### Exemples d'Utilisation

#### Récupérer les présences du jour
```bash
curl http://localhost:3000/api/attendance/today
```

#### Générer un rapport mensuel
```bash
curl "http://localhost:3000/api/reports?type=monthly&format=json"
```

#### Exporter un rapport en CSV
```bash
curl "http://localhost:3000/api/reports/export?type=weekly" -o rapport.csv
```

## ⚙️ Configuration

### Paramètres Système

Vous pouvez modifier les paramètres via l'API ou directement en base :

```sql
UPDATE system_settings SET setting_value = '09:00' WHERE setting_key = 'work_start_time';
UPDATE system_settings SET setting_value = '18:00' WHERE setting_key = 'work_end_time';
UPDATE system_settings SET setting_value = '10' WHERE setting_key = 'late_threshold_minutes';
```

### Horaires de Travail

- **Début** : 08:00 (par défaut)
- **Fin** : 17:00 (par défaut)
- **Pause déjeuner** : 12:00 - 13:00
- **Seuil de retard** : 15 minutes

### Tâches Automatiques

- **8h15** : Vérification des retards
- **17h30** : Rappel de départ
- **18h00** : Rapport quotidien
- **Vendredi 17h00** : Rapport hebdomadaire
- **Dimanche 2h00** : Nettoyage des anciens messages

## 🚀 Déploiement

### Sur O2Switch

1. **Upload des fichiers** via FTP/SFTP
2. **Configuration de la base de données** MySQL
3. **Installation des dépendances** :
   ```bash
   npm install --production
   ```
4. **Démarrage avec PM2** :
   ```bash
   npm install -g pm2
   pm2 start server.js --name whatsapp-bot
   pm2 startup
   pm2 save
   ```

### Variables d'Environnement O2Switch

```env
DB_HOST=mysql-[votre-compte].o2switch.net
DB_USER=[votre-utilisateur]
DB_PASSWORD=[votre-mot-de-passe]
DB_NAME=whatsapp_bot_entreprise
DB_PORT=3306
```

## 🔧 Maintenance

### Logs
Les logs sont affichés dans la console. Pour la production, configurez un système de logs :

```bash
pm2 logs whatsapp-bot
```

### Sauvegarde
```bash
# Sauvegarde via API
curl -X POST http://localhost:3000/api/admin/backup

# Sauvegarde MySQL
mysqldump -h host -u user -p whatsapp_bot_entreprise > backup.sql
```

### Mise à Jour
```bash
git pull origin main
npm install
pm2 restart whatsapp-bot
```

## 🐛 Dépannage

### Problèmes Courants

#### Bot ne se connecte pas
- Vérifiez la connexion internet
- Redémarrez le bot
- Scannez à nouveau le QR Code

#### Erreurs de base de données
- Vérifiez les paramètres de connexion
- Testez la connexion MySQL
- Vérifiez les permissions utilisateur

#### Messages non traités
- Vérifiez que le bot est dans le bon groupe
- Vérifiez l'ID du groupe WhatsApp
- Redémarrez le bot

### Logs de Debug

Activez les logs détaillés :
```env
NODE_ENV=development
```

## 📈 Améliorations Futures

- [ ] Interface web d'administration
- [ ] Notifications push
- [ ] Intégration calendrier
- [ ] Géolocalisation
- [ ] Reconnaissance vocale
- [ ] Multi-langues
- [ ] Intégration RH

## 🤝 Contribution

1. Fork le projet
2. Créez une branche feature
3. Committez vos changements
4. Push vers la branche
5. Ouvrez une Pull Request

## 📄 Licence

MIT License - Voir le fichier LICENSE pour plus de détails.

## 📞 Support

Pour toute question ou problème :
- Ouvrez une issue sur GitHub
- Contactez l'équipe de développement

---

**Développé avec ❤️ pour simplifier la gestion d'entreprise**

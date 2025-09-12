# 👥 Gestion des Utilisateurs - Promillys Bot

## 📋 **Vue d'ensemble**

Le système de gestion des utilisateurs permet de créer et gérer plusieurs comptes d'accès à l'interface Promillys Bot. Les utilisateurs sont stockés dans une base de données MySQL avec des mots de passe hachés de manière sécurisée.

## 🗄️ **Stockage des accès**

### **Base de données :**
- **Table :** `users`
- **Mots de passe :** Hachés avec bcrypt (salt rounds: 10)
- **Sécurité :** Aucun mot de passe en clair dans la base

### **Structure de la table :**
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    full_name VARCHAR(100),
    role ENUM('admin', 'manager', 'user') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 🔐 **Rôles disponibles**

### **1. Admin (`admin`)**
- ✅ **Accès complet** à toutes les fonctionnalités
- ✅ **Gestion des utilisateurs** (via scripts)
- ✅ **Configuration système**
- ✅ **Scan du QR code** WhatsApp
- ✅ **Toutes les données** (employés, présences, permissions)

### **2. Manager (`manager`)**
- ✅ **Gestion des employés** (CRUD)
- ✅ **Gestion des présences** (lecture/écriture)
- ✅ **Gestion des permissions** (approbation/rejet)
- ✅ **Rapports** (génération et consultation)
- ❌ **Pas d'accès** à la configuration système
- ❌ **Pas de scan** du QR code

### **3. User (`user`)**
- ✅ **Lecture seule** des données
- ✅ **Consultation** des présences
- ✅ **Consultation** des rapports
- ❌ **Pas de modification** des données
- ❌ **Pas de scan** du QR code

## 🚀 **Utilisation**

### **1. Créer l'utilisateur admin (première fois) :**
```bash
node scripts/create-admin-user.js
```

### **2. Lister tous les utilisateurs :**
```bash
node scripts/manage-users.js list
```

### **3. Créer un nouvel utilisateur :**
```bash
node scripts/manage-users.js create nom_utilisateur
```

### **4. Afficher l'aide :**
```bash
node scripts/manage-users.js help
```

## 📝 **Exemple de création d'utilisateur**

```bash
$ node scripts/manage-users.js create marie

👤 Création de l'utilisateur: marie
Mot de passe: ********
Email (optionnel): marie@promillys.com
Nom complet (optionnel): Marie Dupont

Rôles disponibles:
1. admin - Accès complet
2. manager - Gestion des employés et présences
3. user - Lecture seule

Choisir le rôle (1-3, défaut: 3): 2

✅ Utilisateur marie créé avec succès
📋 Informations :
   - Nom d'utilisateur : marie
   - Email : marie@promillys.com
   - Nom complet : Marie Dupont
   - Rôle : manager
```

## 🔧 **Configuration**

### **Variables d'environnement requises :**
```env
# Base de données
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=votre_mot_de_passe
DB_NAME=whatsapp_bot_entreprise

# JWT Secret
JWT_SECRET=votre_secret_jwt_tres_long_et_securise
```

### **Dépendances installées :**
```bash
npm install bcrypt
```

## 🛡️ **Sécurité**

### **Mots de passe :**
- ✅ **Hachage bcrypt** avec salt rounds = 10
- ✅ **Aucun mot de passe** en clair dans la base
- ✅ **Vérification** côté serveur uniquement

### **Tokens JWT :**
- ✅ **Expiration** : 24 heures
- ✅ **Signature** avec secret JWT
- ✅ **Informations utilisateur** incluses

### **Base de données :**
- ✅ **Contraintes d'unicité** sur le nom d'utilisateur
- ✅ **Index** pour les performances
- ✅ **Soft delete** avec `is_active`

## 📊 **Utilisateurs par défaut**

### **Admin initial :**
- **Nom d'utilisateur :** `admin`
- **Mot de passe :** `admin123`
- **Email :** `admin@promillys.com`
- **Rôle :** `admin`

⚠️ **IMPORTANT :** Changez le mot de passe admin en production !

## 🔄 **Workflow d'authentification**

1. **Utilisateur saisit** nom d'utilisateur + mot de passe
2. **Serveur recherche** l'utilisateur dans la base de données
3. **Vérification** du mot de passe avec bcrypt
4. **Génération** d'un token JWT
5. **Mise à jour** de la dernière connexion
6. **Retour** du token + informations utilisateur

## 🐛 **Dépannage**

### **Problèmes courants :**

1. **"Table users doesn't exist"**
   ```bash
   # Solution : Exécuter le script de création
   node scripts/create-admin-user.js
   ```

2. **"Mot de passe incorrect"**
   - Vérifier le nom d'utilisateur
   - Vérifier le mot de passe
   - Vérifier que l'utilisateur est actif

3. **"Token invalide"**
   - Se reconnecter
   - Vérifier la configuration JWT_SECRET

### **Logs utiles :**
```bash
# Vérifier les utilisateurs
node scripts/manage-users.js list

# Vérifier la base de données
mysql -u root -p -e "SELECT * FROM users;"
```

## 📈 **Prochaines améliorations**

- 🔄 **Interface web** pour la gestion des utilisateurs
- 🔐 **Réinitialisation** de mot de passe par email
- 👥 **Gestion des groupes** d'utilisateurs
- 📊 **Audit trail** des connexions
- 🔒 **Authentification 2FA**

---

## ✅ **Résumé**

Le système de gestion des utilisateurs est maintenant **pleinement fonctionnel** :

1. ✅ **Base de données** sécurisée avec mots de passe hachés
2. ✅ **Scripts de gestion** pour créer/lister les utilisateurs
3. ✅ **Rôles multiples** (admin, manager, user)
4. ✅ **Authentification JWT** avec informations utilisateur
5. ✅ **Sécurité renforcée** - plus de mots de passe en dur

**Vous pouvez maintenant créer autant d'utilisateurs que nécessaire !** 🎉

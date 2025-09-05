# Gestion des Départements

## Fonctionnalités

### ✅ Gestion des départements
- **Créer** un nouveau département
- **Modifier** les informations d'un département
- **Supprimer** un département (si aucun employé n'y est assigné)
- **Rechercher** dans la liste des départements

### ✅ Gestion des employés par département
- **Assigner** un employé à un département
- **Retirer** un employé d'un département
- **Voir** la liste des employés par département
- **Compter** le nombre d'employés par département

## Interface utilisateur

### Page des départements (`/departments`)
- **Liste des départements** (panneau de gauche)
  - Nom du département
  - Nombre d'employés
  - Actions (modifier/supprimer)
- **Détails du département** (panneau de droite)
  - Informations du département
  - Liste des employés assignés
  - Bouton pour assigner de nouveaux employés

### Actions disponibles
1. **Créer un département**
   - Nom (obligatoire)
   - Description (optionnelle)

2. **Modifier un département**
   - Changer le nom
   - Modifier la description

3. **Assigner un employé**
   - Sélectionner un employé disponible
   - L'assigner au département sélectionné

4. **Retirer un employé**
   - Bouton de suppression sur chaque employé
   - Retire l'employé du département

## Base de données

### Table `departments`
```sql
CREATE TABLE departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Table `employees` (modifiée)
- Ajout de la colonne `department_id INT`
- Clé étrangère vers `departments(id)`

## API Endpoints

### Départements
- `GET /api/departments` - Liste tous les départements
- `GET /api/departments/:id` - Récupère un département
- `POST /api/departments` - Crée un département
- `PUT /api/departments/:id` - Met à jour un département
- `DELETE /api/departments/:id` - Supprime un département

### Employés par département
- `GET /api/departments/:id/employees` - Employés d'un département
- `GET /api/employees/all` - Tous les employés (pour assignations)
- `PUT /api/employees/:id/department` - Assigner un employé
- `DELETE /api/employees/:id/department` - Retirer un employé

## Départements par défaut

L'application crée automatiquement ces départements :
- Direction
- Ressources Humaines
- Informatique
- Comptabilité
- Commercial
- Production
- Marketing

## Utilisation

1. **Accéder à la page** : Cliquer sur "Départements" dans la sidebar
2. **Créer un département** : Bouton "Nouveau département"
3. **Assigner des employés** : Sélectionner un département puis "Assigner un employé"
4. **Gérer les assignations** : Utiliser les boutons d'action sur chaque employé

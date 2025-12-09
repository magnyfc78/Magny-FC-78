# ⚽ Magny FC 78 - Site Officiel

Site web moderne et sécurisé pour le Magny Football Club 78, construit avec Node.js, Express et MySQL.

## 🛡️ Sécurité

Ce projet implémente les meilleures pratiques de sécurité :

| Protection | Package | Description |
|------------|---------|-------------|
| Headers HTTP | `helmet` | CSP, X-Frame-Options, etc. |
| CORS | `cors` | Contrôle des origines |
| Rate Limiting | `express-rate-limit` | Anti-DDoS/Brute force |
| XSS | `xss-clean` | Nettoyage des entrées |
| HPP | `hpp` | Paramètres HTTP |
| SQL Injection | `mysql2` | Requêtes préparées |
| Authentification | `bcrypt` + `JWT` | Hashage + Tokens |
| Validation | `joi` | Validation des données |

## 🚀 Installation

### Prérequis
- Node.js 18+
- MySQL 5.7+
- npm ou yarn

### 1. Cloner et installer
```bash
git clone https://github.com/votre-repo/magny-fc-78.git
cd magny-fc-78
npm install
```

### 2. Configurer l'environnement
```bash
cp .env.example .env
# Éditer .env avec vos paramètres
```

### 3. Créer la base de données
```bash
mysql -u root -p < database/magny_fc_78.sql
```

### 4. Générer les clés secrètes
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copier dans JWT_SECRET et REFRESH_TOKEN_SECRET
```

### 5. Lancer le serveur
```bash
# Développement
npm run dev

# Production
npm start
```

Le site sera accessible sur `http://localhost:3000`

## 📁 Structure

```
├── server/
│   ├── app.js              # Config Express + sécurité
│   ├── server.js           # Point d'entrée
│   ├── config/
│   │   └── database.js     # Connexion MySQL
│   ├── middleware/
│   │   ├── auth.js         # JWT
│   │   ├── validator.js    # Validation Joi
│   │   └── errorHandler.js # Gestion erreurs
│   ├── routes/             # API REST
│   └── utils/
│       └── logger.js       # Winston
├── public/                 # Frontend
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── api.js          # Client API
│       ├── router.js       # SPA Router
│       └── app.js          # Application
└── .env                    # Configuration
```

## 🔌 API REST

### Authentification
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/auth/me` | Utilisateur courant |

### Équipes
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/equipes` | Liste |
| GET | `/api/equipes/:id` | Détail |
| POST | `/api/equipes` | Créer (admin) |
| PUT | `/api/equipes/:id` | Modifier (admin) |
| DELETE | `/api/equipes/:id` | Supprimer (admin) |

### Matchs & Actualités
Mêmes endpoints CRUD disponibles.

## 👤 Compte Admin

- **Email**: admin@magnyfc78.fr
- **Password**: Admin123!

⚠️ **Changez ce mot de passe en production !**

## 🔧 Scripts

```bash
npm run dev      # Développement avec nodemon
npm start        # Production
npm test         # Tests
npm run lint     # ESLint
```

## 📜 Licence

MIT © Magny FC 78

# Configuration du Scraper FFF - Magny FC 78

Ce document explique comment configurer et utiliser le système de scraping automatique des données depuis le site du District des Yvelines de Football (DYF78).

## Source des données

- **URL**: https://dyf78.fff.fr/recherche-clubs?subtab=agenda&tab=resultats&scl=25702
- **Club ID**: 25702 (Magny 78 F.C.)

## Données récupérées

Le scraper récupère 4 types de données (comme sur le site dyf78.fff.fr):

1. **Résultats** - Matchs terminés avec scores
2. **Agenda** - Matchs à venir
3. **Classement** - Classements des compétitions
4. **Calendrier** - Vue complète de la saison

## Prérequis

1. Node.js 18+ installé
2. MySQL avec la base de données `magny_fc_78`
3. Chromium/Chrome pour Puppeteer

## Installation

### 1. Installer les dépendances

```bash
cd /home/user/Magny-FC-78
npm install
```

### 2. Appliquer la migration de base de données

```bash
mysql -u root -p magny_fc_78 < database/migrations/add_fff_integration.sql
```

### 3. Installer Chromium pour Puppeteer (si nécessaire)

```bash
# Sur Ubuntu/Debian
sudo apt-get install -y chromium-browser

# Ou laisser Puppeteer télécharger Chromium automatiquement
npx puppeteer browsers install chrome
```

## Utilisation

### Exécution manuelle

```bash
# Mode normal (écriture en base)
npm run scrape:fff

# Mode test (dry-run, pas d'écriture)
npm run scrape:fff:dry

# Mode verbeux
node server/scripts/scrape-fff.js --verbose
```

### Via l'API (admin requis)

```bash
# Lancer le scraping
curl -X POST http://localhost:3000/api/matchs/scraping/run \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false}'

# Vérifier le statut
curl http://localhost:3000/api/matchs/scraping/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Configuration du Cron Job

### Option 1: Crontab système (Recommandé)

Ajoutez cette ligne à votre crontab (`crontab -e`):

```cron
# Scraping FFF tous les jours à 6h00
0 6 * * * cd /home/user/Magny-FC-78 && /usr/bin/node server/scripts/scrape-fff.js >> logs/scraping.log 2>&1
```

### Option 2: Planificateur Node.js intégré

Lancez le planificateur en arrière-plan:

```bash
# Avec nohup
nohup node server/scripts/cron-scheduler.js > logs/cron.log 2>&1 &

# Ou avec pm2
pm2 start server/scripts/cron-scheduler.js --name "fff-scraper-cron"
```

### Option 3: Service systemd

Créez le fichier `/etc/systemd/system/magny-scraper.service`:

```ini
[Unit]
Description=Magny FC 78 FFF Scraper Scheduler
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/user/Magny-FC-78
ExecStart=/usr/bin/node server/scripts/cron-scheduler.js
Restart=always
RestartSec=10
StandardOutput=append:/home/user/Magny-FC-78/logs/cron.log
StandardError=append:/home/user/Magny-FC-78/logs/cron-error.log
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Activez le service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable magny-scraper
sudo systemctl start magny-scraper
```

## Structure des données

### Colonnes ajoutées à la table `matchs`

| Colonne | Type | Description |
|---------|------|-------------|
| `fff_id` | VARCHAR(100) | ID unique du match FFF |
| `fff_competition_id` | VARCHAR(50) | ID de la compétition |
| `fff_url` | VARCHAR(500) | URL du match sur le site FFF |
| `fff_home_team` | VARCHAR(150) | Nom équipe domicile FFF |
| `fff_away_team` | VARCHAR(150) | Nom équipe extérieur FFF |
| `fff_home_logo` | VARCHAR(500) | URL logo équipe domicile |
| `fff_away_logo` | VARCHAR(500) | URL logo équipe extérieur |
| `fff_venue` | VARCHAR(255) | Lieu du match depuis FFF |
| `fff_synced_at` | DATETIME | Dernière synchronisation |

### Colonne ajoutée à la table `equipes`

| Colonne | Type | Description |
|---------|------|-------------|
| `fff_team_id` | VARCHAR(50) | ID équipe FFF pour le mapping |
| `fff_team_url` | VARCHAR(500) | URL équipe sur le site FFF |

### Table de logs `fff_scraping_logs`

Stocke l'historique des exécutions du scraper:

- `started_at` / `finished_at` : Timestamps
- `status` : running, success, error
- `teams_found` / `matches_found` : Compteurs
- `matches_inserted` / `matches_updated` : Statistiques
- `error_message` : Message d'erreur si échec
- `execution_time_ms` : Durée d'exécution

## API Endpoints

### GET /api/matchs

Liste les matchs avec filtres avancés:

| Paramètre | Description | Exemple |
|-----------|-------------|---------|
| `status` | Statut du match | `upcoming`, `finished`, `live` |
| `team` | Nom de l'équipe | `seniors`, `u19`, `u17` |
| `equipe_id` | ID numérique de l'équipe | `1` |
| `from_date` | Date minimum | `2024-01-01` |
| `to_date` | Date maximum | `2024-12-31` |
| `competition` | Filtre compétition | `R3`, `Coupe` |
| `fff_only` | Matchs FFF uniquement | `true` |
| `limit` | Nombre de résultats | `20` (max 100) |
| `page` | Page de résultats | `1` |
| `sort` | Ordre de tri | `date_asc`, `date_desc` |

Exemples:

```bash
# Tous les matchs à venir
GET /api/matchs?status=upcoming

# Matchs des seniors
GET /api/matchs?team=seniors

# Matchs terminés des U19
GET /api/matchs?team=u19&status=finished

# Matchs de janvier 2024
GET /api/matchs?from_date=2024-01-01&to_date=2024-01-31
```

### GET /api/matchs/scraping/status (Admin)

Retourne le statut du scraping et les statistiques.

### POST /api/matchs/scraping/run (Admin)

Lance le scraping manuellement.

```json
{
  "dry_run": true  // Mode test sans écriture
}
```

## Logs

Les logs sont stockés dans le dossier `/logs/`:

- `scraping.log` : Logs du scraper FFF
- `cron.log` : Logs du planificateur
- `error.log` : Erreurs générales
- `combined.log` : Tous les logs

## Dépannage

### Le scraping échoue avec erreur 403

Le site FFF bloque les requêtes automatisées. Le scraper utilise Puppeteer avec des headers de navigateur pour contourner cette protection. Si le problème persiste:

1. Vérifiez que Chromium est installé
2. Essayez d'augmenter les délais dans le script
3. Vérifiez les logs pour plus de détails

### Le scraping ne trouve pas de matchs

1. Vérifiez l'URL du club FFF: `https://epreuves.fff.fr/competition/club/548767-magny-78-f-c/club`
2. Exécutez en mode verbeux pour voir le HTML capturé
3. Le site FFF peut avoir changé sa structure

### Problème de connexion à la base de données

1. Vérifiez les variables d'environnement dans `.env`
2. Testez la connexion: `mysql -u $DB_USER -p $DB_NAME`
3. Vérifiez que la migration a été appliquée

## Mapping des équipes

Le scraper essaie automatiquement de mapper les équipes FFF aux équipes locales. Pour un mapping manuel, définissez `fff_team_id` dans la table `equipes`:

```sql
UPDATE equipes SET fff_team_id = 'FFF_TEAM_ID' WHERE slug = 'seniors-1';
```

Récupérez les IDs FFF depuis les URLs des équipes sur le site FFF.

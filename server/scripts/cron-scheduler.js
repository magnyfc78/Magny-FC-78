#!/usr/bin/env node
/**
 * Planificateur de tâches cron pour Magny FC 78
 * Gère les tâches planifiées comme le scraping FFF
 *
 * La configuration est lue depuis la base de données (table scraper_config)
 *
 * Usage:
 *   node server/scripts/cron-scheduler.js          # Démarrer le scheduler
 *   node server/scripts/cron-scheduler.js --once   # Exécuter une seule fois et quitter
 *
 * Ce script peut être:
 *   1. Lancé au démarrage du serveur (via server.js)
 *   2. Lancé comme service systemd séparé
 *   3. Appelé via crontab système
 */

const path = require('path');
const fs = require('fs');

// Configuration des chemins
const ROOT_DIR = path.join(__dirname, '../..');
const LOG_DIR = path.join(ROOT_DIR, 'logs');

// Charger les variables d'environnement
require('dotenv-flow').config({ path: ROOT_DIR });

const cron = require('node-cron');
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');

// Configuration par défaut (utilisée si la BDD n'est pas accessible)
const DEFAULT_CONFIG = {
  enabled: 'true',
  days: '0,1,6',      // Dimanche, Lundi, Samedi
  hours: '0,12',      // Minuit et Midi
  timeout: '300000',  // 5 minutes
  retries: '2'
};

// Pool de connexion MySQL
let dbPool = null;

// Logger
const logger = {
  logFile: path.join(LOG_DIR, 'cron.log'),

  _formatDate() {
    return new Date().toISOString().replace('T', ' ').split('.')[0];
  },

  _write(level, message) {
    const line = `${this._formatDate()} [CRON] [${level}] ${message}`;
    console.log(line);

    try {
      if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
      }
      fs.appendFileSync(this.logFile, line + '\n');
    } catch (err) {
      console.error('Erreur écriture log:', err.message);
    }
  },

  info(message) { this._write('INFO', message); },
  error(message) { this._write('ERROR', message); },
  warn(message) { this._write('WARN', message); },
  success(message) { this._write('SUCCESS', message); }
};

// Initialiser la connexion à la base de données
async function initDatabase() {
  try {
    dbPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'magny_fc_78',
      waitForConnections: true,
      connectionLimit: 2
    });

    // Test de connexion
    await dbPool.execute('SELECT 1');
    logger.info('Connexion à la base de données établie');
    return true;
  } catch (error) {
    logger.error(`Erreur connexion BDD: ${error.message}`);
    return false;
  }
}

// Lire la configuration depuis la base de données
async function getConfigFromDB() {
  try {
    if (!dbPool) {
      return DEFAULT_CONFIG;
    }

    const [rows] = await dbPool.execute('SELECT cle, valeur FROM scraper_config');
    const config = { ...DEFAULT_CONFIG };

    rows.forEach(row => {
      config[row.cle] = row.valeur;
    });

    return config;
  } catch (error) {
    logger.warn(`Impossible de lire la config depuis la BDD: ${error.message}`);
    return DEFAULT_CONFIG;
  }
}

// Mettre à jour le statut dans la base de données
async function updateStatus(status) {
  try {
    if (!dbPool) return;

    await dbPool.execute(
      'INSERT INTO scraper_config (cle, valeur) VALUES (?, ?) ON DUPLICATE KEY UPDATE valeur = ?',
      ['last_run', new Date().toISOString(), new Date().toISOString()]
    );
    await dbPool.execute(
      'INSERT INTO scraper_config (cle, valeur) VALUES (?, ?) ON DUPLICATE KEY UPDATE valeur = ?',
      ['last_status', status, status]
    );
  } catch (error) {
    logger.warn(`Erreur mise à jour statut: ${error.message}`);
  }
}

// Générer les expressions cron à partir de la configuration
function generateCronExpressions(config) {
  const days = config.days || '0,1,6';
  const hours = (config.hours || '0,12').split(',');

  // Générer une expression cron pour chaque heure
  return hours.map(hour => ({
    name: `Scraping FFF (${hour.padStart(2, '0')}:00)`,
    schedule: `0 ${hour} * * ${days}`,
    hour: hour
  }));
}

// Exécuter un script
async function runScript(scriptPath, taskName, timeout = 300000, retries = 0) {
  logger.info(`Démarrage de la tâche: ${taskName}`);

  return new Promise((resolve, reject) => {
    let attempt = 0;
    let lastError = null;

    const tryRun = () => {
      attempt++;
      logger.info(`Tentative ${attempt}/${retries + 1} pour ${taskName}`);

      const startTime = Date.now();
      let killed = false;

      const child = spawn('node', [scriptPath], {
        cwd: ROOT_DIR,
        env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Timeout
      const timeoutId = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        logger.warn(`Tâche ${taskName} tuée après timeout (${timeout}ms)`);
      }, timeout);

      child.on('close', async (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        if (code === 0 && !killed) {
          logger.success(`Tâche ${taskName} terminée avec succès en ${duration}ms`);
          await updateStatus('Succès - ' + new Date().toLocaleString('fr-FR'));
          resolve({ success: true, duration, stdout, stderr });
        } else {
          lastError = new Error(`Exit code: ${code}, killed: ${killed}`);

          if (attempt <= retries) {
            logger.warn(`Tâche ${taskName} échouée, nouvelle tentative dans 5s...`);
            setTimeout(tryRun, 5000);
          } else {
            logger.error(`Tâche ${taskName} échouée après ${attempt} tentatives`);
            logger.error(`Dernière erreur: ${lastError.message}`);
            if (stderr) logger.error(`stderr: ${stderr.substring(0, 500)}`);
            await updateStatus('Échec - ' + new Date().toLocaleString('fr-FR'));
            reject(lastError);
          }
        }
      });

      child.on('error', async (err) => {
        clearTimeout(timeoutId);
        lastError = err;

        if (attempt <= retries) {
          logger.warn(`Erreur tâche ${taskName}, nouvelle tentative dans 5s...`);
          setTimeout(tryRun, 5000);
        } else {
          logger.error(`Tâche ${taskName} erreur fatale: ${err.message}`);
          await updateStatus('Erreur - ' + err.message);
          reject(err);
        }
      });
    };

    tryRun();
  });
}

// Jobs cron actifs
let activeJobs = [];

// Planifier les tâches
async function scheduleTasks() {
  logger.info('='.repeat(50));
  logger.info('Démarrage du planificateur de tâches');
  logger.info('='.repeat(50));

  // Charger la configuration
  const config = await getConfigFromDB();

  if (config.enabled !== 'true') {
    logger.info('Scraping automatique désactivé dans la configuration');
    return;
  }

  const timeout = parseInt(config.timeout) || 300000;
  const retries = parseInt(config.retries) || 2;
  const scriptPath = path.join(__dirname, 'scrape-fff.js');

  // Générer les expressions cron
  const cronExpressions = generateCronExpressions(config);

  // Annuler les jobs existants
  activeJobs.forEach(job => job.stop());
  activeJobs = [];

  // Planifier chaque tâche
  for (const task of cronExpressions) {
    if (!cron.validate(task.schedule)) {
      logger.error(`Expression cron invalide: ${task.schedule}`);
      continue;
    }

    logger.info(`Planification: ${task.name} - ${task.schedule}`);

    const job = cron.schedule(task.schedule, async () => {
      // Recharger la config pour vérifier si toujours activé
      const currentConfig = await getConfigFromDB();
      if (currentConfig.enabled !== 'true') {
        logger.info('Scraping désactivé, tâche ignorée');
        return;
      }

      try {
        await runScript(scriptPath, task.name, timeout, retries);
      } catch (error) {
        logger.error(`Erreur exécution ${task.name}: ${error.message}`);
      }
    }, {
      scheduled: true,
      timezone: 'Europe/Paris'
    });

    activeJobs.push(job);
  }

  // Afficher le résumé
  const joursNoms = { '0': 'Dim', '1': 'Lun', '2': 'Mar', '3': 'Mer', '4': 'Jeu', '5': 'Ven', '6': 'Sam' };
  const joursStr = config.days.split(',').map(d => joursNoms[d] || d).join(', ');
  const heuresStr = config.hours.split(',').map(h => h.padStart(2, '0') + ':00').join(', ');

  logger.info('Planificateur démarré. En attente des tâches...');
  logger.info(`Scraping FFF programmé: ${joursStr} à ${heuresStr}`);
}

// Exécuter une tâche immédiatement
async function runOnce() {
  logger.info('Exécution immédiate du scraping FFF');

  const config = await getConfigFromDB();
  const timeout = parseInt(config.timeout) || 300000;
  const retries = parseInt(config.retries) || 2;
  const scriptPath = path.join(__dirname, 'scrape-fff.js');

  try {
    const result = await runScript(scriptPath, 'Scraping FFF (Manuel)', timeout, retries);
    logger.success('Exécution terminée');
    process.exit(0);
  } catch (error) {
    logger.error(`Échec: ${error.message}`);
    process.exit(1);
  }
}

// Point d'entrée
async function main() {
  const args = process.argv.slice(2);

  // Initialiser la connexion à la base de données
  await initDatabase();

  if (args.includes('--once') || args.includes('-1')) {
    // Exécution unique
    await runOnce();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Planificateur de tâches Magny FC 78

Usage:
  node cron-scheduler.js              Démarrer le planificateur
  node cron-scheduler.js --once       Exécuter le scraping FFF une fois

La configuration est lue depuis la table scraper_config dans la base de données.
Modifiable via l'interface d'administration.

Options:
  --once, -1    Exécuter une fois et quitter
  --help, -h    Afficher cette aide
`);
    process.exit(0);
  } else {
    // Mode démon
    await scheduleTasks();

    // Recharger la config toutes les 5 minutes pour prendre en compte les changements
    setInterval(async () => {
      logger.info('Rechargement de la configuration...');
      await scheduleTasks();
    }, 5 * 60 * 1000);

    // Garder le process en vie
    process.on('SIGINT', () => {
      logger.info('Arrêt du planificateur (SIGINT)');
      if (dbPool) dbPool.end();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Arrêt du planificateur (SIGTERM)');
      if (dbPool) dbPool.end();
      process.exit(0);
    });
  }
}

main().catch(err => {
  logger.error(`Erreur fatale: ${err.message}`);
  process.exit(1);
});

module.exports = { scheduleTasks, runOnce };

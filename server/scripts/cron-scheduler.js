#!/usr/bin/env node
/**
 * Planificateur de tâches cron pour Magny FC 78
 * Gère les tâches planifiées comme le scraping FFF
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

// Configuration des tâches
// Jours de week-end football: Samedi (6), Dimanche (0), Lundi (1)
const TASKS = {
  scrapeFFFMinuit: {
    name: 'Scraping FFF (Minuit)',
    schedule: '0 0 * * 0,1,6', // Samedi, Dimanche, Lundi à 00:00
    script: path.join(__dirname, 'scrape-fff.js'),
    enabled: true,
    timeout: 5 * 60 * 1000, // 5 minutes max
    retries: 2
  },
  scrapeFFFMidi: {
    name: 'Scraping FFF (Midi)',
    schedule: '0 12 * * 0,1,6', // Samedi, Dimanche, Lundi à 12:00
    script: path.join(__dirname, 'scrape-fff.js'),
    enabled: true,
    timeout: 5 * 60 * 1000, // 5 minutes max
    retries: 2
  }
};

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

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        if (code === 0 && !killed) {
          logger.success(`Tâche ${taskName} terminée avec succès en ${duration}ms`);
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
            reject(lastError);
          }
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeoutId);
        lastError = err;

        if (attempt <= retries) {
          logger.warn(`Erreur tâche ${taskName}, nouvelle tentative dans 5s...`);
          setTimeout(tryRun, 5000);
        } else {
          logger.error(`Tâche ${taskName} erreur fatale: ${err.message}`);
          reject(err);
        }
      });
    };

    tryRun();
  });
}

// Planifier les tâches
function scheduleTasks() {
  logger.info('='.repeat(50));
  logger.info('Démarrage du planificateur de tâches');
  logger.info('='.repeat(50));

  for (const [taskId, task] of Object.entries(TASKS)) {
    if (!task.enabled) {
      logger.info(`Tâche ${task.name} désactivée`);
      continue;
    }

    // Valider l'expression cron
    if (!cron.validate(task.schedule)) {
      logger.error(`Expression cron invalide pour ${task.name}: ${task.schedule}`);
      continue;
    }

    logger.info(`Planification: ${task.name} - ${task.schedule}`);

    cron.schedule(task.schedule, async () => {
      try {
        await runScript(task.script, task.name, task.timeout, task.retries);
      } catch (error) {
        logger.error(`Erreur exécution ${task.name}: ${error.message}`);
      }
    }, {
      scheduled: true,
      timezone: 'Europe/Paris'
    });
  }

  logger.info('Planificateur démarré. En attente des tâches...');
  logger.info('Scraping FFF programmé: Samedi/Dimanche/Lundi à 00:00 et 12:00');
}

// Exécuter une tâche immédiatement
async function runOnce(taskId = 'scrapeFFF') {
  const task = TASKS[taskId];

  if (!task) {
    logger.error(`Tâche inconnue: ${taskId}`);
    process.exit(1);
  }

  logger.info(`Exécution immédiate de: ${task.name}`);

  try {
    const result = await runScript(task.script, task.name, task.timeout, task.retries);
    logger.success('Exécution terminée');
    process.exit(0);
  } catch (error) {
    logger.error(`Échec: ${error.message}`);
    process.exit(1);
  }
}

// Point d'entrée
const args = process.argv.slice(2);

if (args.includes('--once') || args.includes('-1')) {
  // Exécution unique
  const taskArg = args.find(a => a.startsWith('--task='));
  const taskId = taskArg ? taskArg.split('=')[1] : 'scrapeFFF';
  runOnce(taskId);
} else if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Planificateur de tâches Magny FC 78

Usage:
  node cron-scheduler.js              Démarrer le planificateur
  node cron-scheduler.js --once       Exécuter le scraping FFF une fois
  node cron-scheduler.js --task=X     Spécifier la tâche à exécuter

Tâches disponibles:
${Object.entries(TASKS).map(([id, t]) => `  - ${id}: ${t.name} (${t.schedule})`).join('\n')}

Options:
  --once, -1    Exécuter une fois et quitter
  --task=ID     Spécifier la tâche
  --help, -h    Afficher cette aide
`);
  process.exit(0);
} else {
  // Mode démon
  scheduleTasks();

  // Garder le process en vie
  process.on('SIGINT', () => {
    logger.info('Arrêt du planificateur (SIGINT)');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Arrêt du planificateur (SIGTERM)');
    process.exit(0);
  });
}

module.exports = { scheduleTasks, runOnce, TASKS };

#!/usr/bin/env node
/**
 * Scraper FFF - District des Yvelines (DYF78)
 * Récupération automatique des données depuis dyf78.fff.fr
 * Club: Magny FC 78 (scl=25702)
 *
 * Données récupérées:
 *   - Calendrier : Calendrier complet (passé + futur) pour chaque équipe
 *   - Classement : Classements des compétitions
 *
 * Note: Résultats et Agenda sont inclus dans Calendrier, pas besoin de les scraper séparément
 *
 * Usage:
 *   npm run scrape:fff           # Exécution normale
 *   npm run scrape:fff:dry       # Mode test (pas d'écriture en base)
 *   node server/scripts/scrape-fff.js --verbose  # Mode détaillé
 *   node server/scripts/scrape-fff.js --debug    # Mode debug (capture screenshots + HTML)
 *   node server/scripts/scrape-fff.js --tab=calendrier  # Scraper un onglet spécifique
 */

const path = require('path');
const fs = require('fs');

// Configuration des chemins
const ROOT_DIR = path.join(__dirname, '../..');
const LOG_DIR = path.join(ROOT_DIR, 'logs');

// Charger les variables d'environnement
require('dotenv-flow').config({ path: ROOT_DIR });

const puppeteer = require('puppeteer');
const mysql = require('mysql2/promise');

// Configuration du club sur le District des Yvelines
const CONFIG = {
  clubId: '25702',
  clubName: 'MAGNY 78 F.C.',
  baseUrl: 'https://dyf78.fff.fr',
  // URLs des différents onglets
  urls: {
    resultats: 'https://dyf78.fff.fr/recherche-clubs?subtab=resultats&tab=resultats&scl=25702',
    agenda: 'https://dyf78.fff.fr/recherche-clubs?subtab=agenda&tab=resultats&scl=25702',
    classement: 'https://dyf78.fff.fr/recherche-clubs?subtab=ranking&tab=resultats&scl=25702',
    calendrier: 'https://dyf78.fff.fr/recherche-clubs?subtab=calendar&tab=resultats&scl=25702'
  },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  timeout: 60000,
  retryAttempts: 3,
  retryDelay: 2000
};

// Options de ligne de commande
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const DEBUG = args.includes('--debug');
const TAB_ARG = args.find(a => a.startsWith('--tab='));
const SPECIFIC_TAB = TAB_ARG ? TAB_ARG.split('=')[1] : null;

// Dossier pour les fichiers de debug
const DEBUG_DIR = path.join(ROOT_DIR, 'logs', 'scraper-debug');

// Logger personnalisé pour le scraping
const scraperLogger = {
  logFile: path.join(LOG_DIR, 'scraping.log'),

  _formatDate() {
    return new Date().toISOString().replace('T', ' ').split('.')[0];
  },

  _write(level, message) {
    const line = `${this._formatDate()} [${level}] ${message}`;
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
  debug(message) { if (VERBOSE) this._write('DEBUG', message); },
  success(message) { this._write('SUCCESS', message); }
};

// Connexion à la base de données
let db = null;

async function connectDatabase() {
  if (db) return db;

  const poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'magny_fc_78',
    waitForConnections: true,
    connectionLimit: 5,
    charset: 'utf8mb4',
    timezone: 'Europe/Paris'
  };

  scraperLogger.debug(`Connexion DB: ${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`);
  db = await mysql.createPool(poolConfig);

  const [rows] = await db.query('SELECT 1');
  scraperLogger.info('Connexion à la base de données établie');

  return db;
}

async function closeDatabase() {
  if (db) {
    await db.end();
    db = null;
    scraperLogger.debug('Connexion à la base de données fermée');
  }
}

// Créer un log de scraping
async function createScrapingLog() {
  if (DRY_RUN) return { id: null };

  const [result] = await db.query(`
    INSERT INTO fff_scraping_logs (started_at, status)
    VALUES (NOW(), 'running')
  `);

  return { id: result.insertId };
}

async function updateScrapingLog(logId, data) {
  if (DRY_RUN || !logId) return;

  const updates = [];
  const params = [];

  for (const [key, value] of Object.entries(data)) {
    if (key === 'finished_at') {
      updates.push('finished_at = NOW()');
    } else if (value !== undefined) {
      updates.push(`${key} = ?`);
      params.push(value);
    }
  }

  if (updates.length === 0) return;

  params.push(logId);
  await db.query(`UPDATE fff_scraping_logs SET ${updates.join(', ')} WHERE id = ?`, params);
}

// Helper function to replace deprecated page.waitForTimeout
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Sauvegarder les infos de debug (screenshot + HTML)
async function saveDebugInfo(page, tabName) {
  if (!DEBUG) return;

  try {
    // Créer le dossier de debug si nécessaire
    if (!fs.existsSync(DEBUG_DIR)) {
      fs.mkdirSync(DEBUG_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Sauvegarder la capture d'écran
    const screenshotPath = path.join(DEBUG_DIR, `${tabName}-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    scraperLogger.info(`[DEBUG] Screenshot sauvegardé: ${screenshotPath}`);

    // Sauvegarder le HTML
    const htmlPath = path.join(DEBUG_DIR, `${tabName}-${timestamp}.html`);
    const html = await page.content();
    fs.writeFileSync(htmlPath, html);
    scraperLogger.info(`[DEBUG] HTML sauvegardé: ${htmlPath}`);

    // Afficher les classes et IDs trouvés sur la page
    const pageInfo = await page.evaluate(() => {
      const info = {
        tables: document.querySelectorAll('table').length,
        divWithMatch: document.querySelectorAll('[class*="match"]').length,
        divWithResult: document.querySelectorAll('[class*="result"]').length,
        divWithRencontre: document.querySelectorAll('[class*="rencontre"]').length,
        allClasses: [...new Set([...document.querySelectorAll('*')].map(el => el.className).filter(c => c && typeof c === 'string'))].slice(0, 50)
      };
      return info;
    });

    scraperLogger.info(`[DEBUG] Page info pour ${tabName}:`);
    scraperLogger.info(`  - Tables trouvées: ${pageInfo.tables}`);
    scraperLogger.info(`  - Éléments avec 'match': ${pageInfo.divWithMatch}`);
    scraperLogger.info(`  - Éléments avec 'result': ${pageInfo.divWithResult}`);
    scraperLogger.info(`  - Éléments avec 'rencontre': ${pageInfo.divWithRencontre}`);
    scraperLogger.info(`  - Classes trouvées: ${pageInfo.allClasses.join(', ')}`);

  } catch (err) {
    scraperLogger.error(`[DEBUG] Erreur sauvegarde debug: ${err.message}`);
  }
}

// Lancer le navigateur Puppeteer
async function launchBrowser() {
  scraperLogger.info('Démarrage du navigateur Puppeteer...');

  return await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920x1080'
    ]
  });
}

// Configuration de la page
async function setupPage(browser) {
  const page = await browser.newPage();

  await page.setUserAgent(CONFIG.userAgent);
  await page.setViewport({ width: 1920, height: 1080 });

  // Bloquer les ressources non essentielles
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    if (['image', 'font', 'media'].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  return page;
}

// Fermer la popup de consentement cookies (Didomi)
async function dismissCookiePopup(page) {
  try {
    scraperLogger.info('Recherche de la popup cookies Didomi...');

    // Attendre que la popup Didomi soit visible
    await delay(1000);

    // Vérifier si la popup est ouverte
    const hasPopup = await page.evaluate(() => {
      return document.body.classList.contains('didomi-popup-open') ||
             document.querySelector('.didomi-popup-container') !== null;
    });

    if (!hasPopup) {
      scraperLogger.info('Pas de popup cookies détectée');
      return;
    }

    scraperLogger.info('Popup Didomi détectée, fermeture...');

    // Cliquer sur le bouton "Accepter" (classe: didomi-button-highlight ou contient "Accepter")
    const clicked = await page.evaluate(() => {
      // 1. Chercher par classe spécifique Didomi
      const acceptBtn = document.querySelector('.didomi-button-highlight, .didomi-dismiss-button');
      if (acceptBtn) {
        acceptBtn.click();
        return 'didomi-accept';
      }

      // 2. Chercher par texte "Accepter"
      const allButtons = document.querySelectorAll('button');
      for (const btn of allButtons) {
        if (btn.textContent.trim() === 'Accepter') {
          btn.click();
          return 'text-accept';
        }
      }

      // 3. Chercher "Refuser" comme fallback
      for (const btn of allButtons) {
        if (btn.textContent.trim() === 'Refuser') {
          btn.click();
          return 'text-refuse';
        }
      }

      return null;
    });

    if (clicked) {
      scraperLogger.info(`Bouton cliqué: ${clicked}`);
      await delay(2000);
    } else {
      scraperLogger.info('Aucun bouton trouvé, tentative de masquage forcé...');
      // Forcer le masquage de la popup
      await page.evaluate(() => {
        document.body.classList.remove('didomi-popup-open');
        const popups = document.querySelectorAll('.didomi-popup-container, .didomi-popup-backdrop, .didomi-popup-notice');
        popups.forEach(p => p.style.display = 'none');
      });
      await delay(1000);
    }

  } catch (err) {
    scraperLogger.error(`Erreur fermeture popup: ${err.message}`);
  }
}

// =====================================================
// SCRAPING DES RÉSULTATS
// =====================================================
async function scrapeResultats(page) {
  scraperLogger.info('Scraping des RÉSULTATS...');
  scraperLogger.info(`URL: ${CONFIG.urls.resultats}`);

  await page.goto(CONFIG.urls.resultats, {
    waitUntil: 'networkidle2',
    timeout: CONFIG.timeout
  });

  await delay(2000);

  // Fermer la popup de cookies
  await dismissCookiePopup(page);
  await delay(2000);

  await saveDebugInfo(page, 'resultats');

  const resultats = await page.evaluate(() => {
    const matches = [];
    const months = { 'janvier': '01', 'février': '02', 'fevrier': '02', 'mars': '03', 'avril': '04', 'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08', 'aout': '08', 'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12', 'decembre': '12' };

    // Chercher tous les éléments app-confrontation (composants Angular)
    const confrontations = document.querySelectorAll('app-confrontation');

    confrontations.forEach(el => {
      try {
        const match = {
          homeTeam: null,
          awayTeam: null,
          scoreHome: null,
          scoreAway: null,
          date: null,
          heure: null,
          competition: null,
          url: null,
          forfait: null
        };

        // URL du match
        const link = el.querySelector('a');
        if (link) match.url = link.getAttribute('href');

        // Compétition (dans .competition)
        const competitionEl = el.querySelector('.competition');
        if (competitionEl) {
          match.competition = competitionEl.innerText.replace(/\n/g, ' ').trim();
        }

        // Date et heure (dans .date)
        const dateEl = el.querySelector('.date');
        if (dateEl) {
          const dateText = dateEl.innerText;
          // Format: "samedi 24 janvier 2026 - 16H00"
          const dateMatch = dateText.match(/(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i);
          if (dateMatch) {
            const day = dateMatch[1].padStart(2, '0');
            const month = months[dateMatch[2].toLowerCase()] || '01';
            const year = dateMatch[3];
            match.date = `${year}-${month}-${day}`;
          }

          const timeMatch = dateText.match(/(\d{1,2})[hH](\d{2})/);
          if (timeMatch) {
            match.heure = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
          }
        }

        // Équipe 1 (domicile) - dans .equipe1 .name
        const equipe1 = el.querySelector('.equipe1 .name');
        if (equipe1) {
          const text = equipe1.innerText.trim();
          // Le score est après le nom, séparé par &nbsp; ou espaces multiples
          // Format: "MAGNY 78 F.C.   21" ou "MAGNY 78 F.C.   "
          const scoreMatch = text.match(/^(.+?)\s{2,}(\d+)?\s*$/);
          if (scoreMatch) {
            match.homeTeam = scoreMatch[1].trim();
            if (scoreMatch[2]) match.scoreHome = parseInt(scoreMatch[2]);
          } else {
            match.homeTeam = text.replace(/\s+\d+\s*$/, '').trim();
          }
        }

        // Équipe 2 (extérieur) - dans .equipe2 .name
        const equipe2 = el.querySelector('.equipe2 .name');
        if (equipe2) {
          const text = equipe2.innerText.trim();
          const scoreMatch = text.match(/^(.+?)\s{2,}(\d+)?\s*$/);
          if (scoreMatch) {
            match.awayTeam = scoreMatch[1].trim();
            if (scoreMatch[2]) match.scoreAway = parseInt(scoreMatch[2]);
          } else {
            match.awayTeam = text.replace(/\s+\d+\s*$/, '').trim();
          }
        }

        // Forfait (dans .forfeit span)
        const forfait = el.querySelector('.forfeit span');
        if (forfait) {
          match.forfait = forfait.innerText.trim();
        }

        // Ajouter si on a les infos essentielles
        if (match.homeTeam && match.awayTeam) {
          matches.push(match);
        }
      } catch (err) {
        // Ignorer les erreurs de parsing
      }
    });

    return matches;
  });

  scraperLogger.info(`Résultats trouvés: ${resultats.length} matchs`);
  if (resultats.length > 0) {
    scraperLogger.info(`Premier résultat: ${JSON.stringify(resultats[0])}`);
  }
  return resultats;
}

// =====================================================
// SCRAPING DE L'AGENDA
// =====================================================
async function scrapeAgenda(page) {
  scraperLogger.info("Scraping de l'AGENDA...");
  scraperLogger.info(`URL: ${CONFIG.urls.agenda}`);

  await page.goto(CONFIG.urls.agenda, {
    waitUntil: 'networkidle2',
    timeout: CONFIG.timeout
  });

  await delay(2000);

  // Fermer la popup de cookies
  await dismissCookiePopup(page);
  await delay(2000);

  await saveDebugInfo(page, 'agenda');

  // Utiliser la même structure que scrapeResultats (app-confrontation)
  const agenda = await page.evaluate(() => {
    const matches = [];
    const months = { 'janvier': '01', 'février': '02', 'fevrier': '02', 'mars': '03', 'avril': '04', 'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08', 'aout': '08', 'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12', 'decembre': '12' };

    const confrontations = document.querySelectorAll('app-confrontation');

    confrontations.forEach(el => {
      try {
        const match = {
          homeTeam: null,
          awayTeam: null,
          date: null,
          heure: null,
          competition: null,
          url: null
        };

        const link = el.querySelector('a');
        if (link) match.url = link.getAttribute('href');

        const competitionEl = el.querySelector('.competition');
        if (competitionEl) {
          match.competition = competitionEl.innerText.replace(/\n/g, ' ').trim();
        }

        const dateEl = el.querySelector('.date');
        if (dateEl) {
          const dateText = dateEl.innerText;
          const dateMatch = dateText.match(/(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i);
          if (dateMatch) {
            match.date = `${dateMatch[3]}-${months[dateMatch[2].toLowerCase()]}-${dateMatch[1].padStart(2, '0')}`;
          }
          const timeMatch = dateText.match(/(\d{1,2})[hH](\d{2})/);
          if (timeMatch) {
            match.heure = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
          }
        }

        const equipe1 = el.querySelector('.equipe1 .name');
        if (equipe1) {
          match.homeTeam = equipe1.innerText.replace(/\s+\d*\s*$/, '').trim();
        }

        const equipe2 = el.querySelector('.equipe2 .name');
        if (equipe2) {
          match.awayTeam = equipe2.innerText.replace(/\s+\d*\s*$/, '').trim();
        }

        if (match.homeTeam && match.awayTeam) {
          matches.push(match);
        }
      } catch (err) {}
    });

    return matches;
  });

  scraperLogger.info(`Agenda trouvé: ${agenda.length} matchs à venir`);
  if (DEBUG && agenda.length > 0) {
    scraperLogger.info(`Premier match agenda: ${JSON.stringify(agenda[0])}`);
  }
  return agenda;
}

// =====================================================
// SCRAPING DU CLASSEMENT
// =====================================================
async function scrapeClassement(page) {
  scraperLogger.info('Scraping du CLASSEMENT...');
  scraperLogger.info(`URL: ${CONFIG.urls.classement}`);

  await page.goto(CONFIG.urls.classement, {
    waitUntil: 'networkidle2',
    timeout: CONFIG.timeout
  });

  await delay(2000);

  // Fermer la popup de cookies
  await dismissCookiePopup(page);
  await delay(2000);

  await saveDebugInfo(page, 'classement');

  // ÉTAPE 1: Récupérer la liste des compétitions
  const competitionLinks = await page.evaluate(() => {
    const competitions = [];
    const baseUrl = 'https://dyf78.fff.fr';

    // Chercher dans .calendrier-content ou app-classements-tab
    const container = document.querySelector('.calendrier-content, app-classements-tab');
    if (!container) return competitions;

    const links = container.querySelectorAll('a');
    links.forEach(link => {
      const href = link.getAttribute('href');
      const name = link.innerText.trim();

      if (name && href) {
        competitions.push({
          name: name,
          url: href.startsWith('/') ? baseUrl + href : href
        });
      }
    });

    return competitions;
  });

  scraperLogger.info(`Compétitions trouvées: ${competitionLinks.length}`);

  // ÉTAPE 2: Naviguer vers chaque compétition pour récupérer le classement détaillé
  const allClassements = [];

  for (const comp of competitionLinks) {
    try {
      scraperLogger.info(`  -> Récupération classement: ${comp.name}`);
      await page.goto(comp.url, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.timeout
      });
      await delay(1500);

      if (DEBUG) {
        await saveDebugInfo(page, `classement-${comp.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}`);
      }

      // Récupérer le tableau de classement
      const standings = await page.evaluate((competitionName) => {
        const results = [];

        // Chercher le tableau de classement (généralement dans app-classement ou table)
        const rows = document.querySelectorAll('app-classement .row, table.classement tr, .classement-row, table tr');

        rows.forEach((row, index) => {
          // Ignorer l'en-tête
          const cells = row.querySelectorAll('td, .cell, span');
          if (cells.length < 3) return;

          // Essayer de trouver: position, équipe, points, joués, etc.
          const textContent = row.innerText.trim();

          // Pattern: position + nom équipe + stats
          const match = textContent.match(/^(\d+)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([+-]?\d+)/);
          if (match) {
            results.push({
              competition: competitionName,
              position: parseInt(match[1]),
              equipe: match[2].trim(),
              points: parseInt(match[3]),
              joues: parseInt(match[4]),
              gagnes: parseInt(match[5]),
              nuls: parseInt(match[6]),
              perdus: parseInt(match[7]),
              butsPour: parseInt(match[8]),
              butsContre: parseInt(match[9]),
              difference: parseInt(match[10])
            });
          } else {
            // Format simplifié: chercher au moins position, équipe et points
            const simpleMatch = textContent.match(/^(\d+)\s+(.+?)(?:\s+(\d+))?$/);
            if (simpleMatch && simpleMatch[2]) {
              results.push({
                competition: competitionName,
                position: parseInt(simpleMatch[1]),
                equipe: simpleMatch[2].trim(),
                points: simpleMatch[3] ? parseInt(simpleMatch[3]) : null,
                joues: null, gagnes: null, nuls: null, perdus: null,
                butsPour: null, butsContre: null, difference: null
              });
            }
          }
        });

        // Si pas de résultats via parsing, essayer d'extraire depuis le texte brut
        if (results.length === 0) {
          const pageText = document.body.innerText;
          const lines = pageText.split('\n').filter(l => l.trim());

          let position = 0;
          for (const line of lines) {
            // Chercher les lignes qui ressemblent à des entrées de classement
            // Format typique: "1 ÉQUIPE A 35 15 11 2 2 45 18 +27"
            const lineMatch = line.trim().match(/^(\d+)\s+([A-ZÉÈÊËÀÂÄÙÛÜÔÖÎÏÇ0-9\s\-\.]+?)\s+(\d+)\s+/i);
            if (lineMatch) {
              position++;
              results.push({
                competition: competitionName,
                position: parseInt(lineMatch[1]),
                equipe: lineMatch[2].trim(),
                points: null, joues: null, gagnes: null, nuls: null, perdus: null,
                butsPour: null, butsContre: null, difference: null
              });
            }
          }
        }

        return results;
      }, comp.name);

      if (standings.length > 0) {
        scraperLogger.info(`     ${standings.length} équipes dans le classement`);
        allClassements.push(...standings);
      } else {
        scraperLogger.warn(`     Aucune donnée de classement trouvée pour ${comp.name}`);
      }

    } catch (err) {
      scraperLogger.error(`  Erreur récupération ${comp.name}: ${err.message}`);
    }
  }

  scraperLogger.info(`Total classements récupérés: ${allClassements.length} entrées`);
  return allClassements;
}

// =====================================================
// SCRAPING DU CALENDRIER COMPLET
// =====================================================
async function scrapeCalendrier(page) {
  scraperLogger.info('Scraping du CALENDRIER complet...');
  scraperLogger.info(`URL: ${CONFIG.urls.calendrier}`);

  await page.goto(CONFIG.urls.calendrier, {
    waitUntil: 'networkidle2',
    timeout: CONFIG.timeout
  });

  await delay(2000);

  // Fermer la popup de cookies
  await dismissCookiePopup(page);
  await delay(2000);

  await saveDebugInfo(page, 'calendrier');

  // ÉTAPE 1: Récupérer la liste des équipes du club
  // Structure: app-calendriers-list avec sections "Championnats" et "Coupes"
  // Chaque lien pointe vers le calendrier d'une équipe spécifique
  const teamLinks = await page.evaluate(() => {
    const teams = [];
    const baseUrl = 'https://dyf78.fff.fr';

    // Chercher dans app-calendriers-list ou .calendriers-list
    const container = document.querySelector('app-calendriers-list, .calendriers-list, app-calendrier-tab');
    if (!container) {
      // Fallback: chercher tous les liens avec calendrier dans l'URL
      const allLinks = document.querySelectorAll('a[href*="calendar"], a[href*="calendrier"]');
      allLinks.forEach(link => {
        const href = link.getAttribute('href');
        const name = link.innerText.trim();
        if (name && href && name.length > 3) {
          teams.push({
            name: name,
            url: href.startsWith('/') ? baseUrl + href : href
          });
        }
      });
      return teams;
    }

    let currentCategory = null;

    // Parcourir tous les éléments
    const elements = container.querySelectorAll('.calendrier-competition, a, .title');
    elements.forEach(el => {
      // Détecter les titres de catégorie (Championnats, Coupes)
      if (el.classList.contains('calendrier-competition') || el.classList.contains('title')) {
        const titleEl = el.classList.contains('title') ? el : el.querySelector('.title');
        if (titleEl) {
          currentCategory = titleEl.innerText.trim();
        }
      } else if (el.tagName === 'A') {
        const href = el.getAttribute('href');
        const name = el.innerText.trim();

        if (name && href && name.length > 3) {
          teams.push({
            name: name,
            url: href.startsWith('/') ? baseUrl + href : href,
            category: currentCategory || 'Compétition'
          });
        }
      }
    });

    // Si toujours vide, chercher tous les liens directs
    if (teams.length === 0) {
      const links = container.querySelectorAll('a');
      links.forEach(link => {
        const href = link.getAttribute('href');
        const name = link.innerText.trim();

        if (name && href && name.length > 3) {
          teams.push({
            name: name,
            url: href.startsWith('/') ? baseUrl + href : href,
            category: 'Équipe'
          });
        }
      });
    }

    return teams;
  });

  scraperLogger.info(`Équipes/Compétitions trouvées: ${teamLinks.length}`);
  teamLinks.forEach(t => scraperLogger.info(`  - [${t.category || 'Équipe'}] ${t.name}`));

  if (teamLinks.length === 0) {
    scraperLogger.warn('Aucune équipe trouvée sur la page calendrier');
    return [];
  }

  // ÉTAPE 2: Naviguer vers chaque équipe pour récupérer son calendrier complet
  const allMatches = [];
  const months = { 'janvier': '01', 'février': '02', 'fevrier': '02', 'mars': '03', 'avril': '04', 'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08', 'aout': '08', 'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12', 'decembre': '12' };

  for (const team of teamLinks) {
    try {
      scraperLogger.info(`  -> Récupération calendrier: ${team.name}`);
      scraperLogger.info(`     URL: ${team.url}`);

      await page.goto(team.url, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.timeout
      });
      await delay(2000);

      // Fermer la popup de cookies si elle réapparaît
      await dismissCookiePopup(page);
      await delay(1000);

      if (DEBUG) {
        await saveDebugInfo(page, `calendrier-${team.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}`);
      }

      // Récupérer tous les matchs de cette équipe (passés et futurs)
      const matches = await page.evaluate((teamName, monthsMap) => {
        const results = [];

        // Chercher les matchs avec app-confrontation (même structure que résultats/agenda)
        const confrontations = document.querySelectorAll('app-confrontation');

        confrontations.forEach(el => {
          try {
            const match = {
              homeTeam: null,
              awayTeam: null,
              scoreHome: null,
              scoreAway: null,
              date: null,
              heure: null,
              competition: teamName,
              url: null,
              forfait: null,
              statut: 'a_venir'
            };

            // URL du match détail
            const link = el.querySelector('a');
            if (link) match.url = link.getAttribute('href');

            // Compétition (si disponible dans l'élément)
            const competitionEl = el.querySelector('.competition');
            if (competitionEl) {
              match.competition = competitionEl.innerText.replace(/\n/g, ' ').trim();
            }

            // Date et heure
            const dateEl = el.querySelector('.date');
            if (dateEl) {
              const dateText = dateEl.innerText;
              const dateMatch = dateText.match(/(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i);
              if (dateMatch) {
                const day = dateMatch[1].padStart(2, '0');
                const month = monthsMap[dateMatch[2].toLowerCase()] || '01';
                const year = dateMatch[3];
                match.date = `${year}-${month}-${day}`;
              }

              const timeMatch = dateText.match(/(\d{1,2})[hH](\d{2})/);
              if (timeMatch) {
                match.heure = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
              }
            }

            // Équipe domicile (equipe1)
            const equipe1 = el.querySelector('.equipe1 .name');
            if (equipe1) {
              const text = equipe1.innerText.trim();
              // Format possible: "NOM ÉQUIPE   SCORE" ou juste "NOM ÉQUIPE"
              const scoreMatch = text.match(/^(.+?)\s{2,}(\d+)\s*$/);
              if (scoreMatch) {
                match.homeTeam = scoreMatch[1].trim();
                match.scoreHome = parseInt(scoreMatch[2]);
              } else {
                // Chercher le score dans un élément séparé
                const scoreEl = el.querySelector('.equipe1 .score, .equipe1 .resultat');
                if (scoreEl) {
                  match.homeTeam = text.trim();
                  const score = parseInt(scoreEl.innerText.trim());
                  if (!isNaN(score)) match.scoreHome = score;
                } else {
                  match.homeTeam = text.replace(/\s+\d+\s*$/, '').trim();
                }
              }
            }

            // Équipe extérieur (equipe2)
            const equipe2 = el.querySelector('.equipe2 .name');
            if (equipe2) {
              const text = equipe2.innerText.trim();
              const scoreMatch = text.match(/^(.+?)\s{2,}(\d+)\s*$/);
              if (scoreMatch) {
                match.awayTeam = scoreMatch[1].trim();
                match.scoreAway = parseInt(scoreMatch[2]);
              } else {
                const scoreEl = el.querySelector('.equipe2 .score, .equipe2 .resultat');
                if (scoreEl) {
                  match.awayTeam = text.trim();
                  const score = parseInt(scoreEl.innerText.trim());
                  if (!isNaN(score)) match.scoreAway = score;
                } else {
                  match.awayTeam = text.replace(/\s+\d+\s*$/, '').trim();
                }
              }
            }

            // Forfait
            const forfait = el.querySelector('.forfeit span, .forfait');
            if (forfait) {
              match.forfait = forfait.innerText.trim();
            }

            // Déterminer le statut (terminé si scores présents)
            if (match.scoreHome !== null || match.scoreAway !== null) {
              match.statut = 'termine';
            }

            // Ajouter uniquement si on a les deux équipes
            if (match.homeTeam && match.awayTeam) {
              results.push(match);
            }
          } catch (err) {
            // Ignorer les erreurs de parsing individuel
          }
        });

        return results;
      }, team.name, months);

      if (matches.length > 0) {
        scraperLogger.info(`     ${matches.length} matchs trouvés (${matches.filter(m => m.statut === 'termine').length} terminés, ${matches.filter(m => m.statut === 'a_venir').length} à venir)`);
        allMatches.push(...matches);
      } else {
        scraperLogger.warn(`     Aucun match trouvé pour ${team.name}`);
      }

    } catch (err) {
      scraperLogger.error(`  Erreur récupération ${team.name}: ${err.message}`);
    }
  }

  scraperLogger.info(`\nTotal calendrier récupéré: ${allMatches.length} matchs`);
  scraperLogger.info(`  - Matchs terminés: ${allMatches.filter(m => m.statut === 'termine').length}`);
  scraperLogger.info(`  - Matchs à venir: ${allMatches.filter(m => m.statut === 'a_venir').length}`);

  if (DEBUG && allMatches.length > 0) {
    scraperLogger.info(`Premier match: ${JSON.stringify(allMatches[0])}`);
  }
  return allMatches;
}

// =====================================================
// SAUVEGARDE DES DONNÉES
// =====================================================

async function findLocalTeam(teamName) {
  const [teams] = await db.query('SELECT id, nom, slug, fff_team_id, fff_nom FROM equipes WHERE actif = 1');

  // 1. PRIORITÉ: Matching exact par fff_nom (défini par l'admin)
  const teamNameLower = teamName.toLowerCase().trim();
  const exactMatch = teams.find(t => t.fff_nom && t.fff_nom.toLowerCase().trim() === teamNameLower);
  if (exactMatch) {
    log(`✓ Match exact fff_nom: "${teamName}" -> ${exactMatch.nom}`);
    return exactMatch;
  }

  // 2. Matching partiel par fff_nom (contient le nom)
  const partialMatch = teams.find(t => t.fff_nom && teamNameLower.includes(t.fff_nom.toLowerCase().trim()));
  if (partialMatch) {
    log(`✓ Match partiel fff_nom: "${teamName}" -> ${partialMatch.nom}`);
    return partialMatch;
  }

  // 3. Fallback: Mapping par catégorie (anciennes correspondances)
  const normalized = teamName.toLowerCase()
    .replace(/magny\s*(fc\s*)?78?|f\.?c\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const mappings = {
    'senior': ['seniors-1', 'seniors-2'],
    'u19': ['u19'],
    'u18': ['u19'],
    'u17': ['u17'],
    'u16': ['u17'],
    'u15': ['u15'],
    'u14': ['u15'],
    'u13': ['u13'],
    'u12': ['u13'],
    'u11': ['u11'],
    'u10': ['u11'],
    'u9': ['u9'],
    'u8': ['u9'],
    'u7': ['u7'],
    'féminin': ['seniors-feminines'],
    'feminin': ['seniors-feminines'],
    'fémin': ['seniors-feminines'],
    'veteran': ['veterans-1', 'veterans-2'],
    'vétéran': ['veterans-1', 'veterans-2']
  };

  for (const [pattern, slugs] of Object.entries(mappings)) {
    if (normalized.includes(pattern) || teamName.toLowerCase().includes(pattern)) {
      const team = teams.find(t => slugs.includes(t.slug));
      if (team) {
        log(`⚠ Match par mapping (pas de fff_nom configuré): "${teamName}" -> ${team.nom}`);
        return team;
      }
    }
  }

  log(`✗ Aucune équipe trouvée pour: "${teamName}"`);
  return null;
}

async function saveMatch(matchData, isResult = false) {
  const isMagnyHome = /magny/i.test(matchData.homeTeam || '');
  const adversaire = isMagnyHome ? matchData.awayTeam : matchData.homeTeam;
  const lieu = isMagnyHome ? 'domicile' : 'exterieur';

  const fffId = `dyf78-${matchData.date || 'nodate'}-${(adversaire || 'unknown').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 20)}`;

  const [existing] = await db.query('SELECT id FROM matchs WHERE fff_id = ?', [fffId]);

  const localTeam = await findLocalTeam(matchData.raw || matchData.homeTeam || '');
  const equipeId = localTeam ? localTeam.id : null;

  let dateMatch = null;
  if (matchData.date) {
    const timePart = matchData.heure || '15:00';
    dateMatch = `${matchData.date} ${timePart}:00`;
  }

  const statut = isResult || matchData.scoreHome !== null ? 'termine' : 'a_venir';
  const scoreHome = isMagnyHome ? matchData.scoreHome : matchData.scoreAway;
  const scoreAway = isMagnyHome ? matchData.scoreAway : matchData.scoreHome;

  if (existing.length > 0) {
    await db.query(`
      UPDATE matchs SET
        score_domicile = COALESCE(?, score_domicile),
        score_exterieur = COALESCE(?, score_exterieur),
        statut = ?,
        fff_synced_at = NOW()
      WHERE fff_id = ?
    `, [scoreHome, scoreAway, statut, fffId]);

    return { action: 'updated', id: existing[0].id };
  }

  const [result] = await db.query(`
    INSERT INTO matchs (
      equipe_id, adversaire, date_match, lieu, competition, journee,
      score_domicile, score_exterieur, statut, visible,
      fff_id, fff_home_team, fff_away_team, fff_synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, NOW())
  `, [
    equipeId,
    adversaire || 'Adversaire inconnu',
    dateMatch,
    lieu,
    matchData.competition || 'Championnat',
    matchData.journee || null,
    scoreHome,
    scoreAway,
    statut,
    fffId,
    matchData.homeTeam,
    matchData.awayTeam
  ]);

  return { action: 'inserted', id: result.insertId };
}

async function saveClassement(entry) {
  const competitionId = (entry.competition || 'unknown')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .substring(0, 50);

  const [existing] = await db.query(
    'SELECT id FROM classements WHERE competition_id = ? AND equipe_nom = ?',
    [competitionId, entry.equipe]
  );

  const data = {
    competition_id: competitionId,
    competition_nom: entry.competition || 'Compétition',
    position: entry.position,
    equipe_nom: entry.equipe,
    points: entry.points || 0,
    joues: entry.joues || 0,
    gagnes: entry.gagnes || 0,
    nuls: entry.nuls || 0,
    perdus: entry.perdus || 0,
    buts_pour: entry.butsPour || 0,
    buts_contre: entry.butsContre || 0,
    difference: entry.difference || 0
  };

  if (/magny/i.test(entry.equipe)) {
    const localTeam = await findLocalTeam(entry.equipe);
    if (localTeam) data.equipe_id = localTeam.id;
  }

  if (existing.length > 0) {
    await db.query(`
      UPDATE classements SET
        position = ?, points = ?, joues = ?, gagnes = ?, nuls = ?,
        perdus = ?, buts_pour = ?, buts_contre = ?, difference = ?,
        equipe_id = ?, fff_synced_at = NOW()
      WHERE id = ?
    `, [
      data.position, data.points, data.joues, data.gagnes, data.nuls,
      data.perdus, data.buts_pour, data.buts_contre, data.difference,
      data.equipe_id || null, existing[0].id
    ]);

    return { action: 'updated' };
  }

  await db.query(`
    INSERT INTO classements (
      equipe_id, competition_id, competition_nom, position, equipe_nom,
      points, joues, gagnes, nuls, perdus, buts_pour, buts_contre, difference,
      fff_synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `, [
    data.equipe_id || null,
    data.competition_id,
    data.competition_nom,
    data.position,
    data.equipe_nom,
    data.points,
    data.joues,
    data.gagnes,
    data.nuls,
    data.perdus,
    data.buts_pour,
    data.buts_contre,
    data.difference
  ]);

  return { action: 'inserted' };
}

// =====================================================
// FONCTION PRINCIPALE
// =====================================================
async function main() {
  const startTime = Date.now();
  scraperLogger.info('='.repeat(60));
  scraperLogger.info(`Scraper DYF78 démarré - ${new Date().toISOString()}`);
  scraperLogger.info(`Mode: ${DRY_RUN ? 'DRY RUN (pas d\'écriture)' : 'PRODUCTION'}`);
  if (SPECIFIC_TAB) scraperLogger.info(`Onglet spécifique: ${SPECIFIC_TAB}`);
  scraperLogger.info('='.repeat(60));

  let scrapingLogId = null;
  let browser = null;
  const stats = {
    resultats: { found: 0, inserted: 0, updated: 0 },
    agenda: { found: 0, inserted: 0, updated: 0 },
    classement: { found: 0, inserted: 0, updated: 0 },
    calendrier: { found: 0, inserted: 0, updated: 0 }
  };

  try {
    await connectDatabase();
    const logEntry = await createScrapingLog();
    scrapingLogId = logEntry.id;

    browser = await launchBrowser();
    const page = await setupPage(browser);

    // Par défaut: calendrier (contient résultats + agenda) et classement
    // resultats et agenda sont gardés pour compatibilité mais ne sont plus utilisés par défaut
    const tabs = SPECIFIC_TAB ? [SPECIFIC_TAB] : ['calendrier', 'classement'];

    for (const tab of tabs) {
      try {
        scraperLogger.info(`\n--- Scraping: ${tab.toUpperCase()} ---`);

        let data = [];
        switch (tab) {
          case 'resultats':
            // OBSOLÈTE: les résultats sont inclus dans le calendrier
            scraperLogger.info('Note: Les résultats sont maintenant récupérés via le calendrier');
            data = await scrapeResultats(page);
            stats.resultats.found = data.length;
            if (!DRY_RUN) {
              for (const match of data) {
                const result = await saveMatch(match, true);
                if (result.action === 'inserted') stats.resultats.inserted++;
                else if (result.action === 'updated') stats.resultats.updated++;
              }
            }
            break;

          case 'agenda':
            // OBSOLÈTE: l'agenda est inclus dans le calendrier
            scraperLogger.info('Note: L\'agenda est maintenant récupéré via le calendrier');
            data = await scrapeAgenda(page);
            stats.agenda.found = data.length;
            if (!DRY_RUN) {
              for (const match of data) {
                const result = await saveMatch(match, false);
                if (result.action === 'inserted') stats.agenda.inserted++;
                else if (result.action === 'updated') stats.agenda.updated++;
              }
            }
            break;

          case 'classement':
            data = await scrapeClassement(page);
            stats.classement.found = data.length;
            if (!DRY_RUN) {
              for (const entry of data) {
                const result = await saveClassement(entry);
                if (result.action === 'inserted') stats.classement.inserted++;
                else if (result.action === 'updated') stats.classement.updated++;
              }
            }
            break;

          case 'calendrier':
            data = await scrapeCalendrier(page);
            stats.calendrier.found = data.length;
            if (!DRY_RUN) {
              for (const match of data) {
                const isResult = match.scoreHome !== null;
                const result = await saveMatch(match, isResult);
                if (result.action === 'inserted') stats.calendrier.inserted++;
                else if (result.action === 'updated') stats.calendrier.updated++;
              }
            }
            break;
        }

        if (VERBOSE && data.length > 0) {
          const dataPath = path.join(LOG_DIR, `fff_${tab}_data.json`);
          fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
          scraperLogger.debug(`Données ${tab} sauvegardées: ${dataPath}`);
        }

      } catch (error) {
        scraperLogger.error(`Erreur scraping ${tab}: ${error.message}`);
      }
    }

    scraperLogger.info('\n' + '='.repeat(60));
    scraperLogger.success('RÉSUMÉ DU SCRAPING:');
    for (const [tab, s] of Object.entries(stats)) {
      scraperLogger.info(`  ${tab}: ${s.found} trouvés, ${s.inserted} insérés, ${s.updated} mis à jour`);
    }

    const totalFound = Object.values(stats).reduce((sum, s) => sum + s.found, 0);
    const totalInserted = Object.values(stats).reduce((sum, s) => sum + s.inserted, 0);
    const totalUpdated = Object.values(stats).reduce((sum, s) => sum + s.updated, 0);

    await updateScrapingLog(scrapingLogId, {
      status: 'success',
      finished_at: true,
      matches_found: totalFound,
      matches_inserted: totalInserted,
      matches_updated: totalUpdated,
      execution_time_ms: Date.now() - startTime
    });

    scraperLogger.info(`Temps d'exécution: ${Date.now() - startTime}ms`);

  } catch (error) {
    scraperLogger.error(`Erreur fatale: ${error.message}`);
    scraperLogger.error(error.stack);

    if (scrapingLogId) {
      await updateScrapingLog(scrapingLogId, {
        status: 'error',
        finished_at: true,
        error_message: error.message,
        execution_time_ms: Date.now() - startTime
      });
    }

    process.exit(1);

  } finally {
    if (browser) await browser.close();
    await closeDatabase();
    scraperLogger.info('='.repeat(60));
  }
}

// Exécution
main().catch((err) => {
  console.error('Erreur non gérée:', err);
  process.exit(1);
});

module.exports = { main, CONFIG };

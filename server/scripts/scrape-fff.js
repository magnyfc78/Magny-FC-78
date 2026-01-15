#!/usr/bin/env node
/**
 * Scraper FFF - Récupération automatique des matchs depuis le site de la FFF
 * Club: Magny FC 78 (ID: 548767)
 *
 * Usage:
 *   npm run scrape:fff           # Exécution normale
 *   npm run scrape:fff:dry       # Mode test (pas d'écriture en base)
 *   node server/scripts/scrape-fff.js --verbose  # Mode détaillé
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

// Configuration
const CONFIG = {
  clubId: '548767',
  clubName: 'Magny FC 78',
  baseUrl: 'https://epreuves.fff.fr',
  clubUrl: 'https://epreuves.fff.fr/competition/club/548767-magny-78-f-c/club',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  timeout: 60000,
  retryAttempts: 3,
  retryDelay: 2000
};

// Options de ligne de commande
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

// Logger personnalisé pour le scraping
const scraperLogger = {
  logFile: path.join(LOG_DIR, 'scraping.log'),

  _formatDate() {
    return new Date().toISOString().replace('T', ' ').split('.')[0];
  },

  _write(level, message) {
    const line = `${this._formatDate()} [${level}] ${message}`;
    console.log(line);

    // Écrire dans le fichier de log
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

  // Test connection
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

// Fonction pour créer un log de scraping
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

  if (data.status) {
    updates.push('status = ?');
    params.push(data.status);
  }
  if (data.finished_at) {
    updates.push('finished_at = NOW()');
  }
  if (data.teams_found !== undefined) {
    updates.push('teams_found = ?');
    params.push(data.teams_found);
  }
  if (data.matches_found !== undefined) {
    updates.push('matches_found = ?');
    params.push(data.matches_found);
  }
  if (data.matches_inserted !== undefined) {
    updates.push('matches_inserted = ?');
    params.push(data.matches_inserted);
  }
  if (data.matches_updated !== undefined) {
    updates.push('matches_updated = ?');
    params.push(data.matches_updated);
  }
  if (data.error_message) {
    updates.push('error_message = ?');
    params.push(data.error_message);
  }
  if (data.execution_time_ms !== undefined) {
    updates.push('execution_time_ms = ?');
    params.push(data.execution_time_ms);
  }

  if (updates.length === 0) return;

  params.push(logId);
  await db.query(`UPDATE fff_scraping_logs SET ${updates.join(', ')} WHERE id = ?`, params);
}

// Fonction principale de scraping avec Puppeteer
async function scrapeWithPuppeteer() {
  scraperLogger.info('Démarrage du navigateur Puppeteer...');

  const browser = await puppeteer.launch({
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

  try {
    const page = await browser.newPage();

    // Configuration de la page
    await page.setUserAgent(CONFIG.userAgent);
    await page.setViewport({ width: 1920, height: 1080 });

    // Intercepter les requêtes pour optimiser le chargement
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    scraperLogger.info(`Navigation vers: ${CONFIG.clubUrl}`);

    // Naviguer vers la page du club
    await page.goto(CONFIG.clubUrl, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.timeout
    });

    // Attendre que le contenu soit chargé
    await page.waitForSelector('body', { timeout: 10000 });

    // Extraire les données des équipes et matchs
    const data = await page.evaluate(() => {
      const teams = [];
      const matches = [];

      // Chercher les équipes dans la page
      // La structure exacte dépend du HTML du site FFF
      // On va chercher les différents patterns possibles

      // Pattern 1: Tableaux de matchs
      document.querySelectorAll('table, .match-list, .results, .fixtures').forEach((table) => {
        const rows = table.querySelectorAll('tr, .match-row, .match-item');
        rows.forEach((row) => {
          const cells = row.querySelectorAll('td, .cell, .team, .score, .date');
          if (cells.length >= 2) {
            matches.push({
              html: row.innerHTML,
              text: row.innerText
            });
          }
        });
      });

      // Pattern 2: Cartes de matchs
      document.querySelectorAll('[class*="match"], [class*="game"], [class*="fixture"]').forEach((el) => {
        matches.push({
          html: el.innerHTML,
          text: el.innerText
        });
      });

      // Pattern 3: Liens vers les équipes
      document.querySelectorAll('a[href*="equipe"], a[href*="team"]').forEach((link) => {
        teams.push({
          href: link.href,
          text: link.innerText.trim()
        });
      });

      // Récupérer tout le contenu HTML pour analyse
      return {
        teams,
        matches,
        fullHtml: document.body.innerHTML,
        url: window.location.href
      };
    });

    scraperLogger.debug(`Page chargée: ${data.url}`);
    scraperLogger.debug(`Équipes trouvées: ${data.teams.length}`);
    scraperLogger.debug(`Éléments match trouvés: ${data.matches.length}`);

    // Récupérer les liens vers les calendriers des équipes
    const teamLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a').forEach((a) => {
        const href = a.href;
        // Chercher les liens de calendrier/résultats
        if (href && (
          href.includes('/calendrier') ||
          href.includes('/resultats') ||
          href.includes('/matchs') ||
          href.includes('/equipe/')
        )) {
          links.push({
            href: href,
            text: a.innerText.trim()
          });
        }
      });
      return links;
    });

    scraperLogger.info(`Liens calendrier/résultats trouvés: ${teamLinks.length}`);

    // Sauvegarder le HTML pour analyse
    if (VERBOSE) {
      const htmlPath = path.join(LOG_DIR, 'fff_page_dump.html');
      fs.writeFileSync(htmlPath, data.fullHtml);
      scraperLogger.debug(`HTML sauvegardé dans: ${htmlPath}`);
    }

    return {
      teams: data.teams,
      matches: data.matches,
      teamLinks,
      success: true
    };

  } finally {
    await browser.close();
    scraperLogger.info('Navigateur fermé');
  }
}

// Scraper les matchs d'une équipe spécifique
async function scrapeTeamMatches(browser, teamUrl) {
  scraperLogger.debug(`Scraping équipe: ${teamUrl}`);

  const page = await browser.newPage();

  try {
    await page.setUserAgent(CONFIG.userAgent);

    // Optimiser le chargement
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(teamUrl, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.timeout
    });

    // Extraire les matchs
    const matches = await page.evaluate(() => {
      const results = [];

      // Chercher tous les éléments de match possibles
      document.querySelectorAll('[class*="match"], [class*="rencontre"], tr').forEach((el) => {
        const text = el.innerText;

        // Pattern de match: date, équipes, score
        const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
        const scoreMatch = text.match(/(\d+)\s*[-:]\s*(\d+)/);

        if (dateMatch || scoreMatch) {
          results.push({
            text: text.trim(),
            html: el.innerHTML,
            date: dateMatch ? dateMatch[1] : null,
            score: scoreMatch ? `${scoreMatch[1]}-${scoreMatch[2]}` : null
          });
        }
      });

      return results;
    });

    return matches;

  } finally {
    await page.close();
  }
}

// Parser les données de match extraites
function parseMatchData(rawMatch, teamName = null) {
  const text = rawMatch.text || rawMatch.html || '';

  // Patterns pour extraire les données
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,  // DD/MM/YYYY ou DD-MM-YYYY
    /(\d{1,2})\s+(jan|fév|mar|avr|mai|juin|juil|août|sept|oct|nov|déc)\S*\s+(\d{4})/i
  ];

  const timePattern = /(\d{1,2})[h:](\d{2})/;
  const scorePattern = /(\d+)\s*[-:]\s*(\d+)/;

  let parsedDate = null;
  let parsedTime = null;
  let score = null;

  // Extraire la date
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2].match(/\d+/)) {
        // Format numérique
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const year = match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3]);
        parsedDate = new Date(year, month - 1, day);
      }
      break;
    }
  }

  // Extraire l'heure
  const timeMatch = text.match(timePattern);
  if (timeMatch) {
    parsedTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
  }

  // Extraire le score
  const scoreMatch = text.match(scorePattern);
  if (scoreMatch) {
    score = {
      home: parseInt(scoreMatch[1]),
      away: parseInt(scoreMatch[2])
    };
  }

  // Déterminer si c'est domicile ou extérieur
  const isHome = text.toLowerCase().includes('magny') &&
                 text.toLowerCase().indexOf('magny') < text.length / 2;

  return {
    date: parsedDate,
    time: parsedTime,
    score,
    isHome,
    rawText: text,
    teamName
  };
}

// Fonction pour faire correspondre une équipe FFF à une équipe locale
async function matchTeamToLocal(fffTeamName) {
  const [teams] = await db.query('SELECT id, nom, slug, fff_team_id FROM equipes WHERE actif = 1');

  // Normaliser le nom FFF
  const normalized = fffTeamName.toLowerCase()
    .replace(/magny\s*(fc\s*)?78?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Correspondances connues
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
    'veteran': ['veterans-1', 'veterans-2']
  };

  // Chercher une correspondance
  for (const [pattern, slugs] of Object.entries(mappings)) {
    if (normalized.includes(pattern)) {
      const team = teams.find(t => slugs.includes(t.slug));
      if (team) return team;
    }
  }

  // Recherche par fff_team_id si défini
  const teamByFffId = teams.find(t => t.fff_team_id && normalized.includes(t.fff_team_id));
  if (teamByFffId) return teamByFffId;

  return null;
}

// Insérer ou mettre à jour un match
async function upsertMatch(matchData) {
  if (!matchData.fff_id) {
    scraperLogger.warn('Match sans fff_id, ignoré');
    return { action: 'skipped' };
  }

  // Vérifier si le match existe déjà
  const [existing] = await db.query(
    'SELECT id, score_domicile, score_exterieur, statut FROM matchs WHERE fff_id = ?',
    [matchData.fff_id]
  );

  if (existing.length > 0) {
    // Mise à jour du match existant
    const updates = [];
    const params = [];

    // Mettre à jour le score si disponible
    if (matchData.score_domicile !== null && matchData.score_domicile !== undefined) {
      updates.push('score_domicile = ?', 'score_exterieur = ?', 'statut = ?');
      params.push(matchData.score_domicile, matchData.score_exterieur, 'termine');
    }

    // Toujours mettre à jour la date de synchro
    updates.push('fff_synced_at = NOW()');

    if (updates.length > 1) {
      params.push(existing[0].id);
      await db.query(
        `UPDATE matchs SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      scraperLogger.debug(`Match mis à jour: ${matchData.fff_id}`);
      return { action: 'updated', id: existing[0].id };
    }

    return { action: 'unchanged', id: existing[0].id };
  }

  // Insertion d'un nouveau match
  const sql = `
    INSERT INTO matchs (
      equipe_id, adversaire, date_match, lieu, competition, journee,
      score_domicile, score_exterieur, statut, visible,
      fff_id, fff_competition_id, fff_url, fff_home_team, fff_away_team,
      fff_home_logo, fff_away_logo, fff_venue, fff_synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  const params = [
    matchData.equipe_id,
    matchData.adversaire,
    matchData.date_match,
    matchData.lieu || 'domicile',
    matchData.competition || 'Championnat',
    matchData.journee || null,
    matchData.score_domicile || null,
    matchData.score_exterieur || null,
    matchData.statut || 'a_venir',
    true, // visible
    matchData.fff_id,
    matchData.fff_competition_id || null,
    matchData.fff_url || null,
    matchData.fff_home_team || null,
    matchData.fff_away_team || null,
    matchData.fff_home_logo || null,
    matchData.fff_away_logo || null,
    matchData.fff_venue || null
  ];

  const [result] = await db.query(sql, params);
  scraperLogger.debug(`Nouveau match inséré: ${matchData.fff_id} (ID: ${result.insertId})`);

  return { action: 'inserted', id: result.insertId };
}

// Fonction principale de scraping améliorée avec API FFF
async function scrapeFFSApi() {
  scraperLogger.info('Tentative de récupération via API FFF...');

  // L'API FFF utilise des endpoints JSON
  // Format: https://epreuves.fff.fr/api/clubs/{clubId}/matchs
  // ou similaire

  const axios = require('axios');

  const endpoints = [
    `https://epreuves.fff.fr/api/competition/club/${CONFIG.clubId}/matchs`,
    `https://epreuves.fff.fr/api/clubs/${CONFIG.clubId}/calendrier`,
    `https://epreuves.fff.fr/competition/club/${CONFIG.clubId}-magny-78-f-c/matchs.json`
  ];

  for (const endpoint of endpoints) {
    try {
      scraperLogger.debug(`Essai endpoint: ${endpoint}`);

      const response = await axios.get(endpoint, {
        headers: {
          'User-Agent': CONFIG.userAgent,
          'Accept': 'application/json',
          'Referer': CONFIG.clubUrl
        },
        timeout: 30000
      });

      if (response.data) {
        scraperLogger.info(`API réponse reçue de: ${endpoint}`);
        return response.data;
      }
    } catch (error) {
      scraperLogger.debug(`Endpoint ${endpoint} échoué: ${error.message}`);
    }
  }

  return null;
}

// Scraping complet avec Puppeteer
async function fullPuppeteerScrape() {
  scraperLogger.info('Démarrage du scraping complet avec Puppeteer...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });

  const allMatches = [];
  const allTeams = [];

  try {
    const page = await browser.newPage();
    await page.setUserAgent(CONFIG.userAgent);
    await page.setViewport({ width: 1920, height: 1080 });

    scraperLogger.info(`Navigation vers ${CONFIG.clubUrl}`);

    await page.goto(CONFIG.clubUrl, {
      waitUntil: 'networkidle0',
      timeout: CONFIG.timeout
    });

    // Attendre le chargement complet
    await page.waitForTimeout(3000);

    // Prendre une capture d'écran pour debug
    if (VERBOSE) {
      const screenshotPath = path.join(LOG_DIR, 'fff_screenshot.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      scraperLogger.debug(`Screenshot sauvegardé: ${screenshotPath}`);
    }

    // Extraire les données de la page
    const pageData = await page.evaluate(() => {
      const data = {
        title: document.title,
        teams: [],
        matches: [],
        links: []
      };

      // Chercher les équipes
      document.querySelectorAll('[data-team], .team, .equipe, [class*="team"], [class*="equipe"]').forEach((el) => {
        data.teams.push({
          text: el.innerText.trim(),
          id: el.dataset.team || el.dataset.id || null
        });
      });

      // Chercher les matchs
      document.querySelectorAll('[data-match], .match, .rencontre, [class*="match"], [class*="rencontre"], [class*="fixture"]').forEach((el) => {
        data.matches.push({
          text: el.innerText.trim(),
          id: el.dataset.match || el.dataset.id || null,
          html: el.innerHTML
        });
      });

      // Chercher les liens vers les calendriers
      document.querySelectorAll('a[href*="calendrier"], a[href*="equipe"], a[href*="competition"]').forEach((a) => {
        data.links.push({
          href: a.href,
          text: a.innerText.trim()
        });
      });

      // Chercher dans les tableaux
      document.querySelectorAll('table tbody tr').forEach((tr) => {
        const cells = tr.querySelectorAll('td');
        if (cells.length >= 3) {
          const rowText = Array.from(cells).map(c => c.innerText.trim()).join(' | ');
          data.matches.push({
            text: rowText,
            id: null,
            html: tr.innerHTML
          });
        }
      });

      return data;
    });

    scraperLogger.info(`Page title: ${pageData.title}`);
    scraperLogger.info(`Équipes trouvées: ${pageData.teams.length}`);
    scraperLogger.info(`Matchs trouvés: ${pageData.matches.length}`);
    scraperLogger.info(`Liens trouvés: ${pageData.links.length}`);

    // Sauvegarder les données brutes pour analyse
    if (VERBOSE) {
      const dataPath = path.join(LOG_DIR, 'fff_data.json');
      fs.writeFileSync(dataPath, JSON.stringify(pageData, null, 2));
      scraperLogger.debug(`Données sauvegardées: ${dataPath}`);
    }

    // Parser les matchs trouvés
    for (const rawMatch of pageData.matches) {
      const parsed = parseMatchFromText(rawMatch.text);
      if (parsed) {
        allMatches.push({
          ...parsed,
          source: 'puppeteer',
          rawId: rawMatch.id
        });
      }
    }

    // Explorer les liens de calendrier
    for (const link of pageData.links.slice(0, 10)) { // Limiter à 10 liens
      if (link.href && !link.href.includes('javascript:')) {
        try {
          scraperLogger.debug(`Exploration: ${link.text} - ${link.href}`);

          await page.goto(link.href, {
            waitUntil: 'networkidle2',
            timeout: 30000
          });

          await page.waitForTimeout(2000);

          const subPageData = await page.evaluate(() => {
            const matches = [];

            document.querySelectorAll('table tbody tr, [class*="match"], [class*="rencontre"]').forEach((el) => {
              matches.push({
                text: el.innerText.trim(),
                html: el.innerHTML
              });
            });

            return { matches, url: window.location.href };
          });

          scraperLogger.debug(`Sous-page ${link.text}: ${subPageData.matches.length} matchs`);

          for (const rawMatch of subPageData.matches) {
            const parsed = parseMatchFromText(rawMatch.text);
            if (parsed) {
              allMatches.push({
                ...parsed,
                source: link.text,
                sourceUrl: subPageData.url
              });
            }
          }

        } catch (err) {
          scraperLogger.warn(`Erreur exploration ${link.href}: ${err.message}`);
        }
      }
    }

    return {
      teams: pageData.teams,
      matches: allMatches,
      links: pageData.links,
      success: true
    };

  } finally {
    await browser.close();
  }
}

// Parser un match depuis le texte brut
function parseMatchFromText(text) {
  if (!text || text.length < 10) return null;

  // Patterns de date
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
    /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i,
    /(\d{1,2})\s+(jan|fév|mar|avr|mai|juin|juil|août|sept|oct|nov|déc)\.?\s+(\d{4})/i
  ];

  const monthMap = {
    'janvier': 1, 'jan': 1,
    'février': 2, 'fév': 2,
    'mars': 3, 'mar': 3,
    'avril': 4, 'avr': 4,
    'mai': 5,
    'juin': 6,
    'juillet': 7, 'juil': 7,
    'août': 8,
    'septembre': 9, 'sept': 9,
    'octobre': 10, 'oct': 10,
    'novembre': 11, 'nov': 11,
    'décembre': 12, 'déc': 12
  };

  let matchDate = null;
  let matchTime = null;

  // Extraire la date
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const day = parseInt(match[1]);
      let month, year;

      if (isNaN(parseInt(match[2]))) {
        // Format texte pour le mois
        month = monthMap[match[2].toLowerCase()] || monthMap[match[2].substring(0, 3).toLowerCase()];
        year = parseInt(match[3]);
      } else {
        month = parseInt(match[2]);
        year = match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3]);
      }

      if (day && month && year) {
        matchDate = new Date(year, month - 1, day);
      }
      break;
    }
  }

  // Extraire l'heure
  const timeMatch = text.match(/(\d{1,2})[h:](\d{2})/);
  if (timeMatch) {
    matchTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    if (matchDate) {
      matchDate.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]));
    }
  }

  // Extraire le score
  const scoreMatch = text.match(/(\d+)\s*[-–]\s*(\d+)/);
  let scoreHome = null, scoreAway = null;
  if (scoreMatch) {
    scoreHome = parseInt(scoreMatch[1]);
    scoreAway = parseInt(scoreMatch[2]);
  }

  // Extraire les équipes
  const teams = text.split(/\s*[-–vs.]+\s*/).filter(t => t.length > 2);
  let homeTeam = null, awayTeam = null, adversaire = null;

  const isMagny = (str) => /magny/i.test(str);

  if (teams.length >= 2) {
    // Nettoyer les noms d'équipes
    const cleanTeam = (t) => t.replace(/\d+[h:]\d+|\d+[-–]\d+|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, '').trim();

    homeTeam = cleanTeam(teams[0]);
    awayTeam = cleanTeam(teams[1]);

    if (isMagny(homeTeam)) {
      adversaire = awayTeam;
    } else if (isMagny(awayTeam)) {
      adversaire = homeTeam;
    }
  }

  // Vérifier si c'est un match de Magny
  if (!isMagny(text)) {
    return null; // Ignorer les matchs qui ne concernent pas Magny
  }

  // Générer un ID unique
  const fffId = matchDate
    ? `fff-${matchDate.toISOString().split('T')[0]}-${(adversaire || 'unknown').replace(/\s+/g, '-').toLowerCase().substring(0, 20)}`
    : null;

  if (!matchDate && !adversaire) {
    return null;
  }

  return {
    fff_id: fffId,
    date_match: matchDate,
    adversaire: adversaire,
    lieu: isMagny(homeTeam) ? 'domicile' : 'exterieur',
    score_domicile: isMagny(homeTeam) ? scoreHome : scoreAway,
    score_exterieur: isMagny(homeTeam) ? scoreAway : scoreHome,
    statut: scoreHome !== null ? 'termine' : 'a_venir',
    fff_home_team: homeTeam,
    fff_away_team: awayTeam,
    rawText: text
  };
}

// Fonction principale
async function main() {
  const startTime = Date.now();
  scraperLogger.info('='.repeat(60));
  scraperLogger.info(`Scraper FFF démarré - ${new Date().toISOString()}`);
  scraperLogger.info(`Mode: ${DRY_RUN ? 'DRY RUN (pas d\'écriture)' : 'PRODUCTION'}`);
  scraperLogger.info('='.repeat(60));

  let scrapingLogId = null;
  let stats = {
    teamsFound: 0,
    matchesFound: 0,
    matchesInserted: 0,
    matchesUpdated: 0
  };

  try {
    // Connexion à la base de données
    await connectDatabase();

    // Créer le log de scraping
    const logEntry = await createScrapingLog();
    scrapingLogId = logEntry.id;

    // Essayer d'abord l'API
    let data = await scrapeFFSApi();

    // Si l'API ne fonctionne pas, utiliser Puppeteer
    if (!data || !data.matches || data.matches.length === 0) {
      scraperLogger.info('API non disponible, passage au scraping Puppeteer...');
      data = await fullPuppeteerScrape();
    }

    if (data && data.success) {
      stats.teamsFound = data.teams ? data.teams.length : 0;
      stats.matchesFound = data.matches ? data.matches.length : 0;

      scraperLogger.info(`Résultats: ${stats.teamsFound} équipes, ${stats.matchesFound} matchs`);

      // Récupérer les équipes locales
      const [localTeams] = await db.query('SELECT id, nom, slug, fff_team_id FROM equipes WHERE actif = 1');

      // Traiter les matchs
      if (data.matches && data.matches.length > 0) {
        for (const match of data.matches) {
          if (!match.fff_id) continue;

          // Trouver l'équipe locale correspondante
          let equipeId = null;

          // Pour l'instant, associer aux Seniors 1 par défaut
          // TODO: Améliorer la correspondance équipe
          const seniors = localTeams.find(t => t.slug === 'seniors-1');
          if (seniors) {
            equipeId = seniors.id;
          }

          if (!DRY_RUN) {
            const result = await upsertMatch({
              ...match,
              equipe_id: equipeId
            });

            if (result.action === 'inserted') {
              stats.matchesInserted++;
            } else if (result.action === 'updated') {
              stats.matchesUpdated++;
            }
          } else {
            scraperLogger.info(`[DRY RUN] Match: ${match.adversaire || 'N/A'} - ${match.date_match || 'N/A'}`);
          }
        }
      }

      scraperLogger.success(`Scraping terminé: ${stats.matchesInserted} insérés, ${stats.matchesUpdated} mis à jour`);

    } else {
      scraperLogger.warn('Aucune donnée récupérée');
    }

    // Mettre à jour le log de scraping
    const executionTime = Date.now() - startTime;
    await updateScrapingLog(scrapingLogId, {
      status: 'success',
      finished_at: true,
      teams_found: stats.teamsFound,
      matches_found: stats.matchesFound,
      matches_inserted: stats.matchesInserted,
      matches_updated: stats.matchesUpdated,
      execution_time_ms: executionTime
    });

    scraperLogger.info(`Temps d'exécution: ${executionTime}ms`);

  } catch (error) {
    scraperLogger.error(`Erreur fatale: ${error.message}`);
    scraperLogger.error(error.stack);

    // Mettre à jour le log avec l'erreur
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
    await closeDatabase();
    scraperLogger.info('='.repeat(60));
  }
}

// Exécution
main().catch((err) => {
  console.error('Erreur non gérée:', err);
  process.exit(1);
});

// Export pour utilisation comme module
module.exports = {
  main,
  CONFIG,
  parseMatchFromText
};

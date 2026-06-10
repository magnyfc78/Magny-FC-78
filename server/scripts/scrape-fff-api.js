#!/usr/bin/env node
/**
 * Scraper FFF via API DOFA
 * Utilise Puppeteer pour contourner le WAF et accéder à l'API JSON
 * Club: Magny FC 78 (clNo=25702)
 *
 * Endpoints:
 *   - GET /clubs/{clNo}/calendrier — matchs à venir
 *   - GET /clubs/{clNo}/resultat   — résultats (matchs terminés)
 *
 * Usage:
 *   node server/scripts/scrape-fff-api.js              # Exécution normale
 *   node server/scripts/scrape-fff-api.js --dry-run    # Mode test
 *   node server/scripts/scrape-fff-api.js --verbose    # Mode détaillé
 */

const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const ROOT_DIR = path.join(__dirname, '../..');
const LOG_DIR = path.join(ROOT_DIR, 'logs');

require('dotenv-flow').config({ path: ROOT_DIR, silent: true });

const mysql = require('mysql2/promise');

// Configuration
const CONFIG = {
  clubId: '25702',
  apiBase: 'https://api-dofa.fff.fr/api',
  retryAttempts: 3,
  retryDelay: 2000
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

// Logger
const logger = {
  logFile: path.join(LOG_DIR, 'scraping.log'),
  _formatDate() { return new Date().toISOString().replace('T', ' ').split('.')[0]; },
  _write(level, message) {
    const line = `${this._formatDate()} [${level}] ${message}`;
    console.log(line);
    try {
      if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
      fs.appendFileSync(this.logFile, line + '\n');
    } catch (err) {}
  },
  info(message) { this._write('INFO', message); },
  error(message) { this._write('ERROR', message); },
  warn(message) { this._write('WARN', message); },
  debug(message) { if (VERBOSE) this._write('DEBUG', message); },
  success(message) { this._write('SUCCESS', message); }
};

// Database
let db = null;

async function connectDatabase() {
  if (db) return db;
  db = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'magny_fc_78',
    waitForConnections: true,
    connectionLimit: 5,
    charset: 'utf8mb4'
  });
  await db.query('SELECT 1');
  logger.info('Connexion DB établie');
  return db;
}

async function closeDatabase() {
  if (db) { await db.end(); db = null; }
}

// Extraire la catégorie d'un nom
function extractCategory(name) {
  if (!name) return null;
  const s = name.toLowerCase().trim();
  const uMatch = s.match(/\bu(\d{1,2})\b/);
  if (uMatch) return `u${uMatch[1]}`;
  if (/\bseniors?\s*f\b/.test(s) || /\bf[ée]minin/.test(s)) return 'seniors f';
  if (/\bseniors?\b/.test(s)) return 'seniors';
  if (/\bv[ée]t[ée]rans?\b/.test(s)) return 'veterans';
  return null;
}

// Matching équipe FFF -> équipe locale
function matchLocalTeam(fffName, localTeams) {
  if (!fffName) return null;
  const fffLower = fffName.toLowerCase().trim();

  // Match exact
  const exact = localTeams.find(lt => lt.fff_nom && lt.fff_nom.toLowerCase().trim() === fffLower);
  if (exact) return exact;

  // Match inclusion
  const incl = localTeams.find(lt => {
    if (!lt.fff_nom) return false;
    const ltNom = lt.fff_nom.toLowerCase().trim();
    return fffLower.includes(ltNom) || ltNom.includes(fffLower);
  });
  if (incl) return incl;

  // Match catégorie
  const cat = extractCategory(fffName);
  if (cat) {
    const catMatch = localTeams.find(lt => lt.fff_nom && extractCategory(lt.fff_nom) === cat);
    if (catMatch) return catMatch;
  }

  return null;
}

// Fetch API via Puppeteer (contourne le WAF)
async function fetchAPI(page, endpoint) {
  const url = `${CONFIG.apiBase}${endpoint}`;
  logger.debug(`Fetching: ${url}`);

  const result = await page.evaluate(async (apiUrl) => {
    try {
      const res = await fetch(apiUrl, {
        headers: { 'Accept': 'application/ld+json, application/json' }
      });
      if (!res.ok) return { error: `HTTP ${res.status}`, status: res.status };
      return { data: await res.json(), status: res.status };
    } catch (e) {
      return { error: e.message };
    }
  }, url);

  if (result.error) {
    throw new Error(`API error: ${result.error}`);
  }

  return result.data;
}

// Parser un match de l'API
function parseMatch(m) {
  const match = {
    fffMatchId: m.ma_no || null,
    date: null,
    heure: null,
    homeTeam: null,
    awayTeam: null,
    scoreHome: null,
    scoreAway: null,
    competition: null,
    journee: null,
    terrain: null
  };

  // Date - format "2026-06-04T00:00:00+00:00"
  if (m.date) {
    try {
      const d = new Date(m.date);
      match.date = d.toISOString().split('T')[0];
    } catch (e) {}
  }

  // Heure - format "18H15"
  if (m.time) {
    match.heure = m.time.replace('H', ':');
  }

  // Équipes - structure: home.short_name, away.short_name
  match.homeTeam = m.home?.short_name || null;
  match.awayTeam = m.away?.short_name || null;

  // Scores
  match.scoreHome = m.home_score ?? null;
  match.scoreAway = m.away_score ?? null;

  // Compétition - structure: competition.name
  match.competition = m.competition?.name || null;

  // Journée - structure: poule_journee.number
  match.journee = m.poule_journee?.number ?? m.poule_journee?.name ?? null;

  // Terrain
  match.terrain = m.terrain?.name || null;

  return match;
}

// Sauvegarder un match
async function saveMatch(matchData, localTeams, statut) {
  const isMagnyHome = /magny/i.test(matchData.homeTeam || '');
  const isMagnyAway = /magny/i.test(matchData.awayTeam || '');

  if (!isMagnyHome && !isMagnyAway) {
    return { action: 'skipped', reason: 'not_magny' };
  }

  const adversaire = isMagnyHome ? matchData.awayTeam : matchData.homeTeam;
  const lieu = isMagnyHome ? 'domicile' : 'exterieur';

  // Trouver équipe locale
  const localTeam = matchLocalTeam(matchData.competition, localTeams);
  if (!localTeam) {
    logger.debug(`SKIP: Pas d'équipe locale pour "${matchData.competition}"`);
    return { action: 'skipped', reason: 'no_local_team' };
  }

  const fffId = matchData.fffMatchId ? `fff-${matchData.fffMatchId}` :
    `fff-${matchData.date}-${(adversaire || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}`;

  const [existing] = await db.query('SELECT id FROM matchs WHERE fff_id = ?', [fffId]);

  let dateMatch = null;
  if (matchData.date) {
    dateMatch = `${matchData.date} ${matchData.heure || '15:00'}:00`;
  }

  const scoreHome = statut === 'termine' ? (isMagnyHome ? matchData.scoreHome : matchData.scoreAway) : null;
  const scoreAway = statut === 'termine' ? (isMagnyHome ? matchData.scoreAway : matchData.scoreHome) : null;

  if (existing.length > 0) {
    await db.query(`
      UPDATE matchs SET
        score_domicile = COALESCE(?, score_domicile),
        score_exterieur = COALESCE(?, score_exterieur),
        statut = ?, fff_synced_at = NOW()
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
    localTeam.id, adversaire || 'Inconnu', dateMatch, lieu,
    matchData.competition || 'Championnat', matchData.journee,
    scoreHome, scoreAway, statut,
    fffId, matchData.homeTeam, matchData.awayTeam
  ]);

  return { action: 'inserted', id: result.insertId };
}

// Scraping log
async function createScrapingLog() {
  if (DRY_RUN) return { id: null };
  const [result] = await db.query(`INSERT INTO fff_scraping_logs (started_at, status) VALUES (NOW(), 'running')`);
  return { id: result.insertId };
}

async function updateScrapingLog(logId, data) {
  if (DRY_RUN || !logId) return;
  const updates = [], params = [];
  for (const [k, v] of Object.entries(data)) {
    if (k === 'finished_at') updates.push('finished_at = NOW()');
    else if (v !== undefined) { updates.push(`${k} = ?`); params.push(v); }
  }
  if (updates.length) {
    params.push(logId);
    await db.query(`UPDATE fff_scraping_logs SET ${updates.join(', ')} WHERE id = ?`, params);
  }
}

// Main
async function main() {
  const startTime = Date.now();
  logger.info('='.repeat(60));
  logger.info(`Scraper FFF API - ${new Date().toISOString()}`);
  logger.info(`Mode: ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}`);
  logger.info('='.repeat(60));

  let browser = null;
  let scrapingLogId = null;
  const stats = { found: 0, inserted: 0, updated: 0, skipped: 0 };

  try {
    await connectDatabase();
    const logEntry = await createScrapingLog();
    scrapingLogId = logEntry.id;

    // Équipes locales
    const [localTeams] = await db.query('SELECT id, nom, slug, fff_nom FROM equipes WHERE actif = 1');
    logger.info(`Équipes locales avec fff_nom:`);
    localTeams.filter(t => t.fff_nom).forEach(t => logger.info(`  - ${t.nom} -> "${t.fff_nom}"`));

    // Lancer navigateur
    logger.info('\nLancement du navigateur...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // Visiter d'abord le site FFF pour obtenir les cookies
    logger.info('Chargement du contexte FFF...');
    await page.goto('https://www.fff.fr/', { waitUntil: 'networkidle2', timeout: 30000 });

    // Récupérer calendrier (matchs à venir)
    logger.info('\n--- Récupération du CALENDRIER ---');
    try {
      const calendrier = await fetchAPI(page, `/clubs/${CONFIG.clubId}/calendrier?itemsPerPage=200`);
      const items = calendrier['hydra:member'] || calendrier.member || calendrier || [];
      logger.info(`Calendrier: ${items.length} matchs à venir`);

      for (const m of items) {
        const parsed = parseMatch(m);
        logger.debug(`  ${parsed.date} ${parsed.homeTeam} vs ${parsed.awayTeam} - ${parsed.competition}`);
        stats.found++;
        if (!DRY_RUN) {
          const res = await saveMatch(parsed, localTeams, 'a_venir');
          if (res.action === 'inserted') stats.inserted++;
          else if (res.action === 'updated') stats.updated++;
          else stats.skipped++;
        }
      }
    } catch (err) {
      logger.error(`Erreur calendrier: ${err.message}`);
    }

    // Récupérer résultats (matchs terminés)
    logger.info('\n--- Récupération des RÉSULTATS ---');
    try {
      const resultats = await fetchAPI(page, `/clubs/${CONFIG.clubId}/resultat?itemsPerPage=200`);
      const items = resultats['hydra:member'] || resultats.member || resultats || [];
      logger.info(`Résultats: ${items.length} matchs terminés`);

      for (const m of items) {
        const parsed = parseMatch(m);
        logger.debug(`  ${parsed.date} ${parsed.homeTeam} ${parsed.scoreHome}-${parsed.scoreAway} ${parsed.awayTeam}`);
        stats.found++;
        if (!DRY_RUN) {
          const res = await saveMatch(parsed, localTeams, 'termine');
          if (res.action === 'inserted') stats.inserted++;
          else if (res.action === 'updated') stats.updated++;
          else stats.skipped++;
        }
      }
    } catch (err) {
      logger.error(`Erreur résultats: ${err.message}`);
    }

    // Résumé
    logger.info('\n' + '='.repeat(60));
    logger.success('RÉSUMÉ:');
    logger.info(`  Trouvés: ${stats.found}`);
    logger.info(`  Insérés: ${stats.inserted}`);
    logger.info(`  Mis à jour: ${stats.updated}`);
    logger.info(`  Ignorés: ${stats.skipped}`);
    logger.info(`  Temps: ${Date.now() - startTime}ms`);

    await updateScrapingLog(scrapingLogId, {
      status: 'success', finished_at: true,
      matches_found: stats.found, matches_inserted: stats.inserted,
      matches_updated: stats.updated, execution_time_ms: Date.now() - startTime
    });

  } catch (error) {
    logger.error(`Erreur fatale: ${error.message}`);
    logger.error(error.stack);
    if (scrapingLogId) {
      await updateScrapingLog(scrapingLogId, {
        status: 'error', finished_at: true,
        error_message: error.message, execution_time_ms: Date.now() - startTime
      });
    }
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    await closeDatabase();
    logger.info('='.repeat(60));
  }
}

main().catch(err => { console.error('Erreur:', err); process.exit(1); });

module.exports = { main, CONFIG };

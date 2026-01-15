/**
 * Routes Matchs - API REST sécurisée
 * Supporte les filtres par équipe, statut, et source FFF
 */

const express = require('express');
const db = require('../config/database');
const { protect, restrictTo } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validator');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Mapping des noms d'équipes pour les filtres
const TEAM_SLUGS = {
  'seniors': ['seniors-1', 'seniors-2'],
  'seniors1': ['seniors-1'],
  'seniors2': ['seniors-2'],
  'feminines': ['seniors-feminines'],
  'veterans': ['veterans-1', 'veterans-2'],
  'u19': ['u19'],
  'u17': ['u17'],
  'u15': ['u15'],
  'u13': ['u13'],
  'u11': ['u11'],
  'u9': ['u9'],
  'u7': ['u7']
};

// Mapping des statuts pour les filtres
const STATUS_MAP = {
  'upcoming': 'a_venir',
  'a_venir': 'a_venir',
  'live': 'en_cours',
  'en_cours': 'en_cours',
  'finished': 'termine',
  'termine': 'termine',
  'postponed': 'reporte',
  'reporte': 'reporte',
  'cancelled': 'annule',
  'annule': 'annule'
};

// Helper pour formater les matchs
const formatMatch = (match) => {
  const date = new Date(match.date_match);
  const options = { day: '2-digit', month: 'short' };
  const optionsLong = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

  return {
    ...match,
    date_formatee: date.toLocaleDateString('fr-FR', options),
    date_complete: date.toLocaleDateString('fr-FR', optionsLong),
    heure: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    timestamp: date.getTime(),
    domicile: match.lieu === 'domicile',
    equipe_dom: match.lieu === 'domicile' ? 'Magny FC 78' : match.adversaire,
    equipe_ext: match.lieu === 'domicile' ? match.adversaire : 'Magny FC 78',
    score_dom: match.lieu === 'domicile' ? match.score_domicile : match.score_exterieur,
    score_ext: match.lieu === 'domicile' ? match.score_exterieur : match.score_domicile,
    from_fff: !!match.fff_id,
    resultat: match.statut === 'termine' ? (
      (match.lieu === 'domicile' && match.score_domicile > match.score_exterieur) ||
      (match.lieu === 'exterieur' && match.score_exterieur > match.score_domicile)
        ? 'victoire'
        : (match.score_domicile === match.score_exterieur ? 'nul' : 'defaite')
    ) : null
  };
};

// =====================================================
// GET /api/matchs - Liste des matchs avec filtres avancés
// =====================================================
// Query params:
//   - type/status: upcoming, finished, live, all (défaut: all)
//   - team: seniors, u19, u17, etc. ou ID numérique
//   - equipe_id: ID numérique de l'équipe
//   - from_date: date minimum (YYYY-MM-DD)
//   - to_date: date maximum (YYYY-MM-DD)
//   - competition: filtre par compétition
//   - fff_only: true pour n'afficher que les matchs FFF
//   - limit: nombre de résultats (défaut: 20, max: 100)
//   - page: numéro de page (défaut: 1)
//   - sort: date_asc, date_desc (défaut: selon le type)
// =====================================================
router.get('/', async (req, res, next) => {
  try {
    const {
      type = 'all',
      status,
      team,
      equipe_id,
      from_date,
      to_date,
      competition,
      fff_only,
      limit = 20,
      page = 1,
      sort
    } = req.query;

    const effectiveLimit = Math.min(parseInt(limit) || 20, 100);
    const effectivePage = Math.max(parseInt(page) || 1, 1);
    const offset = (effectivePage - 1) * effectiveLimit;

    // Déterminer le statut effectif
    const effectiveStatus = status || type;
    const dbStatus = STATUS_MAP[effectiveStatus.toLowerCase()];

    let sql = `
      SELECT m.*,
             e.nom as equipe_nom,
             e.slug as equipe_slug,
             c.nom as categorie
      FROM matchs m
      LEFT JOIN equipes e ON m.equipe_id = e.id
      LEFT JOIN categories c ON e.categorie_id = c.id
      WHERE m.visible = 1
    `;
    let countSql = `
      SELECT COUNT(*) as total
      FROM matchs m
      LEFT JOIN equipes e ON m.equipe_id = e.id
      WHERE m.visible = 1
    `;
    const params = [];
    const countParams = [];

    // Filtre par statut
    if (dbStatus && effectiveStatus !== 'all' && effectiveStatus !== 'tous') {
      sql += ' AND m.statut = ?';
      countSql += ' AND m.statut = ?';
      params.push(dbStatus);
      countParams.push(dbStatus);
    }

    // Filtre par équipe (par nom)
    if (team) {
      const teamLower = team.toLowerCase().replace(/[^a-z0-9]/g, '');
      const slugs = TEAM_SLUGS[teamLower];

      if (slugs) {
        sql += ` AND e.slug IN (${slugs.map(() => '?').join(', ')})`;
        countSql += ` AND e.slug IN (${slugs.map(() => '?').join(', ')})`;
        params.push(...slugs);
        countParams.push(...slugs);
      } else {
        // Recherche par nom partiel
        sql += ' AND (e.nom LIKE ? OR e.slug LIKE ?)';
        countSql += ' AND (e.nom LIKE ? OR e.slug LIKE ?)';
        params.push(`%${team}%`, `%${team}%`);
        countParams.push(`%${team}%`, `%${team}%`);
      }
    }

    // Filtre par equipe_id
    if (equipe_id) {
      sql += ' AND m.equipe_id = ?';
      countSql += ' AND m.equipe_id = ?';
      params.push(parseInt(equipe_id));
      countParams.push(parseInt(equipe_id));
    }

    // Filtre par date
    if (from_date) {
      sql += ' AND m.date_match >= ?';
      countSql += ' AND m.date_match >= ?';
      params.push(from_date);
      countParams.push(from_date);
    }

    if (to_date) {
      sql += ' AND m.date_match <= ?';
      countSql += ' AND m.date_match <= ?';
      params.push(`${to_date} 23:59:59`);
      countParams.push(`${to_date} 23:59:59`);
    }

    // Filtre par compétition
    if (competition) {
      sql += ' AND m.competition LIKE ?';
      countSql += ' AND m.competition LIKE ?';
      params.push(`%${competition}%`);
      countParams.push(`%${competition}%`);
    }

    // Filtre FFF only
    if (fff_only === 'true' || fff_only === '1') {
      sql += ' AND m.fff_id IS NOT NULL';
      countSql += ' AND m.fff_id IS NOT NULL';
    }

    // Tri
    let orderBy = 'm.date_match';
    let orderDir = 'ASC';

    if (sort) {
      if (sort === 'date_desc' || sort === 'desc') {
        orderDir = 'DESC';
      }
    } else {
      // Tri par défaut selon le statut
      if (dbStatus === 'termine') {
        orderDir = 'DESC';
      } else if (dbStatus === 'a_venir') {
        orderDir = 'ASC';
      }
    }

    sql += ` ORDER BY ${orderBy} ${orderDir}`;
    sql += ' LIMIT ? OFFSET ?';
    params.push(effectiveLimit, offset);

    // Exécuter les requêtes
    const [matchs, countResult] = await Promise.all([
      db.query(sql, params),
      db.query(countSql, countParams)
    ]);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / effectiveLimit);

    res.json({
      success: true,
      data: {
        matchs: matchs.map(formatMatch),
        pagination: {
          total,
          page: effectivePage,
          limit: effectiveLimit,
          totalPages,
          hasNext: effectivePage < totalPages,
          hasPrev: effectivePage > 1
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/matchs/:id - Détail d'un match
// =====================================================
router.get('/:id', async (req, res, next) => {
  try {
    const matchs = await db.query(`
      SELECT m.*, e.nom as equipe_nom, c.nom as categorie
      FROM matchs m
      LEFT JOIN equipes e ON m.equipe_id = e.id
      LEFT JOIN categories c ON e.categorie_id = c.id
      WHERE m.id = ?
    `, [req.params.id]);

    if (!matchs.length) {
      throw new AppError('Match non trouvé.', 404);
    }

    res.json({
      success: true,
      data: { match: formatMatch(matchs[0]) }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/matchs - Créer un match (Admin)
// =====================================================
router.post('/', protect, restrictTo('admin'), validate(schemas.match), async (req, res, next) => {
  try {
    const { equipe_id, adversaire, date_match, lieu, competition } = req.body;

    const result = await db.query(`
      INSERT INTO matchs (equipe_id, adversaire, date_match, lieu, competition, statut)
      VALUES (?, ?, ?, ?, ?, 'a_venir')
    `, [equipe_id, adversaire, date_match, lieu, competition]);

    const match = await db.query('SELECT * FROM matchs WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Match créé',
      data: { match: formatMatch(match[0]) }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// PATCH /api/matchs/:id/score - Mettre à jour le score (Admin)
// =====================================================
router.patch('/:id/score', protect, restrictTo('admin'), validate(schemas.score), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { score_domicile, score_exterieur } = req.body;

    const existing = await db.query('SELECT id FROM matchs WHERE id = ?', [id]);
    if (!existing.length) {
      throw new AppError('Match non trouvé.', 404);
    }

    await db.query(`
      UPDATE matchs 
      SET score_domicile = ?, score_exterieur = ?, statut = 'termine'
      WHERE id = ?
    `, [score_domicile, score_exterieur, id]);

    const match = await db.query('SELECT * FROM matchs WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Score mis à jour',
      data: { match: formatMatch(match[0]) }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// DELETE /api/matchs/:id - Supprimer un match (Admin)
// =====================================================
router.delete('/:id', protect, restrictTo('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT id FROM matchs WHERE id = ?', [id]);
    if (!existing.length) {
      throw new AppError('Match non trouvé.', 404);
    }

    await db.query('DELETE FROM matchs WHERE id = ?', [id]);

    res.json({ success: true, message: 'Match supprimé' });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/matchs/scraping/status - Statut du scraping FFF
// =====================================================
router.get('/scraping/status', protect, restrictTo('admin'), async (req, res, next) => {
  try {
    // Dernière exécution
    const lastRuns = await db.query(`
      SELECT * FROM fff_scraping_logs
      ORDER BY started_at DESC
      LIMIT 5
    `);

    // Statistiques globales
    const stats = await db.query(`
      SELECT
        COUNT(*) as total_matchs,
        SUM(CASE WHEN fff_id IS NOT NULL THEN 1 ELSE 0 END) as matchs_fff,
        SUM(CASE WHEN statut = 'a_venir' THEN 1 ELSE 0 END) as matchs_a_venir,
        SUM(CASE WHEN statut = 'termine' THEN 1 ELSE 0 END) as matchs_termines,
        MAX(fff_synced_at) as derniere_synchro
      FROM matchs
    `);

    res.json({
      success: true,
      data: {
        lastRuns: lastRuns || [],
        stats: stats[0] || {},
        nextScheduledRun: '06:00 (quotidien)'
      }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/matchs/scraping/run - Lancer le scraping manuellement (Admin)
// =====================================================
router.post('/scraping/run', protect, restrictTo('admin'), async (req, res, next) => {
  try {
    const { spawn } = require('child_process');
    const path = require('path');

    const scriptPath = path.join(__dirname, '../scripts/scrape-fff.js');
    const dryRun = req.body.dry_run === true;

    const args = dryRun ? ['--dry-run', '--verbose'] : ['--verbose'];

    // Lancer le script en arrière-plan
    const child = spawn('node', [scriptPath, ...args], {
      detached: true,
      stdio: 'ignore'
    });

    child.unref();

    res.json({
      success: true,
      message: dryRun
        ? 'Scraping lancé en mode test (dry-run)'
        : 'Scraping lancé en arrière-plan',
      data: {
        pid: child.pid,
        mode: dryRun ? 'dry-run' : 'production'
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;

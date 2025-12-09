/**
 * Routes Matchs - API REST sécurisée
 */

const express = require('express');
const db = require('../config/database');
const { protect, restrictTo } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validator');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Helper pour formater les matchs
const formatMatch = (match) => {
  const date = new Date(match.date_match);
  const options = { day: '2-digit', month: 'short' };
  return {
    ...match,
    date_formatee: date.toLocaleDateString('fr-FR', options),
    heure: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    domicile: match.lieu === 'domicile',
    equipe_dom: match.lieu === 'domicile' ? 'Magny FC 78' : match.adversaire,
    equipe_ext: match.lieu === 'domicile' ? match.adversaire : 'Magny FC 78'
  };
};

// =====================================================
// GET /api/matchs - Liste des matchs
// =====================================================
router.get('/', async (req, res, next) => {
  try {
    const { type = 'a_venir', equipe_id, limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT m.*, e.nom as equipe_nom, c.nom as categorie
      FROM matchs m
      LEFT JOIN equipes e ON m.equipe_id = e.id
      LEFT JOIN categories c ON e.categorie_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (type !== 'tous') {
      sql += ' AND m.statut = ?';
      params.push(type);
    }

    if (equipe_id) {
      sql += ' AND m.equipe_id = ?';
      params.push(parseInt(equipe_id));
    }

    sql += ` ORDER BY m.date_match ${type === 'termine' ? 'DESC' : 'ASC'}`;
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const matchs = await db.query(sql, params);

    res.json({
      success: true,
      data: {
        matchs: matchs.map(formatMatch),
        total: matchs.length
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

module.exports = router;

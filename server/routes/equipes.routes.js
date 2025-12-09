/**
 * Routes Équipes - API REST sécurisée
 */

const express = require('express');
const db = require('../config/database');
const { protect, restrictTo } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validator');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// =====================================================
// GET /api/equipes - Liste des équipes
// =====================================================
router.get('/', async (req, res, next) => {
  try {
    const { categorie, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT e.*, c.nom as categorie_nom,
        (SELECT COUNT(*) FROM joueurs WHERE equipe_id = e.id) as nb_joueurs
      FROM equipes e
      LEFT JOIN categories c ON e.categorie_id = c.id
    `;
    const params = [];

    if (categorie && categorie !== 'Tous') {
      sql += ' WHERE c.nom = ?';
      params.push(categorie);
    }

    sql += ' ORDER BY c.ordre, e.nom LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const equipes = await db.query(sql, params);

    // Compte total
    let countSql = 'SELECT COUNT(*) as total FROM equipes e LEFT JOIN categories c ON e.categorie_id = c.id';
    if (categorie && categorie !== 'Tous') {
      countSql += ' WHERE c.nom = ?';
    }
    const [{ total }] = await db.query(countSql, categorie && categorie !== 'Tous' ? [categorie] : []);

    res.json({
      success: true,
      data: {
        equipes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/equipes/categories - Liste des catégories
// =====================================================
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await db.query('SELECT * FROM categories ORDER BY ordre');
    res.json({ success: true, data: { categories } });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/equipes/:id - Détail d'une équipe
// =====================================================
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const equipes = await db.query(`
      SELECT e.*, c.nom as categorie_nom
      FROM equipes e
      LEFT JOIN categories c ON e.categorie_id = c.id
      WHERE e.id = ?
    `, [id]);

    if (!equipes.length) {
      throw new AppError('Équipe non trouvée.', 404);
    }

    const equipe = equipes[0];

    // Joueurs de l'équipe
    equipe.joueurs = await db.query(
      'SELECT * FROM joueurs WHERE equipe_id = ? ORDER BY numero',
      [id]
    );

    // Prochains matchs
    equipe.prochains_matchs = await db.query(`
      SELECT * FROM matchs 
      WHERE equipe_id = ? AND statut = 'a_venir'
      ORDER BY date_match LIMIT 5
    `, [id]);

    // Derniers résultats
    equipe.derniers_resultats = await db.query(`
      SELECT * FROM matchs 
      WHERE equipe_id = ? AND statut = 'termine'
      ORDER BY date_match DESC LIMIT 5
    `, [id]);

    res.json({ success: true, data: { equipe } });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/equipes - Créer une équipe (Admin)
// =====================================================
router.post('/', protect, restrictTo('admin'), validate(schemas.equipe), async (req, res, next) => {
  try {
    const { nom, categorie_id, division, coach, description } = req.body;

    const result = await db.query(`
      INSERT INTO equipes (nom, categorie_id, division, coach, description)
      VALUES (?, ?, ?, ?, ?)
    `, [nom, categorie_id, division, coach, description]);

    const equipe = await db.query('SELECT * FROM equipes WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Équipe créée avec succès',
      data: { equipe: equipe[0] }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// PUT /api/equipes/:id - Modifier une équipe (Admin)
// =====================================================
router.put('/:id', protect, restrictTo('admin'), validate(schemas.equipe), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nom, categorie_id, division, coach, description } = req.body;

    const existing = await db.query('SELECT id FROM equipes WHERE id = ?', [id]);
    if (!existing.length) {
      throw new AppError('Équipe non trouvée.', 404);
    }

    await db.query(`
      UPDATE equipes 
      SET nom = ?, categorie_id = ?, division = ?, coach = ?, description = ?
      WHERE id = ?
    `, [nom, categorie_id, division, coach, description, id]);

    const equipe = await db.query('SELECT * FROM equipes WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Équipe mise à jour',
      data: { equipe: equipe[0] }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// DELETE /api/equipes/:id - Supprimer une équipe (Admin)
// =====================================================
router.delete('/:id', protect, restrictTo('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT id FROM equipes WHERE id = ?', [id]);
    if (!existing.length) {
      throw new AppError('Équipe non trouvée.', 404);
    }

    await db.query('DELETE FROM equipes WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Équipe supprimée'
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;

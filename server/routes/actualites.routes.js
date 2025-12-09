/**
 * Routes Actualités - API REST sécurisée
 */

const express = require('express');
const db = require('../config/database');
const { protect, restrictTo } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validator');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// =====================================================
// GET /api/actualites - Liste des actualités
// =====================================================
router.get('/', async (req, res, next) => {
  try {
    const { categorie, limit = 10, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM actualites WHERE publie = 1';
    const params = [];

    if (categorie && categorie !== 'Tous') {
      sql += ' AND categorie = ?';
      params.push(categorie);
    }

    sql += ' ORDER BY date_publication DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const actualites = await db.query(sql, params);

    // Formater les dates
    const formatted = actualites.map(a => ({
      ...a,
      date_formatee: new Date(a.date_publication).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    }));

    res.json({
      success: true,
      data: { actualites: formatted }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/actualites/:id - Détail d'une actualité
// =====================================================
router.get('/:id', async (req, res, next) => {
  try {
    const actualites = await db.query(
      'SELECT * FROM actualites WHERE id = ? AND publie = 1',
      [req.params.id]
    );

    if (!actualites.length) {
      throw new AppError('Article non trouvé.', 404);
    }

    res.json({
      success: true,
      data: { actualite: actualites[0] }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/actualites - Créer une actualité (Admin)
// =====================================================
router.post('/', protect, restrictTo('admin'), validate(schemas.actualite), async (req, res, next) => {
  try {
    const { titre, contenu, extrait, categorie } = req.body;

    const result = await db.query(`
      INSERT INTO actualites (titre, contenu, extrait, categorie, publie, date_publication)
      VALUES (?, ?, ?, ?, 1, NOW())
    `, [titre, contenu, extrait, categorie]);

    const actualite = await db.query('SELECT * FROM actualites WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Article créé',
      data: { actualite: actualite[0] }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// PUT /api/actualites/:id - Modifier une actualité (Admin)
// =====================================================
router.put('/:id', protect, restrictTo('admin'), validate(schemas.actualite), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { titre, contenu, extrait, categorie } = req.body;

    const existing = await db.query('SELECT id FROM actualites WHERE id = ?', [id]);
    if (!existing.length) {
      throw new AppError('Article non trouvé.', 404);
    }

    await db.query(`
      UPDATE actualites 
      SET titre = ?, contenu = ?, extrait = ?, categorie = ?
      WHERE id = ?
    `, [titre, contenu, extrait, categorie, id]);

    const actualite = await db.query('SELECT * FROM actualites WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Article mis à jour',
      data: { actualite: actualite[0] }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// DELETE /api/actualites/:id - Supprimer une actualité (Admin)
// =====================================================
router.delete('/:id', protect, restrictTo('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT id FROM actualites WHERE id = ?', [id]);
    if (!existing.length) {
      throw new AppError('Article non trouvé.', 404);
    }

    await db.query('DELETE FROM actualites WHERE id = ?', [id]);

    res.json({ success: true, message: 'Article supprimé' });

  } catch (error) {
    next(error);
  }
});

module.exports = router;

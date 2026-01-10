/**
 * Routes Contact - API REST sécurisée
 */

const express = require('express');
const db = require('../config/database');
const { protect, restrictTo } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validator');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { sendContactNotification } = require('../utils/email');

const router = express.Router();

// =====================================================
// POST /api/contact - Envoyer un message
// =====================================================
router.post('/', validate(schemas.contact), async (req, res, next) => {
  try {
    const { nom, email, sujet, message } = req.body;

    // Insérer le message
    const result = await db.query(`
      INSERT INTO contacts (nom, email, sujet, message, lu, created_at)
      VALUES (?, ?, ?, ?, 0, NOW())
    `, [nom, email.toLowerCase(), sujet, message]);

    logger.info(`Nouveau message de contact reçu de: ${email}`);

    // Envoyer un email de notification (non bloquant)
    sendContactNotification({ nom, email, sujet, message })
      .then(result => {
        if (result.success) {
          logger.info(`Email de notification envoyé pour le contact de: ${email}`);
        }
      })
      .catch(err => {
        logger.error(`Erreur envoi notification email: ${err.message}`);
      });

    res.status(201).json({
      success: true,
      message: 'Message envoyé avec succès. Nous vous répondrons rapidement.'
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/contact - Liste des messages (Admin)
// =====================================================
router.get('/', protect, restrictTo('admin'), async (req, res, next) => {
  try {
    const { lu, limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM contacts';
    const params = [];

    if (lu !== undefined) {
      sql += ' WHERE lu = ?';
      params.push(lu === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const messages = await db.query(sql, params);

    // Nombre de messages non lus
    const [{ count }] = await db.query('SELECT COUNT(*) as count FROM contacts WHERE lu = 0');

    res.json({
      success: true,
      data: {
        messages,
        unread: count
      }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// PATCH /api/contact/:id/read - Marquer comme lu (Admin)
// =====================================================
router.patch('/:id/read', protect, restrictTo('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.query('UPDATE contacts SET lu = 1 WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Message marqué comme lu'
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// DELETE /api/contact/:id - Supprimer un message (Admin)
// =====================================================
router.delete('/:id', protect, restrictTo('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT id FROM contacts WHERE id = ?', [id]);
    if (!existing.length) {
      throw new AppError('Message non trouvé.', 404);
    }

    await db.query('DELETE FROM contacts WHERE id = ?', [id]);

    res.json({ success: true, message: 'Message supprimé' });

  } catch (error) {
    next(error);
  }
});

module.exports = router;

/**
 * Routes admin v1 — /api/v1/admin
 * Authentifié + réservé aux administrateurs.
 */

const express = require('express');
const multer = require('multer');
const Joi = require('joi');
const { validate } = require('../../../middleware/validator');
const { authenticate } = require('../../../middleware/auth.middleware');
const { requireAdmin } = require('../../../middleware/admin.middleware');
const controller = require('./admin.controller');

const router = express.Router();

// Upload CSV en mémoire (parsing immédiat, pas de stockage disque).
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo
  fileFilter: (req, file, cb) => {
    const ok = /\.(csv|txt)$/i.test(file.originalname) ||
      ['text/csv', 'application/vnd.ms-excel', 'text/plain'].includes(file.mimetype);
    cb(ok ? null : new Error('Seuls les fichiers CSV sont acceptés.'), ok);
  }
});

const invitationSchema = Joi.object({
  license_id: Joi.number().integer().positive().required(),
  email: Joi.string().email().required(),
  role: Joi.string().valid('joueur', 'tuteur').default('joueur')
});

const mergeSchema = Joi.object({
  source_id: Joi.string().required(),
  target_id: Joi.string().required()
});

router.use(authenticate, requireAdmin);

router.get('/licenses', controller.listLicenses);
router.post('/licenses/import', uploadCsv.single('file'), controller.importLicenses);
router.post('/invitations', validate(invitationSchema), controller.createInvitation);
router.get('/accounts', controller.listAccounts);
router.get('/accounts/:id', controller.getAccount);
router.post('/accounts/merge', validate(mergeSchema), controller.mergeAccounts);

module.exports = router;

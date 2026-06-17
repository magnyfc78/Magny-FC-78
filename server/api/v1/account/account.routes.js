/**
 * Routes compte v1 — /api/v1/account
 * Self-service authentifié : historique, export RGPD, suppression.
 * NB: monté APRÈS /account/licenses dans l'agrégateur (routes plus spécifiques
 *     d'abord), donc ces chemins ne capturent pas /account/licenses/*.
 */

const express = require('express');
const Joi = require('joi');
const { validate } = require('../../../middleware/validator');
const { authenticate } = require('../../../middleware/auth.middleware');
const controller = require('./account.controller');

const router = express.Router();

const deleteSchema = Joi.object({
  password: Joi.string().required().messages({ 'string.empty': 'Mot de passe requis' })
});

router.use(authenticate);

router.get('/login-history', controller.loginHistory);
router.get('/export', controller.exportData);
router.delete('/', validate(deleteSchema), controller.deleteAccount);

module.exports = router;

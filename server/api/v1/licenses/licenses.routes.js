/**
 * Routes licences compte v1 — /api/v1/account/licenses
 * Toutes authentifiées.
 */

const express = require('express');
const Joi = require('joi');
const { validate } = require('../../../middleware/validator');
const { authenticate } = require('../../../middleware/auth.middleware');
const controller = require('./licenses.controller');

const router = express.Router();

const linkSchema = Joi.object({
  license_number: Joi.string().pattern(/^[A-Za-z0-9]{4,50}$/).required()
    .messages({ 'string.pattern.base': 'Numéro de licence invalide' }),
  birth_date: Joi.date().iso().less('now').required()
    .messages({ 'date.less': 'Date de naissance invalide' }),
  relationship: Joi.string().valid('self', 'parent').default('self')
});

router.use(authenticate);

router.get('/', controller.list);
router.post('/link', validate(linkSchema), controller.link);
router.delete('/:license_id', controller.unlink);
router.put('/:license_id/set-primary', controller.setPrimary);

module.exports = router;

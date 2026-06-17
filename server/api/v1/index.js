/**
 * Agrégateur des routes API v1 — monté sur /api/v1.
 */

const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth/auth.routes'));
// /account/licenses doit être monté AVANT /account (plus spécifique d'abord).
router.use('/account/licenses', require('./licenses/licenses.routes'));
router.use('/account', require('./account/account.routes'));
router.use('/admin', require('./admin/admin.routes'));

module.exports = router;

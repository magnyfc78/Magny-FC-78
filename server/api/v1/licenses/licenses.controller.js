/**
 * Controller licences compte v1.
 */

const licensesService = require('./licenses.service');

const licensesController = {
  async list(req, res, next) {
    try {
      const licenses = await licensesService.listForUser(req.user.id);
      res.json({ success: true, data: { licenses } });
    } catch (err) { next(err); }
  },

  async link(req, res, next) {
    try {
      const result = await licensesService.linkLicense(req.user.id, req.body);
      res.status(201).json({ success: true, message: 'Licence liée à votre compte.', data: result });
    } catch (err) { next(err); }
  },

  async unlink(req, res, next) {
    try {
      const result = await licensesService.unlinkLicense(req.user.id, req.params.license_id);
      res.json({ success: true, message: 'Liaison supprimée.', data: result });
    } catch (err) { next(err); }
  },

  async setPrimary(req, res, next) {
    try {
      const result = await licensesService.setPrimary(req.user.id, req.params.license_id);
      res.json({ success: true, message: 'Licence principale définie.', data: result });
    } catch (err) { next(err); }
  }
};

module.exports = licensesController;

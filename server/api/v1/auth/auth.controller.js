/**
 * Controller auth v1 — orchestration HTTP (validation faite en amont).
 */

const authService = require('./auth.service');

const ctxFrom = (req) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

const authController = {
  async checkEmail(req, res, next) {
    try {
      const result = await authService.checkEmail(req.body.email);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async register(req, res, next) {
    try {
      const result = await authService.register(req.body, ctxFrom(req));
      res.status(201).json({
        success: true,
        message: 'Inscription réussie. Vérifiez votre email pour activer le compte.',
        data: result
      });
    } catch (err) { next(err); }
  },

  async registerWithInvitation(req, res, next) {
    try {
      const result = await authService.registerWithInvitation(req.body, ctxFrom(req));
      res.status(201).json({
        success: true,
        message: 'Inscription réussie.',
        data: result
      });
    } catch (err) { next(err); }
  },

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body.email, req.body.password, ctxFrom(req));
      res.json({ success: true, message: 'Connexion réussie', data: result });
    } catch (err) { next(err); }
  },

  async verifyEmail(req, res, next) {
    try {
      const result = await authService.verifyEmail(req.params.token);
      res.json({ success: true, message: 'Email vérifié. Votre compte est activé.', data: result });
    } catch (err) { next(err); }
  },

  async forgotPassword(req, res, next) {
    try {
      const result = await authService.forgotPassword(req.body.email);
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async resetPassword(req, res, next) {
    try {
      const result = await authService.resetPassword(req.body.token, req.body.password);
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }
};

module.exports = authController;

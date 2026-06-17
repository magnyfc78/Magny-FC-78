/**
 * Middleware d'autorisation admin pour l'API v1.
 * S'appuie sur le rôle back-office users.role = 'admin' (cohérent avec
 * l'admin.routes.js existant). À placer APRÈS authenticate.
 *
 * NB: l'admin "à l'échelle du club" (membres_club.role) introduit en Partie 1
 *     est un concept distinct, hors périmètre de cette spec d'inscription.
 */

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentification requise.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Accès réservé aux administrateurs.' });
  }
  next();
};

module.exports = { requireAdmin };

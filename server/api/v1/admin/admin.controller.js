/**
 * Controller admin v1 — gestion des licences, import FFF, invitations, comptes.
 * Accès réservé aux administrateurs (requireAdmin en amont).
 */

const db = require('../../../config/database');
const { AppError } = require('../../../middleware/errorHandler');
const tokenService = require('../../../utils/token.service');
const emailService = require('../../../utils/email.service');
const { importLicenses } = require('../../../utils/license-import');
const logger = require('../../../utils/logger');

const License = require('../../../models/License');
const Invitation = require('../../../models/Invitation');
const Account = require('../../../models/Account');
const AccountLicense = require('../../../models/AccountLicense');

const INVITATION_TTL_HOURS = 14 * 24; // 14 jours

const adminController = {
  /**
   * GET /admin/licenses — liste filtrable des licences.
   */
  async listLicenses(req, res, next) {
    try {
      const { rows, total, page, limit } = await License.searchAdmin(req.query);
      res.json({
        success: true,
        data: {
          licenses: rows,
          pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        }
      });
    } catch (err) { next(err); }
  },

  /**
   * POST /admin/licenses/import — import CSV (multipart, champ "file").
   */
  async importLicenses(req, res, next) {
    try {
      if (!req.file) {
        throw new AppError('Fichier CSV manquant (champ "file").', 400);
      }
      const season = req.body.season;
      if (!season) {
        throw new AppError('La saison est requise (champ "season").', 400);
      }
      const clubId = parseInt(req.body.club_id, 10) || 1;
      const dryRun = req.body.dry_run === 'true' || req.body.dry_run === true;

      const raw = req.file.buffer.toString('utf8');
      const { stats, problems } = await importLicenses({ raw, season, clubId, dryRun });

      logger.info(`Import licences (admin ${req.user.id}): ${JSON.stringify(stats)}`);
      res.json({
        success: true,
        message: `Import ${dryRun ? '(simulation) ' : ''}terminé.`,
        data: { stats, problems: problems.slice(0, 50) }
      });
    } catch (err) { next(err); }
  },

  /**
   * POST /admin/invitations — génère et envoie une invitation pour une licence.
   * Body: { license_id, email, role? ('joueur'|'tuteur') }
   */
  async createInvitation(req, res, next) {
    try {
      const { license_id, email, role = 'joueur' } = req.body;

      const license = await License.findById(license_id);
      if (!license) {
        throw new AppError('Licence introuvable.', 404);
      }

      const expireLe = tokenService.expiresInHours(INVITATION_TTL_HOURS);

      // Génère un code unique (retry sur collision improbable).
      let invitationId = null;
      let code = null;
      for (let attempt = 0; attempt < 5 && invitationId === null; attempt += 1) {
        code = tokenService.generateCode(8);
        try {
          invitationId = await Invitation.create({
            clubId: license.club_id || 1,
            email,
            token: code,
            roleInvite: role,
            licenseId: license.id,
            inviteParUserId: req.user.id,
            expireLe
          });
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY') continue; // collision de code -> retry
          throw err;
        }
      }
      if (invitationId === null) {
        throw new AppError('Impossible de générer un code d\'invitation, réessayez.', 500);
      }

      try {
        await emailService.sendInvitationEmail(email, code, `${license.prenom} ${license.nom}`);
      } catch (err) {
        logger.error('Envoi email invitation échoué:', err.message);
      }

      res.status(201).json({
        success: true,
        message: 'Invitation créée et envoyée.',
        data: { invitation_id: invitationId, code, email, expire_le: expireLe }
      });
    } catch (err) { next(err); }
  },

  /**
   * GET /admin/accounts — liste des comptes avec leurs licences liées.
   */
  async listAccounts(req, res, next) {
    try {
      const { rows, total, page, limit } = await Account.listAdmin(req.query);
      res.json({
        success: true,
        data: {
          accounts: rows,
          pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        }
      });
    } catch (err) { next(err); }
  },

  /**
   * GET /admin/accounts/:id — détail d'un compte + ses licences (aide à la fusion).
   */
  async getAccount(req, res, next) {
    try {
      const account = await Account.findById(req.params.id);
      if (!account) throw new AppError('Compte introuvable.', 404);
      const licenses = await AccountLicense.listByUser(account.id);
      res.json({ success: true, data: { account, licenses } });
    } catch (err) { next(err); }
  },

  /**
   * POST /admin/accounts/merge — fusionne deux comptes en doublon.
   * Body: { source_id, target_id }. Les licences du source migrent vers le
   * cible, puis le source est supprimé (soft-delete).
   */
  async mergeAccounts(req, res, next) {
    try {
      const { source_id, target_id } = req.body;
      if (source_id === target_id) {
        throw new AppError('Les deux comptes doivent être différents.', 400);
      }
      const [source, target] = await Promise.all([
        Account.findById(source_id),
        Account.findById(target_id)
      ]);
      if (!source) throw new AppError('Compte source introuvable.', 404);
      if (!target) throw new AppError('Compte cible introuvable.', 404);

      const moved = await db.transaction(async (conn) => {
        const n = await AccountLicense.moveLicenses(source_id, target_id, conn);
        await conn.query(
          `UPDATE users
           SET deleted_at = NOW(), actif = 0,
               email = CONCAT('merged+', id, '@magnyfc78.invalid'),
               password = '', verification_token = NULL, reset_token = NULL
           WHERE id = ?`,
          [source_id]
        );
        return n;
      });

      logger.info(`Fusion comptes (admin ${req.user.id}): ${source_id} -> ${target_id} (${moved} licence(s))`);
      res.json({
        success: true,
        message: `Comptes fusionnés. ${moved} licence(s) transférée(s).`,
        data: { source_id, target_id, licenses_moved: moved }
      });
    } catch (err) { next(err); }
  }
};

module.exports = adminController;

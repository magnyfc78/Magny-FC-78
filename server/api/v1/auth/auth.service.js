/**
 * Service auth v1 — logique métier de l'inscription et de la connexion.
 * Couvre les 4 scénarios : joueur adulte, parent, licence supplémentaire
 * (via licenses service), invitation admin.
 */

const bcrypt = require('bcryptjs');
const db = require('../../../config/database');
const config = require('../../../config');
const { AppError } = require('../../../middleware/errorHandler');
const { generateAccessToken } = require('../../../middleware/auth');
const tokenService = require('../../../utils/token.service');
const emailService = require('../../../utils/email.service');
const logger = require('../../../utils/logger');

const Account = require('../../../models/Account');
const License = require('../../../models/License');
const AccountLicense = require('../../../models/AccountLicense');
const Invitation = require('../../../models/Invitation');
const LoginHistory = require('../../../models/LoginHistory');

const VERIFICATION_TTL_HOURS = 48;
const RESET_TTL_HOURS = 1;

const hashPassword = (plain) => bcrypt.hash(plain, config.security.bcryptRounds);

const publicUser = (u) => ({
  id: u.id,
  nom: u.nom,
  prenom: u.prenom,
  email: u.email,
  role: u.role,
  email_verified: Boolean(u.email_verified)
});

const licensePreview = (license) =>
  `${license.prenom} ${String(license.nom).charAt(0).toUpperCase()}.`;

const recordLogin = async (userId, ctx = {}, success = true) => {
  try {
    await LoginHistory.record(userId, ctx, success);
  } catch (err) {
    logger.warn('login_history non enregistré:', err.message);
  }
};

const isExpired = (date) => !date || new Date(date).getTime() < Date.now();

const authService = {
  /**
   * Étape 1 de l'inscription : l'email correspond-il à une licence active ?
   */
  async checkEmail(email) {
    const license = await License.findActiveByEmail(email);
    return {
      found: Boolean(license),
      license_preview: license ? licensePreview(license) : null
    };
  },

  /**
   * Inscription. Lie la licence si (license_number + birth_date) fournis et valides.
   * Scénario 1 (adulte) ; le rattachement parent passe par /account/licenses/link.
   */
  async register(payload, ctx = {}) {
    const { email, password, first_name, last_name, license_number, birth_date } = payload;
    const emailLc = email.toLowerCase();

    if (await Account.existsByEmail(emailLc)) {
      throw new AppError('Cet email est déjà utilisé.', 409);
    }

    // Vérification de licence en amont (hors transaction).
    let license = null;
    if (license_number) {
      const birth = new Date(birth_date).toISOString().slice(0, 10);
      license = await License.findActiveByNumeroAndBirthdate(license_number, birth);
      if (!license) {
        throw new AppError('Aucune licence active ne correspond à ce numéro et cette date de naissance.', 400);
      }
      if (await AccountLicense.isClaimedAsSelf(license.id)) {
        throw new AppError('Cette licence est déjà rattachée à un compte.', 409);
      }
    }

    const passwordHash = await hashPassword(password);
    const verificationToken = tokenService.generateToken();
    const verificationExpires = tokenService.expiresInHours(VERIFICATION_TTL_HOURS);

    const userId = await db.transaction(async (conn) => {
      const id = await Account.create({
        nom: last_name,
        prenom: first_name,
        email: emailLc,
        passwordHash,
        verificationToken,
        verificationExpires
      }, conn);

      if (license) {
        await AccountLicense.link(
          { userId: id, licenseId: license.id, relationship: 'self' },
          conn
        );
      }
      return id;
    });

    // Email de vérification (après commit ; n'interrompt pas l'inscription si échec).
    try {
      await emailService.sendVerificationEmail(emailLc, verificationToken, first_name);
    } catch (err) {
      logger.error('Envoi email de vérification échoué:', err.message);
    }

    const accessToken = generateAccessToken(userId, 'user');
    const user = await Account.findById(userId);
    return { user: publicUser(user), accessToken, license_linked: Boolean(license) };
  },

  /**
   * Inscription via code d'invitation (scénario 4). Lie la licence de l'invitation.
   */
  async registerWithInvitation(payload, ctx = {}) {
    const { invitation_code, email, password, first_name, last_name } = payload;
    const emailLc = email.toLowerCase();

    const invitation = await Invitation.findByToken(invitation_code);
    if (!invitation || invitation.statut !== 'en_attente') {
      throw new AppError('Invitation invalide ou déjà utilisée.', 400);
    }
    if (isExpired(invitation.expire_le) && invitation.expire_le) {
      throw new AppError('Cette invitation a expiré.', 400);
    }
    if (await Account.existsByEmail(emailLc)) {
      throw new AppError('Cet email est déjà utilisé.', 409);
    }

    // Si l'invitation ciblait un email précis et qu'il correspond, l'ownership
    // est prouvé -> on active directement le compte.
    const emailMatches = invitation.email && invitation.email.toLowerCase() === emailLc;
    const relationship = invitation.role_invite === 'tuteur' ? 'parent' : 'self';

    const passwordHash = await hashPassword(password);
    const verificationToken = emailMatches ? null : tokenService.generateToken();
    const verificationExpires = emailMatches ? null : tokenService.expiresInHours(VERIFICATION_TTL_HOURS);

    const userId = await db.transaction(async (conn) => {
      const id = await Account.create({
        nom: last_name,
        prenom: first_name,
        email: emailLc,
        passwordHash,
        verificationToken,
        verificationExpires
      }, conn);

      if (emailMatches) {
        await conn.query(
          'UPDATE users SET email_verified = 1, email_verified_at = NOW() WHERE id = ?',
          [id]
        );
      }
      if (invitation.license_id) {
        // La licence peut déjà être revendiquée en 'self' : on l'interdit,
        // sauf si l'invitation est de type parent.
        if (relationship === 'self' && await AccountLicense.isClaimedAsSelf(invitation.license_id)) {
          throw new AppError('La licence de cette invitation est déjà rattachée à un compte.', 409);
        }
        await AccountLicense.link(
          { userId: id, licenseId: invitation.license_id, relationship },
          conn
        );
      }
      await conn.query(
        `UPDATE invitations SET statut = 'acceptee', acceptee_le = NOW() WHERE id = ?`,
        [invitation.id]
      );
      return id;
    });

    if (!emailMatches) {
      try {
        await emailService.sendVerificationEmail(emailLc, verificationToken, first_name);
      } catch (err) {
        logger.error('Envoi email de vérification échoué:', err.message);
      }
    }

    const accessToken = generateAccessToken(userId, 'user');
    const user = await Account.findById(userId);
    return { user: publicUser(user), accessToken };
  },

  /**
   * Connexion : retourne JWT + compte + licences liées.
   */
  async login(email, password, ctx = {}) {
    const account = await Account.findByEmail(email);
    if (!account) {
      throw new AppError('Email ou mot de passe incorrect.', 401);
    }
    if (!account.actif) {
      throw new AppError('Ce compte a été désactivé.', 401);
    }

    const valid = await bcrypt.compare(password, account.password);
    if (!valid) {
      await recordLogin(account.id, ctx, false);
      logger.warn(`Connexion échouée pour ${email}`);
      throw new AppError('Email ou mot de passe incorrect.', 401);
    }

    await Account.touchLastLogin(account.id);
    await recordLogin(account.id, ctx, true);

    const accessToken = generateAccessToken(account.id, account.role);
    const licenses = await AccountLicense.listByUser(account.id);

    return { user: publicUser(account), accessToken, licenses };
  },

  /**
   * Vérification d'email via token.
   */
  async verifyEmail(token) {
    const account = await Account.findByVerificationToken(token);
    if (!account) {
      throw new AppError('Lien de vérification invalide.', 400);
    }
    if (isExpired(account.verification_expires)) {
      throw new AppError('Lien de vérification expiré. Demandez-en un nouveau.', 400);
    }
    await Account.markEmailVerified(account.id);
    return { verified: true };
  },

  /**
   * Demande de réinitialisation : réponse identique que l'email existe ou non
   * (anti-énumération).
   */
  async forgotPassword(email) {
    const account = await Account.findByEmail(email);
    if (account) {
      const resetToken = tokenService.generateToken();
      const resetExpires = tokenService.expiresInHours(RESET_TTL_HOURS);
      await Account.setResetToken(account.id, resetToken, resetExpires);
      try {
        await emailService.sendPasswordResetEmail(account.email, resetToken, account.prenom);
      } catch (err) {
        logger.error('Envoi email reset échoué:', err.message);
      }
    }
    return { message: 'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.' };
  },

  /**
   * Réinitialisation effective du mot de passe.
   */
  async resetPassword(token, password) {
    const account = await Account.findByResetToken(token);
    if (!account) {
      throw new AppError('Lien de réinitialisation invalide.', 400);
    }
    if (isExpired(account.reset_expires)) {
      throw new AppError('Lien de réinitialisation expiré.', 400);
    }
    const passwordHash = await hashPassword(password);
    await Account.updatePassword(account.id, passwordHash);
    return { message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' };
  }
};

module.exports = authService;

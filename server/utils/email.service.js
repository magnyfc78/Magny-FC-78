/**
 * Service d'envoi d'emails (nodemailer)
 *
 * En dev (config.email.enabled = false), on utilise un transport "jsonTransport"
 * qui n'envoie rien : l'email est sérialisé et loggué (le lien de vérification
 * est donc visible dans les logs). En prod, on branche le SMTP configuré.
 */

const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('./logger');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (config.email.enabled) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: config.email.user
        ? { user: config.email.user, pass: config.email.password }
        : undefined
    });
    logger.info(`📧 SMTP configuré: ${config.email.host}:${config.email.port}`);
  } else {
    // Transport de développement : n'envoie rien, sérialise le message.
    transporter = nodemailer.createTransport({ jsonTransport: true });
    logger.warn('📭 Emails en mode DEV (stub) : aucun envoi réel, contenu loggué.');
  }
  return transporter;
};

/**
 * Enveloppe HTML minimale et cohérente pour tous les emails.
 */
const wrap = (title, body) => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#1a1a1a">
    <h2 style="color:#0b3d91">${title}</h2>
    ${body}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="font-size:12px;color:#888">Magny FC 78 — cet email est automatique, merci de ne pas y répondre.</p>
  </div>
`;

const send = async ({ to, subject, html, text }) => {
  const info = await getTransporter().sendMail({
    from: config.email.from,
    to,
    subject,
    text,
    html
  });

  if (!config.email.enabled) {
    // Mode dev : on logge le contenu pour pouvoir cliquer/copier les liens.
    logger.info(`[EMAIL DEV] → ${to} | ${subject}`);
    logger.info(`[EMAIL DEV] message: ${info.message}`);
  }
  return info;
};

/**
 * Email de vérification de compte (scénarios 1, 2 + register).
 */
const sendVerificationEmail = (to, token, prenom = '') => {
  const url = `${config.app.publicUrl}/pages/verify-email.html?token=${token}`;
  return send({
    to,
    subject: 'Confirmez votre adresse email — Magny FC 78',
    text: `Bonjour ${prenom}, confirmez votre email : ${url}`,
    html: wrap('Confirmez votre adresse email', `
      <p>Bonjour ${prenom || ''},</p>
      <p>Pour activer votre compte Magny FC 78, cliquez sur le bouton ci-dessous :</p>
      <p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#0b3d91;color:#fff;text-decoration:none;border-radius:6px">Activer mon compte</a></p>
      <p style="font-size:13px;color:#666">Ou copiez ce lien : <br>${url}</p>
    `)
  });
};

/**
 * Email de réinitialisation de mot de passe.
 */
const sendPasswordResetEmail = (to, token, prenom = '') => {
  const url = `${config.app.publicUrl}/pages/reset-password.html?token=${token}`;
  return send({
    to,
    subject: 'Réinitialisation de votre mot de passe — Magny FC 78',
    text: `Réinitialisez votre mot de passe : ${url}`,
    html: wrap('Réinitialisation du mot de passe', `
      <p>Bonjour ${prenom || ''},</p>
      <p>Vous avez demandé à réinitialiser votre mot de passe. Ce lien expire bientôt.</p>
      <p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#0b3d91;color:#fff;text-decoration:none;border-radius:6px">Choisir un nouveau mot de passe</a></p>
      <p style="font-size:13px;color:#666">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `)
  });
};

/**
 * Email d'invitation par l'admin (scénario 4) : contient le code d'invitation.
 */
const sendInvitationEmail = (to, code, licenseName = '') => {
  const url = `${config.app.publicUrl}/pages/register.html?invitation=${code}`;
  return send({
    to,
    subject: 'Invitation à rejoindre Magny FC 78',
    text: `Votre code d'invitation : ${code} — Inscrivez-vous : ${url}`,
    html: wrap('Vous êtes invité(e) sur l\'espace Magny FC 78', `
      <p>Bonjour,</p>
      <p>Vous êtes invité(e) à créer votre compte${licenseName ? ` pour la licence <strong>${licenseName}</strong>` : ''}.</p>
      <p>Votre code d'invitation :</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:3px;color:#0b3d91">${code}</p>
      <p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#0b3d91;color:#fff;text-decoration:none;border-radius:6px">Créer mon compte</a></p>
    `)
  });
};

module.exports = {
  send,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendInvitationEmail
};

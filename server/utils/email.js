/**
 * Service d'envoi d'emails avec Nodemailer
 * Configuration SMTP OVH par défaut
 */

const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('./logger');

// Créer le transporteur SMTP
let transporter = null;

/**
 * Initialise le transporteur SMTP
 */
function initTransporter() {
  if (!config.email.user || !config.email.password) {
    logger.warn('Configuration SMTP incomplète - les emails ne seront pas envoyés');
    logger.warn(`SMTP_USER: ${config.email.user ? 'défini' : 'NON DÉFINI'}`);
    logger.warn(`SMTP_PASSWORD: ${config.email.password ? 'défini' : 'NON DÉFINI'}`);
    return null;
  }

  logger.info(`Initialisation SMTP: ${config.email.host}:${config.email.port} (secure: ${config.email.secure})`);
  logger.info(`SMTP User: ${config.email.user}`);
  logger.info(`SMTP From: ${config.email.from}`);
  logger.info(`Contact Email: ${config.email.contactEmail}`);

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.password
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  // Vérifier la connexion
  transporter.verify((error) => {
    if (error) {
      logger.error('Erreur de connexion SMTP:', error.message);
      logger.error('Détails:', error);
    } else {
      logger.info('Serveur SMTP prêt pour l\'envoi d\'emails');
    }
  });

  return transporter;
}

/**
 * Envoie un email
 * @param {Object} options - Options de l'email
 * @param {string} options.to - Destinataire
 * @param {string} options.subject - Sujet
 * @param {string} options.text - Contenu texte
 * @param {string} options.html - Contenu HTML (optionnel)
 */
async function sendEmail({ to, subject, text, html }) {
  if (!transporter) {
    initTransporter();
  }

  if (!transporter) {
    logger.warn('Email non envoyé - configuration SMTP manquante');
    return { success: false, error: 'Configuration SMTP manquante' };
  }

  try {
    const info = await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      text,
      html
    });

    logger.info(`Email envoyé: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Erreur envoi email:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Envoie une notification de nouveau message de contact
 * @param {Object} contact - Données du formulaire de contact
 */
async function sendContactNotification({ nom, email, sujet, message }) {
  const subject = `[Magny FC 78] Nouveau message: ${sujet}`;

  const text = `
Nouveau message reçu via le formulaire de contact

Nom: ${nom}
Email: ${email}
Sujet: ${sujet}

Message:
${message}

---
Ce message a été envoyé depuis le site web Magny FC 78
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a2744; color: #fff; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 20px; }
    .field { margin-bottom: 15px; }
    .field strong { color: #1a2744; }
    .message-box { background: #fff; border-left: 4px solid #00d4aa; padding: 15px; margin-top: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nouveau message de contact</h1>
    </div>
    <div class="content">
      <div class="field"><strong>Nom:</strong> ${nom}</div>
      <div class="field"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></div>
      <div class="field"><strong>Sujet:</strong> ${sujet}</div>
      <div class="message-box">
        <strong>Message:</strong>
        <p>${message.replace(/\n/g, '<br>')}</p>
      </div>
    </div>
    <div class="footer">
      Ce message a été envoyé depuis le site web Magny FC 78
    </div>
  </div>
</body>
</html>
`;

  return sendEmail({
    to: config.email.contactEmail,
    subject,
    text,
    html
  });
}

module.exports = {
  sendEmail,
  sendContactNotification,
  initTransporter
};

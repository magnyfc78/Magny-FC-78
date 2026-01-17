/**
 * Routes de gestion des licences pour les membres
 * Consultation, modification des infos, rattachement via invitations
 */

const express = require('express');
const db = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/email');
const config = require('../config');
const {
  protectMember,
  canManageLicense,
  generateInvitationCode,
  logMemberActivity
} = require('../middleware/memberAuth');

const router = express.Router();

// Toutes les routes nécessitent une authentification membre
router.use(protectMember);

// =====================================================
// GET /api/member/licenses - Mes licences
// =====================================================
router.get('/', async (req, res, next) => {
  try {
    const [licenses] = await db.pool.execute(
      `SELECT
        l.*,
        e.nom as team_name,
        e.slug as team_slug,
        al.relationship,
        al.is_primary,
        al.can_manage,
        al.verified_at
       FROM licenses l
       JOIN account_licenses al ON l.id = al.license_id
       LEFT JOIN equipes e ON l.team_id = e.id
       WHERE al.account_id = ? AND l.is_active = TRUE
       ORDER BY al.is_primary DESC, l.first_name`,
      [req.member.id]
    );

    // Formater les licences
    const formattedLicenses = licenses.map(l => ({
      id: l.id,
      licenseNumber: l.license_number,
      firstName: l.first_name,
      lastName: l.last_name,
      fullName: `${l.first_name} ${l.last_name}`,
      birthDate: l.birth_date,
      age: calculateAge(l.birth_date),
      gender: l.gender,
      category: l.category,
      team: l.team_id ? {
        id: l.team_id,
        name: l.team_name,
        slug: l.team_slug
      } : null,
      photoUrl: l.photo_url,
      email: l.email,
      phone: l.phone,
      address: {
        street: l.address,
        postalCode: l.postal_code,
        city: l.city
      },
      emergencyContact: {
        name: l.emergency_contact_name,
        phone: l.emergency_contact_phone
      },
      medicalCertificate: {
        date: l.medical_certificate_date,
        isValid: l.medical_certificate_valid
      },
      season: l.season,
      relationship: l.relationship,
      isPrimary: l.is_primary,
      canManage: l.can_manage,
      isVerified: !!l.verified_at
    }));

    res.json({
      success: true,
      data: {
        licenses: formattedLicenses,
        count: formattedLicenses.length
      }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/member/licenses/:id - Détails d'une licence
// =====================================================
router.get('/:licenseId', async (req, res, next) => {
  try {
    const { licenseId } = req.params;

    // Vérifier que le membre a accès à cette licence
    const [licenses] = await db.pool.execute(
      `SELECT
        l.*,
        e.nom as team_name,
        e.slug as team_slug,
        e.coach as team_coach,
        e.horaires_entrainement as training_schedule,
        al.relationship,
        al.is_primary,
        al.can_manage,
        al.verified_at
       FROM licenses l
       JOIN account_licenses al ON l.id = al.license_id
       LEFT JOIN equipes e ON l.team_id = e.id
       WHERE al.account_id = ? AND l.id = ?`,
      [req.member.id, licenseId]
    );

    if (!licenses.length) {
      throw new AppError('Licence non trouvée ou accès non autorisé.', 404);
    }

    const l = licenses[0];

    // Récupérer les prochains matchs de l'équipe
    let upcomingMatches = [];
    if (l.team_id) {
      const [matches] = await db.pool.execute(
        `SELECT id, adversaire, date_match, lieu, competition
         FROM matchs
         WHERE equipe_id = ? AND statut = 'a_venir' AND date_match > NOW()
         ORDER BY date_match ASC
         LIMIT 5`,
        [l.team_id]
      );
      upcomingMatches = matches;
    }

    res.json({
      success: true,
      data: {
        license: {
          id: l.id,
          licenseNumber: l.license_number,
          firstName: l.first_name,
          lastName: l.last_name,
          fullName: `${l.first_name} ${l.last_name}`,
          birthDate: l.birth_date,
          age: calculateAge(l.birth_date),
          gender: l.gender,
          category: l.category,
          team: l.team_id ? {
            id: l.team_id,
            name: l.team_name,
            slug: l.team_slug,
            coach: l.team_coach,
            trainingSchedule: l.training_schedule
          } : null,
          photoUrl: l.photo_url,
          email: l.email,
          phone: l.phone,
          address: {
            street: l.address,
            postalCode: l.postal_code,
            city: l.city
          },
          emergencyContact: {
            name: l.emergency_contact_name,
            phone: l.emergency_contact_phone
          },
          medicalCertificate: {
            date: l.medical_certificate_date,
            isValid: l.medical_certificate_valid
          },
          season: l.season,
          relationship: l.relationship,
          isPrimary: l.is_primary,
          canManage: l.can_manage,
          isVerified: !!l.verified_at
        },
        upcomingMatches
      }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// PATCH /api/member/licenses/:id - Modifier infos de contact
// =====================================================
router.patch('/:licenseId', canManageLicense, async (req, res, next) => {
  try {
    const { licenseId } = req.params;
    const {
      email,
      phone,
      address,
      postalCode,
      city,
      emergencyContactName,
      emergencyContactPhone
    } = req.body;

    // Construire la requête de mise à jour
    const updates = [];
    const values = [];

    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      values.push(address);
    }
    if (postalCode !== undefined) {
      updates.push('postal_code = ?');
      values.push(postalCode);
    }
    if (city !== undefined) {
      updates.push('city = ?');
      values.push(city);
    }
    if (emergencyContactName !== undefined) {
      updates.push('emergency_contact_name = ?');
      values.push(emergencyContactName);
    }
    if (emergencyContactPhone !== undefined) {
      updates.push('emergency_contact_phone = ?');
      values.push(emergencyContactPhone);
    }

    if (updates.length === 0) {
      throw new AppError('Aucune modification fournie.', 400);
    }

    values.push(licenseId);

    await db.pool.execute(
      `UPDATE licenses SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    await logMemberActivity(req.member.id, licenseId, 'license_updated', req.body, req);

    res.json({
      success: true,
      message: 'Informations mises à jour avec succès.'
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// PUT /api/member/licenses/:id/primary - Définir comme licence principale
// =====================================================
router.put('/:licenseId/primary', async (req, res, next) => {
  try {
    const { licenseId } = req.params;

    // Vérifier que le membre a cette licence
    const hasLicense = req.member.licenses.some(l => l.id === parseInt(licenseId));
    if (!hasLicense) {
      throw new AppError('Licence non trouvée.', 404);
    }

    // Retirer le statut primary des autres licences
    await db.pool.execute(
      'UPDATE account_licenses SET is_primary = FALSE WHERE account_id = ?',
      [req.member.id]
    );

    // Définir cette licence comme primaire
    await db.pool.execute(
      'UPDATE account_licenses SET is_primary = TRUE WHERE account_id = ? AND license_id = ?',
      [req.member.id, licenseId]
    );

    res.json({
      success: true,
      message: 'Licence principale mise à jour.'
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/member/licenses/link-direct - Rattacher une licence via numéro + date de naissance
// =====================================================
router.post('/link-direct', async (req, res, next) => {
  try {
    const { licenseNumber, birthDate, relationship } = req.body;

    if (!licenseNumber || !birthDate) {
      throw new AppError('Numéro de licence et date de naissance requis.', 400);
    }

    // Rechercher la licence
    const [licenses] = await db.pool.execute(
      `SELECT id, license_number, first_name, last_name, birth_date, category, email
       FROM licenses
       WHERE license_number = ? AND is_active = TRUE`,
      [licenseNumber.toUpperCase().trim()]
    );

    if (!licenses.length) {
      throw new AppError('Aucune licence trouvée avec ce numéro.', 404);
    }

    const license = licenses[0];

    // Vérifier la date de naissance
    const inputDate = new Date(birthDate).toISOString().split('T')[0];
    const licenseDate = new Date(license.birth_date).toISOString().split('T')[0];

    if (inputDate !== licenseDate) {
      throw new AppError('La date de naissance ne correspond pas à celle de la licence.', 400);
    }

    // Vérifier si la licence n'est pas déjà liée à ce compte
    const [existingLink] = await db.pool.execute(
      'SELECT id FROM account_licenses WHERE account_id = ? AND license_id = ?',
      [req.member.id, license.id]
    );

    if (existingLink.length) {
      throw new AppError('Cette licence est déjà rattachée à votre compte.', 400);
    }

    // Déterminer la relation
    // Si l'email de la licence correspond à celui du compte = self
    // Sinon = parent par défaut (ou la valeur fournie)
    let finalRelationship = relationship || 'parent';
    if (license.email && license.email.toLowerCase() === req.member.email.toLowerCase()) {
      finalRelationship = 'self';
    }

    // Déterminer si c'est la première licence (= primary)
    const isPrimary = req.member.licenses.length === 0;

    // Créer la liaison
    await db.pool.execute(
      `INSERT INTO account_licenses (account_id, license_id, relationship, is_primary, verified_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [req.member.id, license.id, finalRelationship, isPrimary]
    );

    await logMemberActivity(req.member.id, license.id, 'license_linked_direct', {
      licenseNumber: license.license_number,
      relationship: finalRelationship
    }, req);

    logger.info(`Licence ${license.license_number} rattachée au compte ${req.member.email} (vérification directe)`);

    res.json({
      success: true,
      message: `La licence de ${license.first_name} ${license.last_name} a été rattachée à votre compte.`,
      data: {
        license: {
          id: license.id,
          licenseNumber: license.license_number,
          firstName: license.first_name,
          lastName: license.last_name,
          fullName: `${license.first_name} ${license.last_name}`,
          category: license.category,
          relationship: finalRelationship
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/member/licenses/link - Rattacher une licence via code
// =====================================================
router.post('/link', async (req, res, next) => {
  try {
    const { code } = req.body;

    if (!code) {
      throw new AppError('Code d\'invitation requis.', 400);
    }

    // Rechercher l'invitation
    const [invitations] = await db.pool.execute(
      `SELECT li.*, l.first_name, l.last_name, l.license_number
       FROM license_invitations li
       JOIN licenses l ON li.license_id = l.id
       WHERE li.invitation_code = ? AND li.revoked_at IS NULL`,
      [code.toUpperCase()]
    );

    if (!invitations.length) {
      throw new AppError('Code d\'invitation invalide.', 400);
    }

    const invitation = invitations[0];

    // Vérifier l'expiration
    if (new Date(invitation.expires_at) < new Date()) {
      throw new AppError('Ce code d\'invitation a expiré.', 400);
    }

    // Vérifier le nombre d'utilisations
    if (invitation.use_count >= invitation.max_uses) {
      throw new AppError('Ce code d\'invitation a déjà été utilisé.', 400);
    }

    // Vérifier si un email spécifique est requis
    if (invitation.invited_email && invitation.invited_email.toLowerCase() !== req.member.email.toLowerCase()) {
      throw new AppError('Ce code d\'invitation n\'est pas destiné à votre compte.', 403);
    }

    // Vérifier si la licence n'est pas déjà liée à ce compte
    const [existingLink] = await db.pool.execute(
      'SELECT id FROM account_licenses WHERE account_id = ? AND license_id = ?',
      [req.member.id, invitation.license_id]
    );

    if (existingLink.length) {
      throw new AppError('Cette licence est déjà rattachée à votre compte.', 400);
    }

    // Déterminer si c'est la première licence (= primary)
    const isPrimary = req.member.licenses.length === 0;

    // Créer la liaison
    await db.pool.execute(
      `INSERT INTO account_licenses (account_id, license_id, relationship, is_primary, verified_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [req.member.id, invitation.license_id, invitation.relationship, isPrimary]
    );

    // Mettre à jour l'invitation
    await db.pool.execute(
      `UPDATE license_invitations
       SET use_count = use_count + 1, used_at = NOW(), used_by = ?
       WHERE id = ?`,
      [req.member.id, invitation.id]
    );

    await logMemberActivity(req.member.id, invitation.license_id, 'license_linked', {
      invitationCode: code,
      relationship: invitation.relationship
    }, req);

    logger.info(`Licence ${invitation.license_number} rattachée au compte ${req.member.email}`);

    res.json({
      success: true,
      message: `La licence de ${invitation.first_name} ${invitation.last_name} a été rattachée à votre compte.`,
      data: {
        license: {
          id: invitation.license_id,
          licenseNumber: invitation.license_number,
          fullName: `${invitation.first_name} ${invitation.last_name}`,
          relationship: invitation.relationship
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// DELETE /api/member/licenses/:id/unlink - Détacher une licence
// =====================================================
router.delete('/:licenseId/unlink', async (req, res, next) => {
  try {
    const { licenseId } = req.params;

    // Vérifier que la licence est liée au compte
    const license = req.member.licenses.find(l => l.id === parseInt(licenseId));
    if (!license) {
      throw new AppError('Licence non trouvée.', 404);
    }

    // Empêcher de détacher si c'est la seule licence "self"
    if (license.relationship === 'self' && req.member.licenses.filter(l => l.relationship === 'self').length === 1) {
      throw new AppError('Vous ne pouvez pas détacher votre propre licence.', 400);
    }

    // Supprimer la liaison
    await db.pool.execute(
      'DELETE FROM account_licenses WHERE account_id = ? AND license_id = ?',
      [req.member.id, licenseId]
    );

    // Si c'était la licence primaire, en définir une autre
    if (license.isPrimary && req.member.licenses.length > 1) {
      const otherLicense = req.member.licenses.find(l => l.id !== parseInt(licenseId));
      if (otherLicense) {
        await db.pool.execute(
          'UPDATE account_licenses SET is_primary = TRUE WHERE account_id = ? AND license_id = ?',
          [req.member.id, otherLicense.id]
        );
      }
    }

    await logMemberActivity(req.member.id, parseInt(licenseId), 'license_unlinked', {}, req);

    res.json({
      success: true,
      message: 'Licence détachée de votre compte.'
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/member/licenses/:id/request-link - Demander à rattacher
// =====================================================
router.post('/:licenseId/request-link', async (req, res, next) => {
  try {
    const { licenseId } = req.params;
    const { relationship, message } = req.body;

    // Vérifier que la licence existe
    const [licenses] = await db.pool.execute(
      'SELECT id, license_number, first_name, last_name FROM licenses WHERE id = ? AND is_active = TRUE',
      [licenseId]
    );

    if (!licenses.length) {
      throw new AppError('Licence non trouvée.', 404);
    }

    const license = licenses[0];

    // Vérifier si pas déjà liée
    const [existingLink] = await db.pool.execute(
      'SELECT id FROM account_licenses WHERE license_id = ?',
      [licenseId]
    );

    if (existingLink.length) {
      throw new AppError('Cette licence est déjà rattachée à un compte.', 400);
    }

    // Envoyer une notification aux admins
    await sendEmail({
      to: config.email.contactEmail,
      subject: `[Magny FC 78] Demande de rattachement de licence`,
      text: `
Demande de rattachement de licence

Demandeur: ${req.member.fullName} (${req.member.email})
Licence demandée: ${license.first_name} ${license.last_name} (${license.license_number})
Relation déclarée: ${relationship || 'Non précisée'}

Message: ${message || 'Aucun message'}

Action requise: Connectez-vous à l'interface admin pour valider ou refuser cette demande.
      `,
      html: `
<h2>Demande de rattachement de licence</h2>
<p><strong>Demandeur:</strong> ${req.member.fullName} (${req.member.email})</p>
<p><strong>Licence demandée:</strong> ${license.first_name} ${license.last_name} (${license.license_number})</p>
<p><strong>Relation:</strong> ${relationship || 'Non précisée'}</p>
<p><strong>Message:</strong> ${message || 'Aucun message'}</p>
      `
    });

    await logMemberActivity(req.member.id, parseInt(licenseId), 'license_link_requested', {
      relationship,
      message
    }, req);

    res.json({
      success: true,
      message: 'Votre demande a été envoyée. Un administrateur vous contactera.'
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// Helper: Calculer l'âge
// =====================================================
function calculateAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

module.exports = router;

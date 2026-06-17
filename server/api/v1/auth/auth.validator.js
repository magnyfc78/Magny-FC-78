/**
 * Schémas de validation Joi — endpoints auth v1.
 * Réutilise le middleware générique `validate` du repo.
 */

const Joi = require('joi');

// Politique de mot de passe (alignée sur le validator historique du repo).
const password = Joi.string().min(8).max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
  .required()
  .messages({
    'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
    'string.pattern.base': 'Le mot de passe doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial'
  });

const email = Joi.string().email().max(255).required()
  .messages({ 'string.email': 'Email invalide', 'string.empty': 'L\'email est requis' });

const name = Joi.string().min(2).max(100);

// Numéro de licence : alphanumérique FFF
const licenseNumber = Joi.string().pattern(/^[A-Za-z0-9]{4,50}$/)
  .messages({ 'string.pattern.base': 'Numéro de licence invalide' });

// Date de naissance ISO (YYYY-MM-DD)
const birthDate = Joi.date().iso().less('now')
  .messages({ 'date.less': 'Date de naissance invalide' });

const schemas = {
  checkEmail: Joi.object({ email }),

  register: Joi.object({
    email,
    password,
    first_name: name.required(),
    last_name: name.required(),
    // Licence optionnelle : si l'un est fourni, l'autre devient requis.
    license_number: licenseNumber.optional(),
    birth_date: birthDate.optional()
  }).and('license_number', 'birth_date')
    .messages({ 'object.and': 'Numéro de licence et date de naissance doivent être fournis ensemble' }),

  registerWithInvitation: Joi.object({
    invitation_code: Joi.string().min(4).max(100).required(),
    email,
    password,
    first_name: name.required(),
    last_name: name.required()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  forgotPassword: Joi.object({ email: Joi.string().email().required() }),

  resetPassword: Joi.object({
    token: Joi.string().min(10).max(200).required(),
    password
  })
};

module.exports = schemas;

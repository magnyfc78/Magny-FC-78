/**
 * Validation des données avec Joi
 * Protection contre les données malformées
 */

const Joi = require('joi');

// Options de validation
const validationOptions = {
  abortEarly: false, // Retourne toutes les erreurs
  stripUnknown: true, // Supprime les champs non définis
  errors: {
    wrap: { label: '' }
  }
};

// Middleware de validation générique
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, validationOptions);
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        error: 'Données invalides',
        details: errors
      });
    }
    
    req.body = value; // Utilise les données nettoyées
    next();
  };
};

// =====================================================
// SCHÉMAS DE VALIDATION
// =====================================================

// Authentification
const schemas = {
  // Inscription
  register: Joi.object({
    nom: Joi.string().min(2).max(100).required()
      .messages({ 'string.empty': 'Le nom est requis' }),
    email: Joi.string().email().required()
      .messages({ 'string.email': 'Email invalide' }),
    password: Joi.string().min(8).max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
        'string.pattern.base': 'Le mot de passe doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial'
      }),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required()
      .messages({ 'any.only': 'Les mots de passe ne correspondent pas' })
  }),

  // Connexion
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // Contact
  contact: Joi.object({
    nom: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    sujet: Joi.string().max(255).default('Autre'),
    message: Joi.string().min(10).max(5000).required()
      .messages({ 'string.min': 'Le message doit contenir au moins 10 caractères' })
  }),

  // Équipe
  equipe: Joi.object({
    nom: Joi.string().min(2).max(100).required(),
    categorie_id: Joi.number().integer().positive().required(),
    division: Joi.string().max(50).allow('', null),
    coach: Joi.string().max(100).allow('', null),
    description: Joi.string().max(2000).allow('', null)
  }),

  // Match
  match: Joi.object({
    equipe_id: Joi.number().integer().positive().required(),
    adversaire: Joi.string().min(2).max(100).required(),
    date_match: Joi.date().iso().required(),
    lieu: Joi.string().valid('domicile', 'exterieur').default('domicile'),
    competition: Joi.string().max(100).allow('', null)
  }),

  // Score
  score: Joi.object({
    score_domicile: Joi.number().integer().min(0).max(99).required(),
    score_exterieur: Joi.number().integer().min(0).max(99).required()
  }),

  // Actualité
  actualite: Joi.object({
    titre: Joi.string().min(5).max(255).required(),
    contenu: Joi.string().max(50000).allow('', null),
    extrait: Joi.string().max(500).allow('', null),
    categorie: Joi.string().valid('Match', 'Club', 'Événement', 'Autre').default('Club')
  }),

  // Paramètres de requête (query string)
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().max(50).default('id'),
    order: Joi.string().valid('asc', 'desc').default('desc')
  })
};

module.exports = {
  validate,
  schemas
};

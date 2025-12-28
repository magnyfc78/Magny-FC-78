#!/usr/bin/env node
/**
 * Script de réinitialisation du mot de passe administrateur
 *
 * Usage:
 *   node scripts/reset-admin-password.js [nouveau_mot_de_passe]
 *
 * Si aucun mot de passe n'est fourni, un mot de passe temporaire sera généré.
 *
 * Exemple:
 *   node scripts/reset-admin-password.js MonNouveauMotDePasse123!
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'magny_fc_78',
};

// Email de l'admin par défaut
const ADMIN_EMAIL = 'admin@magnyfc78.fr';

// Génération d'un mot de passe sécurisé aléatoire
function generateSecurePassword(length = 16) {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '@$!%*?&';
  const all = lowercase + uppercase + numbers + special;

  let password = '';
  // S'assurer qu'on a au moins un caractère de chaque type
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += special[crypto.randomInt(special.length)];

  // Compléter avec des caractères aléatoires
  for (let i = password.length; i < length; i++) {
    password += all[crypto.randomInt(all.length)];
  }

  // Mélanger le mot de passe
  return password.split('').sort(() => crypto.randomInt(3) - 1).join('');
}

async function resetAdminPassword() {
  let connection;

  try {
    console.log('\n=== RESET MOT DE PASSE ADMIN MAGNY FC 78 ===\n');

    // Récupérer le mot de passe depuis les arguments ou en générer un
    let newPassword = process.argv[2];
    let isGenerated = false;

    if (!newPassword) {
      newPassword = generateSecurePassword();
      isGenerated = true;
      console.log('Aucun mot de passe fourni, génération automatique...\n');
    }

    // Valider le mot de passe
    if (newPassword.length < 8) {
      console.error('ERREUR: Le mot de passe doit contenir au moins 8 caractères');
      process.exit(1);
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      console.error('ERREUR: Le mot de passe doit contenir:');
      console.error('  - Au moins une minuscule');
      console.error('  - Au moins une majuscule');
      console.error('  - Au moins un chiffre');
      console.error('  - Au moins un caractère spécial (@$!%*?&)');
      process.exit(1);
    }

    // Connexion à la base de données
    console.log(`Connexion à MySQL: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    connection = await mysql.createConnection(dbConfig);
    console.log('Connexion réussie!\n');

    // Vérifier si l'utilisateur admin existe
    const [users] = await connection.execute(
      'SELECT id, email, nom FROM users WHERE email = ?',
      [ADMIN_EMAIL]
    );

    if (users.length === 0) {
      console.error(`ERREUR: Aucun utilisateur trouvé avec l'email: ${ADMIN_EMAIL}`);
      console.log('\nCréation du compte admin...');

      // Créer le compte admin s'il n'existe pas
      const { v4: uuidv4 } = require('uuid');
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      await connection.execute(
        `INSERT INTO users (id, nom, prenom, email, password, role, actif, created_at)
         VALUES (?, ?, ?, ?, ?, 'admin', 1, NOW())`,
        [uuidv4(), 'Administrateur', 'Magny FC', ADMIN_EMAIL, hashedPassword]
      );

      console.log('Compte admin créé avec succès!\n');
    } else {
      // Mettre à jour le mot de passe
      console.log(`Utilisateur trouvé: ${users[0].nom} (${users[0].email})`);
      console.log('Mise à jour du mot de passe...\n');

      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      await connection.execute(
        'UPDATE users SET password = ?, updated_at = NOW() WHERE email = ?',
        [hashedPassword, ADMIN_EMAIL]
      );
    }

    console.log('========================================');
    console.log('MOT DE PASSE MIS A JOUR AVEC SUCCES!');
    console.log('========================================\n');
    console.log('Informations de connexion:');
    console.log(`  Email:     ${ADMIN_EMAIL}`);
    console.log(`  Mot de passe: ${newPassword}`);
    if (isGenerated) {
      console.log('\n  (Mot de passe généré automatiquement - à changer après connexion)');
    }
    console.log('\n========================================\n');

  } catch (error) {
    console.error('\nERREUR:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('Impossible de se connecter à MySQL. Vérifiez:');
      console.error('  - Que MySQL est en cours d\'exécution');
      console.error('  - Les variables d\'environnement DB_HOST, DB_PORT, DB_USER, DB_PASSWORD');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

resetAdminPassword();

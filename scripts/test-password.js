#!/usr/bin/env node
/**
 * Script de test du mot de passe admin
 *
 * Usage:
 *   node scripts/test-password.js [email] [password]
 *
 * Exemple:
 *   node scripts/test-password.js admin@magnyfc78.fr Admin123!
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'magny_fc_78',
};

async function testPassword() {
  let connection;

  try {
    const email = process.argv[2] || 'admin@magnyfc78.fr';
    const password = process.argv[3] || 'Admin123!';

    console.log('\n=== TEST MOT DE PASSE MAGNY FC 78 ===\n');
    console.log(`Email: ${email}`);
    console.log(`Mot de passe à tester: ${password}`);
    console.log(`Longueur du mot de passe: ${password.length} caractères\n`);

    // Connexion à la base de données
    console.log(`Connexion à MySQL: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    connection = await mysql.createConnection(dbConfig);
    console.log('Connexion réussie!\n');

    // Récupérer l'utilisateur
    const [users] = await connection.execute(
      'SELECT id, email, password, role, actif FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (users.length === 0) {
      console.error(`❌ Aucun utilisateur trouvé avec l'email: ${email}`);
      process.exit(1);
    }

    const user = users[0];
    console.log('Utilisateur trouvé:');
    console.log(`  - ID: ${user.id}`);
    console.log(`  - Email: ${user.email}`);
    console.log(`  - Role: ${user.role}`);
    console.log(`  - Actif: ${user.actif ? 'Oui' : 'Non'}`);
    console.log(`  - Hash stocké: ${user.password}`);
    console.log(`  - Longueur du hash: ${user.password?.length} caractères`);
    console.log(`  - Format bcrypt valide: ${user.password?.startsWith('$2') ? 'Oui' : 'Non'}\n`);

    // Test bcrypt
    console.log('=== Test bcrypt.compare() ===');
    const isValid = await bcrypt.compare(password, user.password);
    console.log(`Résultat: ${isValid ? '✅ VALIDE' : '❌ INVALIDE'}\n`);

    if (!isValid) {
      console.log('=== Diagnostic ===');

      // Vérifier si le hash est tronqué
      if (user.password.length < 60) {
        console.log('⚠️  Le hash semble tronqué (devrait faire 60 caractères)');
      }

      // Créer un nouveau hash pour comparaison
      const newHash = await bcrypt.hash(password, 12);
      console.log(`Nouveau hash généré: ${newHash}`);

      // Vérifier que le nouveau hash fonctionne
      const newHashValid = await bcrypt.compare(password, newHash);
      console.log(`Nouveau hash valide: ${newHashValid ? 'Oui' : 'Non'}`);

      console.log('\n=== Solution proposée ===');
      console.log('Exécutez cette commande pour réinitialiser le mot de passe:');
      console.log(`  node scripts/reset-admin-password.js ${password}\n`);
    }

    console.log('========================================\n');

  } catch (error) {
    console.error('\nERREUR:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('Impossible de se connecter à MySQL. Vérifiez que MySQL est en cours d\'exécution.');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testPassword();

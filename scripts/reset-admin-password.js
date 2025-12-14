/**
 * Script to reset admin password
 * Run with: node scripts/reset-admin-password.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const DEFAULT_PASSWORD = 'Admin123!';

async function resetAdminPassword() {
  console.log('Resetting admin password...\n');

  // Create database connection
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'magnyfc78_db'
  });

  try {
    // Generate new password hash
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, saltRounds);

    console.log('New password hash generated');
    console.log('Hash:', hashedPassword);

    // Update admin password
    const [result] = await connection.execute(
      'UPDATE users SET password = ? WHERE email = ?',
      [hashedPassword, 'admin@magnyfc78.fr']
    );

    if (result.affectedRows > 0) {
      console.log('\nAdmin password updated successfully!');
      console.log('Email: admin@magnyfc78.fr');
      console.log('Password:', DEFAULT_PASSWORD);
    } else {
      // If no admin exists, create one
      console.log('\nNo admin found, creating admin user...');
      const { v4: uuidv4 } = require('uuid');

      await connection.execute(
        `INSERT INTO users (id, nom, prenom, email, password, role, actif)
         VALUES (?, 'Admin', 'MFC', 'admin@magnyfc78.fr', ?, 'admin', 1)`,
        [uuidv4(), hashedPassword]
      );

      console.log('Admin user created successfully!');
      console.log('Email: admin@magnyfc78.fr');
      console.log('Password:', DEFAULT_PASSWORD);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

resetAdminPassword();

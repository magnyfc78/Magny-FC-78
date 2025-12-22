#!/usr/bin/env node

/**
 * Script de génération de secrets sécurisés
 * Usage: npm run generate-secret
 */

const crypto = require('crypto');

// Génère une clé aléatoire de 64 caractères hexadécimaux (256 bits)
const generateSecret = (length = 64) => {
  return crypto.randomBytes(length / 2).toString('hex');
};

// Génère plusieurs formats de secrets
console.log('\n🔐 Génération de secrets sécurisés\n');
console.log('=' .repeat(60));

console.log('\n📌 JWT_SECRET (recommandé):');
console.log(`   ${generateSecret(64)}`);

console.log('\n📌 Secret court (32 chars):');
console.log(`   ${generateSecret(32)}`);

console.log('\n📌 Secret Base64 (pour autres usages):');
console.log(`   ${crypto.randomBytes(32).toString('base64')}`);

console.log('\n' + '='.repeat(60));
console.log('\n✅ Copiez le secret JWT dans votre fichier .env.production');
console.log('⚠️  Ne partagez JAMAIS ces secrets !\n');

#!/usr/bin/env node

/**
 * Import des licences FFF (Partie 7) — CLI
 *
 * Lit un export CSV (FootClubs/FFF) et upsert les licences dans la table
 * `licenses` (clé : numero_licence + saison). Logique de parsing partagée
 * avec l'endpoint admin via server/utils/license-import.js.
 *
 * Usage:
 *   node scripts/import-licenses.js --file=licences-2024-2025.csv --season=2024-2025
 *   node scripts/import-licenses.js --file=... --season=... --club=1 --dry-run
 *
 * Colonnes CSV (insensible à la casse/aux accents, ordre libre) :
 *   Numéro licence, Nom, Prénom, Date naissance, Sexe, Email, Téléphone,
 *   Adresse, CP, Ville, Catégorie
 */

const fs = require('fs');
const path = require('path');

require('../server/config');
const db = require('../server/config/database');
const { importLicenses } = require('../server/utils/license-import');

const parseArgs = () => {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] === undefined ? true : m[2];
  });
  return args;
};

const main = async () => {
  const args = parseArgs();

  if (!args.file || !args.season) {
    console.error('Usage: node scripts/import-licenses.js --file=<csv> --season=<saison> [--club=1] [--dry-run]');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier introuvable : ${filePath}`);
    process.exit(1);
  }

  const clubId = parseInt(args.club, 10) || 1;
  const season = String(args.season);
  const dryRun = Boolean(args['dry-run']);

  console.log(`\n📥 Import licences — saison ${season} (club ${clubId})${dryRun ? ' [DRY-RUN]' : ''}`);
  console.log(`   Fichier : ${filePath}\n`);

  const raw = fs.readFileSync(filePath, 'utf8');

  let result;
  try {
    result = await importLicenses({ raw, season, clubId, dryRun });
  } catch (err) {
    console.error('❌ Erreur :', err.message);
    await db.pool.end();
    process.exit(1);
  }

  const { stats, problems } = result;
  console.log('─'.repeat(50));
  console.log(`   Lignes lues   : ${stats.total}`);
  console.log(`   Insérées      : ${stats.inserted}`);
  console.log(`   Mises à jour  : ${stats.updated}`);
  console.log(`   Ignorées      : ${stats.skipped}`);
  console.log(`   Erreurs       : ${stats.errors}`);
  console.log('─'.repeat(50));

  if (problems.length) {
    console.log('\n⚠️  Détails :');
    problems.slice(0, 30).forEach((p) => console.log(`   - ${p}`));
    if (problems.length > 30) console.log(`   ... (+${problems.length - 30} autres)`);
  }

  await db.pool.end();
  console.log(`\n✅ Import terminé${dryRun ? ' (dry-run, aucune écriture)' : ''}.\n`);
};

main().catch((err) => {
  console.error('❌ Échec de l\'import :', err);
  process.exit(1);
});

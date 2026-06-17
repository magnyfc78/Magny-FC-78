/**
 * Parsing & import des licences FFF (logique partagée).
 * Utilisé par le script CLI (scripts/import-licenses.js) ET par l'endpoint
 * admin POST /api/v1/admin/licenses/import.
 */

const { parse } = require('csv-parse/sync');
const License = require('../models/License');

// Normalise un en-tête : minuscule, sans accent, sans ponctuation.
const normalizeHeader = (h) =>
  String(h)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const HEADER_MAP = {
  'numero licence': 'numero_licence',
  'numero de licence': 'numero_licence',
  'licence': 'numero_licence',
  'nom': 'nom',
  'prenom': 'prenom',
  'date naissance': 'date_naissance',
  'date de naissance': 'date_naissance',
  'ne le': 'date_naissance',
  'sexe': 'sexe',
  'genre': 'sexe',
  'email': 'email',
  'mail': 'email',
  'courriel': 'email',
  'telephone': 'telephone',
  'tel': 'telephone',
  'portable': 'telephone',
  'adresse': 'adresse',
  'cp': 'code_postal',
  'code postal': 'code_postal',
  'ville': 'ville',
  'categorie': 'categorie'
};

// Date FFF -> 'YYYY-MM-DD' (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
const toIsoDate = (value) => {
  if (!value) return null;
  const v = String(value).trim();
  let m = v.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
};

const toSexe = (value) => {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  if (['M', 'H', 'MASCULIN', 'HOMME', 'GARCON'].includes(v)) return 'M';
  if (['F', 'FEMININ', 'FEMME', 'FILLE'].includes(v)) return 'F';
  return null;
};

const clean = (value) => {
  if (value === undefined || value === null) return null;
  const v = String(value).trim();
  return v === '' ? null : v;
};

const detectDelimiter = (sample) => {
  const firstLine = sample.split(/\r?\n/)[0] || '';
  return (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
};

/**
 * Parse un CSV brut en lignes-licences normalisées (champs internes).
 * @param {string} raw Contenu CSV.
 * @returns {Array<object>} lignes brutes (clés internes).
 */
const parseCsv = (raw) => {
  const content = String(raw).replace(/^﻿/, ''); // strip BOM
  return parse(content, {
    columns: (headerRow) => headerRow.map((h) => HEADER_MAP[normalizeHeader(h)] || normalizeHeader(h)),
    delimiter: detectDelimiter(content),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });
};

/**
 * Importe des licences depuis un CSV brut.
 * @param {object} opts { raw, season, clubId=1, dryRun=false }
 * @returns {Promise<{stats, problems}>}
 */
const importLicenses = async ({ raw, season, clubId = 1, dryRun = false }) => {
  if (!season) throw new Error('Saison requise');

  const records = parseCsv(raw);
  const stats = { total: records.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  const problems = [];

  for (let i = 0; i < records.length; i += 1) {
    const row = records[i];
    const lineNo = i + 2;

    const numero = clean(row.numero_licence);
    const nom = clean(row.nom);
    const prenom = clean(row.prenom);
    const dateNaissance = toIsoDate(row.date_naissance);

    if (!numero || !nom || !prenom || !dateNaissance) {
      stats.skipped += 1;
      problems.push(`L${lineNo}: ignorée (numero/nom/prenom/date_naissance requis)`);
      continue;
    }

    if (dryRun) { stats.inserted += 1; continue; }

    try {
      const outcome = await License.upsert({
        club_id: clubId,
        numero_licence: numero,
        nom,
        prenom,
        date_naissance: dateNaissance,
        sexe: toSexe(row.sexe),
        email: clean(row.email),
        telephone: clean(row.telephone),
        adresse: clean(row.adresse),
        code_postal: clean(row.code_postal),
        ville: clean(row.ville),
        categorie: clean(row.categorie),
        saison: season,
        statut: 'active',
        source: 'import_fff'
      });
      stats[outcome] += 1;
    } catch (err) {
      stats.errors += 1;
      problems.push(`L${lineNo} (${numero}): ${err.message}`);
    }
  }

  return { stats, problems };
};

module.exports = {
  normalizeHeader,
  toIsoDate,
  toSexe,
  clean,
  detectDelimiter,
  parseCsv,
  importLicenses
};

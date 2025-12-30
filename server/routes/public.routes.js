/**
 * Routes publiques - Lecture seule pour le frontend
 */

const express = require('express');
const db = require('../config/database');

const router = express.Router();

// =====================================================
// CONFIGURATION SITE
// =====================================================
router.get('/config', async (req, res, next) => {
  try {
    const [rows] = await db.pool.execute('SELECT cle, valeur, type FROM site_config');
    const config = {};
    rows.forEach(r => {
      config[r.cle] = r.type === 'json' ? JSON.parse(r.valeur || '{}') : r.valeur;
    });
    res.json({ success: true, data: config });
  } catch (error) { next(error); }
});

// =====================================================
// MENU
// =====================================================
router.get('/menu', async (req, res, next) => {
  try {
    const [items] = await db.pool.execute(
      'SELECT id, label, url, icone, parent_id, target FROM menu_items WHERE actif = 1 ORDER BY ordre'
    );
    res.json({ success: true, data: { items } });
  } catch (error) { next(error); }
});

// =====================================================
// CATÉGORIES
// =====================================================
router.get('/categories', async (req, res, next) => {
  try {
    const [categories] = await db.pool.execute(
      'SELECT id, nom, slug, couleur FROM categories WHERE actif = 1 ORDER BY ordre'
    );
    res.json({ success: true, data: { categories } });
  } catch (error) { next(error); }
});

// =====================================================
// ÉQUIPES
// =====================================================
router.get('/equipes', async (req, res, next) => {
  try {
    const { categorie } = req.query;
    let sql = `
      SELECT e.id, e.nom, e.slug, e.division, e.coach, e.description, e.photo, e.photo_equipe,
             e.horaires_entrainement, e.terrain,
             c.nom as categorie_nom, c.slug as categorie_slug,
             (SELECT COUNT(*) FROM joueurs WHERE equipe_id = e.id AND actif = 1) as nb_joueurs
      FROM equipes e
      LEFT JOIN categories c ON e.categorie_id = c.id
      WHERE e.actif = 1
    `;
    const params = [];
    
    if (categorie && categorie !== 'Tous') {
      sql += ' AND c.nom = ?';
      params.push(categorie);
    }
    sql += ' ORDER BY c.ordre, e.ordre, e.nom';
    
    const [equipes] = await db.pool.execute(sql, params);
    res.json({ success: true, data: { equipes } });
  } catch (error) { next(error); }
});

router.get('/equipes/:slug', async (req, res, next) => {
  try {
    const [equipes] = await db.pool.execute(`
      SELECT e.*, c.nom as categorie_nom FROM equipes e
      LEFT JOIN categories c ON e.categorie_id = c.id
      WHERE e.slug = ? AND e.actif = 1
    `, [req.params.slug]);
    
    if (!equipes.length) {
      return res.status(404).json({ success: false, error: 'Équipe non trouvée' });
    }
    
    const equipe = equipes[0];
    
    // Joueurs
    const [joueurs] = await db.pool.execute(
      'SELECT id, nom, prenom, poste, numero, photo FROM joueurs WHERE equipe_id = ? AND actif = 1 ORDER BY numero',
      [equipe.id]
    );
    equipe.joueurs = joueurs;
    
    // Matchs
    const [matchs] = await db.pool.execute(`
      SELECT * FROM matchs WHERE equipe_id = ? AND visible = 1 ORDER BY date_match DESC LIMIT 10
    `, [equipe.id]);
    equipe.matchs = matchs;
    
    res.json({ success: true, data: { equipe } });
  } catch (error) { next(error); }
});

// =====================================================
// MATCHS
// =====================================================
router.get('/matchs', async (req, res, next) => {
  try {
    const { type = 'a_venir', equipe, limit = 20 } = req.query;
    
    let sql = `
      SELECT m.*, e.nom as equipe_nom, e.slug as equipe_slug, c.nom as categorie
      FROM matchs m
      LEFT JOIN equipes e ON m.equipe_id = e.id
      LEFT JOIN categories c ON e.categorie_id = c.id
      WHERE m.visible = 1
    `;
    const params = [];
    
    if (type !== 'tous') {
      sql += ' AND m.statut = ?';
      params.push(type);
    }
    if (equipe) {
      sql += ' AND e.slug = ?';
      params.push(equipe);
    }
    
    sql += ` ORDER BY m.date_match ${type === 'termine' ? 'DESC' : 'ASC'} LIMIT ?`;
    params.push(parseInt(limit) || 20);

    const matchs = await db.query(sql, params);
    
    // Formater les dates
    const formatted = matchs.map(m => {
      const d = new Date(m.date_match);
      return {
        ...m,
        date_formatee: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        heure: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        domicile: m.lieu === 'domicile',
        equipe_dom: m.lieu === 'domicile' ? 'Magny FC 78' : m.adversaire,
        equipe_ext: m.lieu === 'domicile' ? m.adversaire : 'Magny FC 78'
      };
    });
    
    res.json({ success: true, data: { matchs: formatted } });
  } catch (error) { next(error); }
});

// =====================================================
// ACTUALITÉS
// =====================================================
router.get('/actualites', async (req, res, next) => {
  try {
    const { categorie, limit = 10, page = 1 } = req.query;
    const offset = (page - 1) * limit;
    
    let sql = 'SELECT id, titre, slug, extrait, image, categorie, vues, date_publication FROM actualites WHERE publie = 1';
    const params = [];
    
    if (categorie && categorie !== 'Tous') {
      sql += ' AND categorie = ?';
      params.push(categorie);
    }
    
    sql += ' ORDER BY date_publication DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit) || 10, parseInt(offset) || 0);

    const actualites = await db.query(sql, params);
    
    const formatted = actualites.map(a => ({
      ...a,
      date_formatee: new Date(a.date_publication).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric'
      })
    }));
    
    res.json({ success: true, data: { actualites: formatted } });
  } catch (error) { next(error); }
});

router.get('/actualites/:slug', async (req, res, next) => {
  try {
    const [actus] = await db.pool.execute(
      'SELECT * FROM actualites WHERE slug = ? AND publie = 1',
      [req.params.slug]
    );
    
    if (!actus.length) {
      return res.status(404).json({ success: false, error: 'Article non trouvé' });
    }
    
    // Incrémenter les vues
    await db.pool.execute('UPDATE actualites SET vues = vues + 1 WHERE id = ?', [actus[0].id]);
    
    res.json({ success: true, data: { actualite: actus[0] } });
  } catch (error) { next(error); }
});

// =====================================================
// GALERIE - CATÉGORIES
// =====================================================
router.get('/galerie/categories', async (req, res, next) => {
  try {
    const [categories] = await db.pool.execute(`
      SELECT gc.id, gc.nom, gc.slug, gc.description, gc.icone, gc.couleur,
             (SELECT COUNT(*) FROM galerie_albums WHERE categorie_id = gc.id AND actif = 1) as nb_albums
      FROM galerie_categories gc
      WHERE gc.actif = 1
      ORDER BY gc.ordre
    `);
    res.json({ success: true, data: { categories } });
  } catch (error) { next(error); }
});

// =====================================================
// GALERIE - ALBUMS
// =====================================================
router.get('/galerie', async (req, res, next) => {
  try {
    const { categorie } = req.query;

    let sql = `
      SELECT a.id, a.titre, a.slug, a.description, a.image_couverture, a.date_evenement, a.annee,
             gc.nom as categorie_nom, gc.slug as categorie_slug, gc.couleur as categorie_couleur,
             (SELECT COUNT(*) FROM galerie_photos WHERE album_id = a.id AND actif = 1) as nb_photos
      FROM galerie_albums a
      LEFT JOIN galerie_categories gc ON a.categorie_id = gc.id
      WHERE a.actif = 1
    `;
    const params = [];

    if (categorie && categorie !== 'Tous') {
      sql += ' AND gc.slug = ?';
      params.push(categorie);
    }

    sql += ' ORDER BY a.date_evenement DESC';

    const [albums] = await db.pool.execute(sql, params);
    res.json({ success: true, data: { albums } });
  } catch (error) { next(error); }
});

// Route spéciale pour l'histoire du club (timeline + contenu dynamique)
router.get('/galerie/histoire', async (req, res, next) => {
  try {
    // Récupérer les albums de la catégorie Histoire
    const [albums] = await db.pool.execute(`
      SELECT a.id, a.titre, a.slug, a.description, a.image_couverture, a.date_evenement, a.annee,
             (SELECT COUNT(*) FROM galerie_photos WHERE album_id = a.id AND actif = 1) as nb_photos
      FROM galerie_albums a
      LEFT JOIN galerie_categories gc ON a.categorie_id = gc.id
      WHERE a.actif = 1 AND gc.slug = 'histoire'
      ORDER BY a.annee ASC, a.date_evenement ASC
    `);

    // Récupérer la configuration de la page Histoire
    const [configRows] = await db.pool.execute('SELECT cle, valeur FROM histoire_config');
    const config = {};
    configRows.forEach(row => {
      config[row.cle] = row.valeur;
    });

    // Récupérer les moments clés
    const [moments] = await db.pool.execute(
      'SELECT id, annee, titre, description, image FROM histoire_moments WHERE actif = 1 ORDER BY ordre, annee'
    );

    // Grouper les albums par décennie pour la timeline
    const timeline = {};
    albums.forEach(album => {
      const decade = Math.floor(album.annee / 10) * 10;
      const decadeLabel = `${decade}s`;
      if (!timeline[decadeLabel]) {
        timeline[decadeLabel] = [];
      }
      timeline[decadeLabel].push(album);
    });

    // Calculer les stats dynamiques
    const anneeCreation = parseInt(config.annee_creation) || 2000;
    const anneesExistence = new Date().getFullYear() - anneeCreation;

    res.json({
      success: true,
      data: {
        albums,
        timeline,
        config: {
          intro_titre: config.intro_titre || '24 ans de passion footballistique',
          intro_texte: config.intro_texte || '',
          slogan: config.slogan || 'Magny FC 78 - Depuis 2000',
          annee_creation: anneeCreation,
          annees_existence: anneesExistence,
          nombre_licencies: config.nombre_licencies || '300+',
          nombre_equipes: config.nombre_equipes || '17'
        },
        moments
      }
    });
  } catch (error) { next(error); }
});

router.get('/galerie/:slug', async (req, res, next) => {
  try {
    // Éviter de matcher "categories" et "histoire" comme des slugs
    if (req.params.slug === 'categories' || req.params.slug === 'histoire') {
      return next();
    }

    const [albums] = await db.pool.execute(`
      SELECT a.*, gc.nom as categorie_nom, gc.slug as categorie_slug, gc.couleur as categorie_couleur
      FROM galerie_albums a
      LEFT JOIN galerie_categories gc ON a.categorie_id = gc.id
      WHERE a.slug = ? AND a.actif = 1
    `, [req.params.slug]);

    if (!albums.length) {
      return res.status(404).json({ success: false, error: 'Album non trouvé' });
    }

    const album = albums[0];
    const [photos] = await db.pool.execute(
      'SELECT id, titre, description, fichier, thumbnail FROM galerie_photos WHERE album_id = ? AND actif = 1 ORDER BY ordre',
      [album.id]
    );
    album.photos = photos;

    res.json({ success: true, data: { album } });
  } catch (error) { next(error); }
});

// =====================================================
// PARTENAIRES
// =====================================================
router.get('/partenaires', async (req, res, next) => {
  try {
    const [partenaires] = await db.pool.execute(
      'SELECT id, nom, slug, description, logo, site_web, type FROM partenaires WHERE actif = 1 ORDER BY ordre'
    );
    res.json({ success: true, data: { partenaires } });
  } catch (error) { next(error); }
});

// =====================================================
// CONTACT
// =====================================================
router.post('/contact', async (req, res, next) => {
  try {
    const { nom, email, telephone, sujet, message } = req.body;
    
    if (!nom || !email || !message) {
      return res.status(400).json({ success: false, error: 'Champs requis manquants' });
    }
    
    const ip = req.ip || req.connection.remoteAddress;
    
    await db.pool.execute(
      'INSERT INTO contacts (nom, email, telephone, sujet, message, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [nom, email.toLowerCase(), telephone, sujet || 'Autre', message, ip]
    );
    
    res.status(201).json({ success: true, message: 'Message envoyé avec succès' });
  } catch (error) { next(error); }
});

// =====================================================
// PAGES
// =====================================================
router.get('/pages/:slug', async (req, res, next) => {
  try {
    const [pages] = await db.pool.execute(
      'SELECT titre, contenu, meta_description, image FROM pages WHERE slug = ? AND publie = 1',
      [req.params.slug]
    );
    
    if (!pages.length) {
      return res.status(404).json({ success: false, error: 'Page non trouvée' });
    }
    
    res.json({ success: true, data: { page: pages[0] } });
  } catch (error) { next(error); }
});

module.exports = router;

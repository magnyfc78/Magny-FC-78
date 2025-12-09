/**
 * Routes Administration - CRUD complet pour tout le contenu
 */

const express = require('express');
const db = require('../config/database');
const { protect, restrictTo } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Toutes les routes admin nécessitent authentification + rôle admin
router.use(protect);
router.use(restrictTo('admin', 'editor'));

// =====================================================
// DASHBOARD
// =====================================================
router.get('/dashboard', async (req, res, next) => {
  try {
    const [[{total_equipes}]] = await db.pool.execute('SELECT COUNT(*) as total_equipes FROM equipes WHERE actif = 1');
    const [[{total_joueurs}]] = await db.pool.execute('SELECT COUNT(*) as total_joueurs FROM joueurs WHERE actif = 1');
    const [[{total_matchs}]] = await db.pool.execute('SELECT COUNT(*) as total_matchs FROM matchs WHERE statut = "a_venir"');
    const [[{total_actus}]] = await db.pool.execute('SELECT COUNT(*) as total_actus FROM actualites WHERE publie = 1');
    const [[{messages_non_lus}]] = await db.pool.execute('SELECT COUNT(*) as messages_non_lus FROM contacts WHERE lu = 0');
    
    const [derniers_matchs] = await db.pool.execute(`
      SELECT m.*, e.nom as equipe_nom FROM matchs m 
      LEFT JOIN equipes e ON m.equipe_id = e.id 
      ORDER BY m.date_match DESC LIMIT 5
    `);
    
    const [dernieres_actus] = await db.pool.execute(
      'SELECT id, titre, categorie, date_publication FROM actualites ORDER BY created_at DESC LIMIT 5'
    );

    res.json({
      success: true,
      data: {
        stats: { total_equipes, total_joueurs, total_matchs, total_actus, messages_non_lus },
        derniers_matchs,
        dernieres_actus
      }
    });
  } catch (error) { next(error); }
});

// =====================================================
// CONFIGURATION DU SITE
// =====================================================
router.get('/config', async (req, res, next) => {
  try {
    const [rows] = await db.pool.execute('SELECT * FROM site_config ORDER BY groupe, cle');
    const config = {};
    rows.forEach(r => {
      if (!config[r.groupe]) config[r.groupe] = [];
      config[r.groupe].push(r);
    });
    res.json({ success: true, data: { config, raw: rows } });
  } catch (error) { next(error); }
});

router.put('/config/:cle', async (req, res, next) => {
  try {
    const { cle } = req.params;
    const { valeur } = req.body;
    await db.pool.execute('UPDATE site_config SET valeur = ? WHERE cle = ?', [valeur, cle]);
    await logActivity(req.user.id, 'update', 'site_config', null, { cle, valeur });
    res.json({ success: true, message: 'Configuration mise à jour' });
  } catch (error) { next(error); }
});

router.put('/config', async (req, res, next) => {
  try {
    const updates = req.body;
    for (const [cle, valeur] of Object.entries(updates)) {
      await db.pool.execute('UPDATE site_config SET valeur = ? WHERE cle = ?', [valeur, cle]);
    }
    await logActivity(req.user.id, 'update_batch', 'site_config', null, updates);
    res.json({ success: true, message: 'Configuration mise à jour' });
  } catch (error) { next(error); }
});

// =====================================================
// MENU
// =====================================================
router.get('/menu', async (req, res, next) => {
  try {
    const [items] = await db.pool.execute('SELECT * FROM menu_items ORDER BY ordre');
    res.json({ success: true, data: { items } });
  } catch (error) { next(error); }
});

router.post('/menu', async (req, res, next) => {
  try {
    const { label, url, icone, parent_id, ordre, actif, target } = req.body;
    const [result] = await db.pool.execute(
      'INSERT INTO menu_items (label, url, icone, parent_id, ordre, actif, target) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [label, url, icone, parent_id, ordre || 0, actif !== false, target || '_self']
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) { next(error); }
});

router.put('/menu/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { label, url, icone, parent_id, ordre, actif, target } = req.body;
    await db.pool.execute(
      'UPDATE menu_items SET label = ?, url = ?, icone = ?, parent_id = ?, ordre = ?, actif = ?, target = ? WHERE id = ?',
      [label, url, icone, parent_id, ordre, actif, target, id]
    );
    res.json({ success: true, message: 'Menu mis à jour' });
  } catch (error) { next(error); }
});

router.delete('/menu/:id', async (req, res, next) => {
  try {
    await db.pool.execute('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Élément supprimé' });
  } catch (error) { next(error); }
});

// =====================================================
// CATÉGORIES
// =====================================================
router.get('/categories', async (req, res, next) => {
  try {
    const [categories] = await db.pool.execute('SELECT * FROM categories ORDER BY ordre');
    res.json({ success: true, data: { categories } });
  } catch (error) { next(error); }
});

router.post('/categories', async (req, res, next) => {
  try {
    const { nom, slug, description, couleur, ordre } = req.body;
    const [result] = await db.pool.execute(
      'INSERT INTO categories (nom, slug, description, couleur, ordre) VALUES (?, ?, ?, ?, ?)',
      [nom, slug || nom.toLowerCase().replace(/\s+/g, '-'), description, couleur, ordre || 0]
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) { next(error); }
});

router.put('/categories/:id', async (req, res, next) => {
  try {
    const { nom, slug, description, couleur, ordre, actif } = req.body;
    await db.pool.execute(
      'UPDATE categories SET nom = ?, slug = ?, description = ?, couleur = ?, ordre = ?, actif = ? WHERE id = ?',
      [nom, slug, description, couleur, ordre, actif, req.params.id]
    );
    res.json({ success: true, message: 'Catégorie mise à jour' });
  } catch (error) { next(error); }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    await db.pool.execute('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Catégorie supprimée' });
  } catch (error) { next(error); }
});

// =====================================================
// ÉQUIPES (Admin CRUD)
// =====================================================
router.get('/equipes', async (req, res, next) => {
  try {
    const [equipes] = await db.pool.execute(`
      SELECT e.*, c.nom as categorie_nom,
        (SELECT COUNT(*) FROM joueurs WHERE equipe_id = e.id) as nb_joueurs
      FROM equipes e
      LEFT JOIN categories c ON e.categorie_id = c.id
      ORDER BY c.ordre, e.ordre, e.nom
    `);
    res.json({ success: true, data: { equipes } });
  } catch (error) { next(error); }
});

router.post('/equipes', async (req, res, next) => {
  try {
    const { nom, categorie_id, division, coach, assistant, description, horaires_entrainement, terrain } = req.body;
    const slug = nom.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const [result] = await db.pool.execute(
      `INSERT INTO equipes (nom, slug, categorie_id, division, coach, assistant, description, horaires_entrainement, terrain) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nom, slug, categorie_id, division, coach, assistant, description, horaires_entrainement, terrain]
    );
    await logActivity(req.user.id, 'create', 'equipes', result.insertId, { nom });
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) { next(error); }
});

router.put('/equipes/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nom, categorie_id, division, coach, assistant, description, horaires_entrainement, terrain, actif, ordre } = req.body;
    const slug = nom.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await db.pool.execute(
      `UPDATE equipes SET nom = ?, slug = ?, categorie_id = ?, division = ?, coach = ?, assistant = ?, 
       description = ?, horaires_entrainement = ?, terrain = ?, actif = ?, ordre = ? WHERE id = ?`,
      [nom, slug, categorie_id, division, coach, assistant, description, horaires_entrainement, terrain, actif, ordre, id]
    );
    await logActivity(req.user.id, 'update', 'equipes', id, { nom });
    res.json({ success: true, message: 'Équipe mise à jour' });
  } catch (error) { next(error); }
});

router.delete('/equipes/:id', async (req, res, next) => {
  try {
    await logActivity(req.user.id, 'delete', 'equipes', req.params.id);
    await db.pool.execute('DELETE FROM equipes WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Équipe supprimée' });
  } catch (error) { next(error); }
});

// =====================================================
// MATCHS (Admin CRUD)
// =====================================================
router.get('/matchs', async (req, res, next) => {
  try {
    const [matchs] = await db.pool.execute(`
      SELECT m.*, e.nom as equipe_nom FROM matchs m
      LEFT JOIN equipes e ON m.equipe_id = e.id
      ORDER BY m.date_match DESC
    `);
    res.json({ success: true, data: { matchs } });
  } catch (error) { next(error); }
});

router.post('/matchs', async (req, res, next) => {
  try {
    const { equipe_id, adversaire, date_match, lieu, adresse_match, competition, journee } = req.body;
    const [result] = await db.pool.execute(
      `INSERT INTO matchs (equipe_id, adversaire, date_match, lieu, adresse_match, competition, journee) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [equipe_id, adversaire, date_match, lieu || 'domicile', adresse_match, competition, journee]
    );
    await logActivity(req.user.id, 'create', 'matchs', result.insertId, { adversaire, date_match });
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) { next(error); }
});

router.put('/matchs/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { equipe_id, adversaire, date_match, lieu, adresse_match, competition, journee, 
            score_domicile, score_exterieur, resume, statut, visible } = req.body;
    await db.pool.execute(
      `UPDATE matchs SET equipe_id = ?, adversaire = ?, date_match = ?, lieu = ?, adresse_match = ?,
       competition = ?, journee = ?, score_domicile = ?, score_exterieur = ?, resume = ?, statut = ?, visible = ? WHERE id = ?`,
      [equipe_id, adversaire, date_match, lieu, adresse_match, competition, journee, 
       score_domicile, score_exterieur, resume, statut, visible, id]
    );
    await logActivity(req.user.id, 'update', 'matchs', id);
    res.json({ success: true, message: 'Match mis à jour' });
  } catch (error) { next(error); }
});

router.delete('/matchs/:id', async (req, res, next) => {
  try {
    await db.pool.execute('DELETE FROM matchs WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Match supprimé' });
  } catch (error) { next(error); }
});

// =====================================================
// ACTUALITÉS (Admin CRUD)
// =====================================================
router.get('/actualites', async (req, res, next) => {
  try {
    const [actualites] = await db.pool.execute(`
      SELECT a.*, u.nom as auteur_nom FROM actualites a
      LEFT JOIN users u ON a.auteur_id = u.id
      ORDER BY a.date_publication DESC
    `);
    res.json({ success: true, data: { actualites } });
  } catch (error) { next(error); }
});

router.post('/actualites', async (req, res, next) => {
  try {
    const { titre, contenu, extrait, image, categorie, tags, publie, a_la_une, date_publication } = req.body;
    const slug = titre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 100);
    const [result] = await db.pool.execute(
      `INSERT INTO actualites (titre, slug, contenu, extrait, image, categorie, auteur_id, tags, publie, a_la_une, date_publication) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [titre, slug, contenu, extrait, image, categorie || 'Club', req.user.id, JSON.stringify(tags), publie !== false, a_la_une || false, date_publication || new Date()]
    );
    await logActivity(req.user.id, 'create', 'actualites', result.insertId, { titre });
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) { next(error); }
});

router.put('/actualites/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { titre, contenu, extrait, image, categorie, tags, publie, a_la_une, date_publication } = req.body;
    const slug = titre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 100);
    await db.pool.execute(
      `UPDATE actualites SET titre = ?, slug = ?, contenu = ?, extrait = ?, image = ?, categorie = ?, 
       tags = ?, publie = ?, a_la_une = ?, date_publication = ? WHERE id = ?`,
      [titre, slug, contenu, extrait, image, categorie, JSON.stringify(tags), publie, a_la_une, date_publication, id]
    );
    await logActivity(req.user.id, 'update', 'actualites', id, { titre });
    res.json({ success: true, message: 'Article mis à jour' });
  } catch (error) { next(error); }
});

router.delete('/actualites/:id', async (req, res, next) => {
  try {
    await db.pool.execute('DELETE FROM actualites WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Article supprimé' });
  } catch (error) { next(error); }
});

// =====================================================
// GALERIE (Admin CRUD)
// =====================================================
router.get('/galerie/albums', async (req, res, next) => {
  try {
    const [albums] = await db.pool.execute(`
      SELECT a.*, (SELECT COUNT(*) FROM galerie_photos WHERE album_id = a.id) as nb_photos
      FROM galerie_albums a ORDER BY a.date_evenement DESC
    `);
    res.json({ success: true, data: { albums } });
  } catch (error) { next(error); }
});

router.post('/galerie/albums', async (req, res, next) => {
  try {
    const { titre, description, image_couverture, date_evenement } = req.body;
    const slug = titre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const [result] = await db.pool.execute(
      'INSERT INTO galerie_albums (titre, slug, description, image_couverture, date_evenement) VALUES (?, ?, ?, ?, ?)',
      [titre, slug, description, image_couverture, date_evenement]
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) { next(error); }
});

router.put('/galerie/albums/:id', async (req, res, next) => {
  try {
    const { titre, description, image_couverture, date_evenement, actif, ordre } = req.body;
    const slug = titre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await db.pool.execute(
      'UPDATE galerie_albums SET titre = ?, slug = ?, description = ?, image_couverture = ?, date_evenement = ?, actif = ?, ordre = ? WHERE id = ?',
      [titre, slug, description, image_couverture, date_evenement, actif, ordre, req.params.id]
    );
    res.json({ success: true, message: 'Album mis à jour' });
  } catch (error) { next(error); }
});

router.delete('/galerie/albums/:id', async (req, res, next) => {
  try {
    await db.pool.execute('DELETE FROM galerie_albums WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Album supprimé' });
  } catch (error) { next(error); }
});

router.post('/galerie/photos', async (req, res, next) => {
  try {
    const { album_id, titre, description, fichier } = req.body;
    const [result] = await db.pool.execute(
      'INSERT INTO galerie_photos (album_id, titre, description, fichier) VALUES (?, ?, ?, ?)',
      [album_id, titre, description, fichier]
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) { next(error); }
});

router.delete('/galerie/photos/:id', async (req, res, next) => {
  try {
    await db.pool.execute('DELETE FROM galerie_photos WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Photo supprimée' });
  } catch (error) { next(error); }
});

// =====================================================
// PARTENAIRES (Admin CRUD)
// =====================================================
router.get('/partenaires', async (req, res, next) => {
  try {
    const [partenaires] = await db.pool.execute('SELECT * FROM partenaires ORDER BY ordre');
    res.json({ success: true, data: { partenaires } });
  } catch (error) { next(error); }
});

router.post('/partenaires', async (req, res, next) => {
  try {
    const { nom, description, logo, site_web, type, ordre } = req.body;
    const slug = nom.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const [result] = await db.pool.execute(
      'INSERT INTO partenaires (nom, slug, description, logo, site_web, type, ordre) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nom, slug, description, logo, site_web, type || 'partenaire', ordre || 0]
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) { next(error); }
});

router.put('/partenaires/:id', async (req, res, next) => {
  try {
    const { nom, description, logo, site_web, type, ordre, actif } = req.body;
    const slug = nom.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await db.pool.execute(
      'UPDATE partenaires SET nom = ?, slug = ?, description = ?, logo = ?, site_web = ?, type = ?, ordre = ?, actif = ? WHERE id = ?',
      [nom, slug, description, logo, site_web, type, ordre, actif, req.params.id]
    );
    res.json({ success: true, message: 'Partenaire mis à jour' });
  } catch (error) { next(error); }
});

router.delete('/partenaires/:id', async (req, res, next) => {
  try {
    await db.pool.execute('DELETE FROM partenaires WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Partenaire supprimé' });
  } catch (error) { next(error); }
});

// =====================================================
// MESSAGES CONTACT
// =====================================================
router.get('/contacts', async (req, res, next) => {
  try {
    const [messages] = await db.pool.execute('SELECT * FROM contacts ORDER BY created_at DESC');
    res.json({ success: true, data: { messages } });
  } catch (error) { next(error); }
});

router.patch('/contacts/:id/read', async (req, res, next) => {
  try {
    await db.pool.execute('UPDATE contacts SET lu = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.delete('/contacts/:id', async (req, res, next) => {
  try {
    await db.pool.execute('DELETE FROM contacts WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Message supprimé' });
  } catch (error) { next(error); }
});

// =====================================================
// ACTIVITÉ LOGS
// =====================================================
router.get('/logs', async (req, res, next) => {
  try {
    const [logs] = await db.pool.execute(`
      SELECT l.*, u.nom as user_nom FROM activity_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC LIMIT 100
    `);
    res.json({ success: true, data: { logs } });
  } catch (error) { next(error); }
});

// Helper pour logger l'activité
async function logActivity(userId, action, entite, entiteId, details = null) {
  try {
    await db.pool.execute(
      'INSERT INTO activity_logs (user_id, action, entite, entite_id, details) VALUES (?, ?, ?, ?, ?)',
      [userId, action, entite, entiteId, details ? JSON.stringify(details) : null]
    );
  } catch (e) {
    logger.error('Erreur log activité:', e);
  }
}

module.exports = router;

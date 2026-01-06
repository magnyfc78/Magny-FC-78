/**
 * Routes Upload - Gestion des fichiers
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { protect, restrictTo } = require('../middleware/auth');
const { uploadSingle, uploadMultiple, deleteFile } = require('../middleware/upload');

const router = express.Router();

// Toutes les routes nécessitent authentification
router.use(protect);
router.use(restrictTo('admin', 'editor'));

// =====================================================
// UPLOAD SIMPLE (une image)
// =====================================================
// Mapping des types vers les noms de dossiers réels
const typeToDirName = {
  equipe: 'equipes',
  actualite: 'actualites',
  galerie: 'galerie',
  partenaire: 'partenaires',
  avatar: 'avatars',
  config: 'config',
  comite: 'avatars',
  organigramme: 'organigramme'
};

router.post('/single/:type', uploadSingle('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Aucun fichier uploadé' });
    }

    const type = req.params.type;
    // Utiliser le nom de dossier correct (pluriel pour actualites, partenaires, etc.)
    const dirName = typeToDirName[type] || type;
    const relativePath = `/uploads/${dirName}/${req.file.filename}`;

    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        path: relativePath,
        thumbnail: req.file.thumbnail || null,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// UPLOAD MULTIPLE (galerie)
// =====================================================
router.post('/multiple/:type', uploadMultiple('images', 20), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun fichier uploadé' });
    }

    const type = req.params.type;
    // Utiliser le nom de dossier correct (pluriel pour actualites, partenaires, etc.)
    const dirName = typeToDirName[type] || type;
    const files = req.files.map(file => ({
      filename: file.filename,
      path: `/uploads/${dirName}/${file.filename}`,
      thumbnail: file.thumbnail || null,
      size: file.size
    }));

    res.json({
      success: true,
      data: { files, count: files.length }
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// UPLOAD PHOTOS GALERIE + ENREGISTREMENT EN BDD
// =====================================================
router.post('/galerie/:albumId', uploadMultiple('photos', 50), async (req, res, next) => {
  try {
    const { albumId } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucune photo uploadée' });
    }

    // Vérifier que l'album existe
    const [[album]] = await db.pool.execute('SELECT id FROM galerie_albums WHERE id = ?', [albumId]);
    if (!album) {
      return res.status(404).json({ success: false, error: 'Album non trouvé' });
    }

    // Récupérer l'ordre max actuel
    const [[{ maxOrdre }]] = await db.pool.execute(
      'SELECT COALESCE(MAX(ordre), 0) as maxOrdre FROM galerie_photos WHERE album_id = ?',
      [albumId]
    );

    // Insérer les photos en BDD
    const photos = [];
    let ordre = maxOrdre + 1;

    for (const file of req.files) {
      // Extraire le chemin relatif depuis le chemin réel du fichier
      const relativePath = file.path.replace(/.*public/, '').replace(/\\/g, '/');
      const fichier = relativePath;
      const thumbnail = file.thumbnail || fichier;

      const [result] = await db.pool.execute(
        'INSERT INTO galerie_photos (album_id, fichier, thumbnail, ordre) VALUES (?, ?, ?, ?)',
        [albumId, fichier, thumbnail, ordre++]
      );

      photos.push({
        id: result.insertId,
        fichier,
        thumbnail,
        ordre: ordre - 1
      });
    }

    // Mettre à jour la couverture de l'album si pas définie
    await db.pool.execute(
      'UPDATE galerie_albums SET image_couverture = COALESCE(image_couverture, ?) WHERE id = ?',
      [photos[0].fichier, albumId]
    );

    res.json({
      success: true,
      data: { photos, count: photos.length }
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// UPLOAD PHOTO ÉQUIPE (avec nom personnalisé)
// =====================================================
router.post('/equipe/:nomEquipe', uploadSingle('photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Aucun fichier uploadé' });
    }

    // Le fichier est déjà nommé avec le nom de l'équipe par le middleware
    const relativePath = `/uploads/equipes/${req.file.filename}`;

    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        path: relativePath
      }
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// SUPPRIMER UN FICHIER
// =====================================================
router.delete('/file', async (req, res, next) => {
  try {
    const { path: filePath, photoId } = req.body;

    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Chemin du fichier requis' });
    }

    // Supprimer le fichier physique
    const deleted = deleteFile(filePath);

    // Si c'est une photo de galerie, supprimer aussi de la BDD
    if (photoId) {
      await db.pool.execute('DELETE FROM galerie_photos WHERE id = ?', [photoId]);
    }

    res.json({
      success: true,
      message: deleted ? 'Fichier supprimé' : 'Fichier non trouvé'
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// LISTER LES FICHIERS D'UN DOSSIER
// =====================================================
router.get('/list/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    // Utiliser le nom de dossier correct (pluriel pour actualites, partenaires, etc.)
    const dirName = typeToDirName[type] || type;
    const dirPath = path.join(process.cwd(), 'public/uploads', dirName);

    if (!fs.existsSync(dirPath)) {
      return res.json({ success: true, data: { files: [] } });
    }

    const files = fs.readdirSync(dirPath)
      .filter(f => !f.startsWith('.') && !fs.statSync(path.join(dirPath, f)).isDirectory())
      .map(filename => {
        const stat = fs.statSync(path.join(dirPath, filename));
        return {
          filename,
          path: `/uploads/${dirName}/${filename}`,
          size: stat.size,
          created: stat.birthtime
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json({ success: true, data: { files } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

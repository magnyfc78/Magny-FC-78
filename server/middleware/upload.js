/**
 * Middleware Upload - Gestion des fichiers images
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');

// Créer les dossiers si nécessaire
const uploadDirs = [
  'public/uploads',
  'public/uploads/equipes',
  'public/uploads/actualites',
  'public/uploads/galerie',
  'public/uploads/galerie/thumbnails',
  'public/uploads/partenaires',
  'public/uploads/avatars',
  'public/uploads/config',
  'public/uploads/organigramme'
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Détection du type via URL ou paramètres
    let type = req.params.type || req.body.type || 'general';

    // Si route /equipe/:nomEquipe, utiliser 'equipe'
    if (req.params.nomEquipe || req.originalUrl.includes('/equipe/')) {
      type = 'equipe';
    }

    // Si route /galerie/:albumId, utiliser 'galerie'
    if (req.params.albumId || req.originalUrl.includes('/galerie/')) {
      type = 'galerie';
    }

    const destinations = {
      equipe: 'public/uploads/equipes',
      actualite: 'public/uploads/actualites',
      galerie: 'public/uploads/galerie',
      partenaire: 'public/uploads/partenaires',
      avatar: 'public/uploads/avatars',
      config: 'public/uploads/config',
      organigramme: 'public/uploads/organigramme',
      general: 'public/uploads'
    };
    cb(null, destinations[type] || destinations.general);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    // Pour les équipes, utiliser le nom de l'équipe comme nom de fichier
    if (req.params.nomEquipe) {
      const nomEquipe = decodeURIComponent(req.params.nomEquipe);
      const safeName = nomEquipe.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Supprimer accents
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);
      cb(null, `${safeName}${ext}`);
      return;
    }

    const uniqueId = crypto.randomBytes(8).toString('hex');
    const safeName = file.originalname
      .replace(ext, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 30);
    cb(null, `${safeName}-${uniqueId}${ext}`);
  }
});

// Filtre des fichiers
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Utilisez JPG, PNG, GIF ou WebP.'), false);
  }
};

// Configuration Multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 10 // Max 10 fichiers à la fois
  }
});

// Middleware pour redimensionner les images
const processImage = async (req, res, next) => {
  if (!req.file && !req.files) return next();

  const files = req.files || [req.file];

  try {
    for (const file of files) {
      const filePath = file.path;
      const ext = path.extname(file.filename);
      const baseName = path.basename(file.filename, ext);
      const fileDir = path.dirname(filePath);

      // Redimensionner l'image principale (max 1920px)
      await sharp(filePath)
        .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(filePath.replace(ext, '-optimized.jpg'));

      // Créer une miniature pour la galerie
      const isGalerie = req.params.type === 'galerie' || req.body.type === 'galerie' ||
                        req.params.albumId || req.originalUrl.includes('/galerie/');
      if (isGalerie) {
        // Créer le dossier thumbnails s'il n'existe pas
        const thumbDir = path.join(fileDir, 'thumbnails');
        if (!fs.existsSync(thumbDir)) {
          fs.mkdirSync(thumbDir, { recursive: true });
        }

        const thumbFilePath = path.join(thumbDir, `${baseName}-thumb.jpg`);
        await sharp(filePath)
          .resize(400, 400, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toFile(thumbFilePath);

        // Calculer le chemin relatif du thumbnail
        const thumbRelativePath = thumbFilePath.replace(/.*public/, '').replace(/\\/g, '/');
        file.thumbnail = thumbRelativePath;
      }

      // Supprimer l'original et renommer l'optimisé
      fs.unlinkSync(filePath);
      fs.renameSync(filePath.replace(ext, '-optimized.jpg'), filePath.replace(ext, '.jpg'));

      file.filename = baseName + '.jpg';
      file.path = filePath.replace(ext, '.jpg');
    }
    next();
  } catch (error) {
    next(error);
  }
};

// Route pour upload simple
const uploadSingle = (fieldName = 'image') => [
  upload.single(fieldName),
  processImage
];

// Route pour upload multiple
const uploadMultiple = (fieldName = 'images', maxCount = 10) => [
  upload.array(fieldName, maxCount),
  processImage
];

// Supprimer un fichier
const deleteFile = (filePath) => {
  const fullPath = path.join(process.cwd(), 'public', filePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    // Supprimer aussi la miniature si c'est une image galerie
    const thumbPath = fullPath.replace('/galerie/', '/galerie/thumbnails/').replace('.jpg', '-thumb.jpg');
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }
    return true;
  }
  return false;
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  processImage,
  deleteFile
};

-- Migration: Ajout des catégories de galerie
-- Date: 2024-12-30

-- Créer la table des catégories de galerie
CREATE TABLE IF NOT EXISTS galerie_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icone VARCHAR(50) DEFAULT 'photo',
    couleur VARCHAR(7) DEFAULT '#1a4d92',
    ordre INT DEFAULT 0,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Insérer les catégories par défaut
INSERT IGNORE INTO galerie_categories (nom, slug, description, icone, couleur, ordre) VALUES
('Match', 'match', 'Photos des matchs de nos équipes', 'futbol', '#10b981', 1),
('Tournoi', 'tournoi', 'Photos des tournois organisés ou participés', 'trophy', '#f59e0b', 2),
('Entraînement', 'entrainement', 'Photos des séances d''entraînement', 'running', '#3b82f6', 3),
('Événement', 'evenement', 'Fêtes du club, remises de maillots, cérémonies', 'calendar', '#8b5cf6', 4),
('Histoire', 'histoire', 'Photos historiques du club depuis sa création', 'history', '#dabb81', 5);

-- Ajouter la colonne categorie_id à galerie_albums si elle n'existe pas
ALTER TABLE galerie_albums
ADD COLUMN IF NOT EXISTS categorie_id INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS annee INT DEFAULT NULL;

-- Ajouter la clé étrangère (si elle n'existe pas déjà)
-- Note: MySQL ne supporte pas IF NOT EXISTS pour les contraintes, donc on ignore l'erreur
ALTER TABLE galerie_albums
ADD CONSTRAINT fk_galerie_albums_categorie
FOREIGN KEY (categorie_id) REFERENCES galerie_categories(id) ON DELETE SET NULL;

-- Mettre à jour les albums existants avec des catégories appropriées
UPDATE galerie_albums
SET categorie_id = (SELECT id FROM galerie_categories WHERE slug = 'match')
WHERE titre LIKE '%Match%' AND categorie_id IS NULL;

UPDATE galerie_albums
SET categorie_id = (SELECT id FROM galerie_categories WHERE slug = 'tournoi')
WHERE titre LIKE '%Tournoi%' AND categorie_id IS NULL;

UPDATE galerie_albums
SET categorie_id = (SELECT id FROM galerie_categories WHERE slug = 'evenement')
WHERE (titre LIKE '%Fête%' OR titre LIKE '%Remise%' OR titre LIKE '%Cérémonie%')
AND categorie_id IS NULL;

-- Mettre à jour l'année basée sur la date d'événement
UPDATE galerie_albums
SET annee = YEAR(date_evenement)
WHERE date_evenement IS NOT NULL AND annee IS NULL;

-- =====================================================
-- MIGRATION: Ajout des liens Instagram
-- Date: 2025-01-05
-- =====================================================

-- Ajouter le champ lien_instagram à la table actualites
ALTER TABLE actualites
ADD COLUMN lien_instagram VARCHAR(500) DEFAULT NULL AFTER tags;

-- Ajouter le champ lien_instagram à la table galerie_albums
ALTER TABLE galerie_albums
ADD COLUMN lien_instagram VARCHAR(500) DEFAULT NULL AFTER date_evenement;

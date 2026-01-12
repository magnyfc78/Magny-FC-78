-- Migration: Ajout des statistiques homepage en champs individuels
-- Date: 2026-01-07

-- Supprimer l'ancienne entrée JSON si elle existe
DELETE FROM site_config WHERE cle = 'stats';

-- Statistiques de la page d'accueil (groupe 'stats') - champs individuels
INSERT INTO site_config (cle, valeur, type, groupe, label) VALUES
('stat_1_valeur', '300+', 'text', 'stats', 'Statistique 1 - Valeur'),
('stat_1_label', 'Licenciés', 'text', 'stats', 'Statistique 1 - Label'),
('stat_2_valeur', '17', 'text', 'stats', 'Statistique 2 - Valeur'),
('stat_2_label', 'Équipes', 'text', 'stats', 'Statistique 2 - Label'),
('stat_3_valeur', '24', 'text', 'stats', 'Statistique 3 - Valeur'),
('stat_3_label', 'Années', 'text', 'stats', 'Statistique 3 - Label'),
('stat_4_valeur', '1er', 'text', 'stats', 'Statistique 4 - Valeur'),
('stat_4_label', 'Club de la ville', 'text', 'stats', 'Statistique 4 - Label')
ON DUPLICATE KEY UPDATE label = VALUES(label);

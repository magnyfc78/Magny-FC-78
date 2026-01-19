-- =====================================================
-- Migration: Add classements table and update FFF integration
-- Date: 2026-01-19
-- Description: Adds classement table and updates FFF scraper config
-- =====================================================

-- Table des classements par compétition
CREATE TABLE IF NOT EXISTS classements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipe_id INT,
    competition_id VARCHAR(100) NOT NULL COMMENT 'ID compétition FFF',
    competition_nom VARCHAR(255) NOT NULL,
    poule VARCHAR(100) DEFAULT NULL,
    position INT NOT NULL,
    equipe_nom VARCHAR(150) NOT NULL,
    points INT DEFAULT 0,
    joues INT DEFAULT 0,
    gagnes INT DEFAULT 0,
    nuls INT DEFAULT 0,
    perdus INT DEFAULT 0,
    buts_pour INT DEFAULT 0,
    buts_contre INT DEFAULT 0,
    difference INT DEFAULT 0,
    forme VARCHAR(20) DEFAULT NULL COMMENT 'Derniers résultats (ex: VVNPV)',
    penalites INT DEFAULT 0,
    fff_synced_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (equipe_id) REFERENCES equipes(id) ON DELETE SET NULL,
    INDEX idx_competition (competition_id),
    INDEX idx_position (position),
    UNIQUE KEY unique_classement (competition_id, equipe_nom)
) ENGINE=InnoDB COMMENT='Classements des compétitions FFF';

-- Table pour stocker les compétitions du club
CREATE TABLE IF NOT EXISTS fff_competitions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fff_id VARCHAR(100) NOT NULL UNIQUE COMMENT 'ID FFF de la compétition',
    nom VARCHAR(255) NOT NULL,
    type ENUM('championnat', 'coupe', 'amical', 'autre') DEFAULT 'championnat',
    categorie VARCHAR(100) DEFAULT NULL COMMENT 'Seniors, U19, U17, etc.',
    poule VARCHAR(100) DEFAULT NULL,
    saison VARCHAR(20) DEFAULT NULL COMMENT '2024-2025',
    fff_url VARCHAR(500) DEFAULT NULL,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_categorie (categorie),
    INDEX idx_saison (saison)
) ENGINE=InnoDB COMMENT='Compétitions FFF du club';

-- Ajouter la colonne competition_fff_id à la table matchs si elle n'existe pas
ALTER TABLE matchs
ADD COLUMN IF NOT EXISTS competition_fff_id VARCHAR(100) DEFAULT NULL AFTER fff_competition_id;
ADD COLUMN competition_fff_id VARCHAR(100) DEFAULT NULL AFTER fff_competition_id;

-- Mettre à jour la configuration FFF du club
INSERT INTO site_config (cle, valeur, type, groupe, label) VALUES
('fff_club_id', '25702', 'text', 'fff', 'ID Club FFF (District)'),
('fff_base_url', 'https://dyf78.fff.fr', 'text', 'fff', 'URL Base District'),
('fff_scraping_enabled', 'true', 'boolean', 'fff', 'Scraping FFF activé'),
('fff_scraping_interval', '12', 'text', 'fff', 'Intervalle scraping (heures)')
ON DUPLICATE KEY UPDATE valeur = VALUES(valeur);

-- Ajouter le menu Calendrier s'il n'existe pas déjà
INSERT INTO menu_items (label, url, ordre, actif)
SELECT 'CALENDRIER', '/calendrier', 6, TRUE
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE url = '/calendrier');


-- =====================================================
-- Migration: Add FFF Integration columns
-- Date: 2026-01-15
-- Description: Adds columns for FFF scraping integration
-- =====================================================

-- Add FFF team ID to equipes table
ALTER TABLE equipes
ADD COLUMN fff_team_id VARCHAR(50) DEFAULT NULL COMMENT 'ID équipe sur le site FFF',
ADD COLUMN fff_team_url VARCHAR(500) DEFAULT NULL COMMENT 'URL de l''équipe sur le site FFF',
ADD INDEX idx_fff_team_id (fff_team_id);

-- Add FFF match columns to matchs table
ALTER TABLE matchs
ADD COLUMN fff_id VARCHAR(100) DEFAULT NULL COMMENT 'ID unique du match sur FFF',
ADD COLUMN fff_competition_id VARCHAR(50) DEFAULT NULL COMMENT 'ID de la compétition FFF',
ADD COLUMN fff_url VARCHAR(500) DEFAULT NULL COMMENT 'URL du match sur le site FFF',
ADD COLUMN fff_home_team VARCHAR(150) DEFAULT NULL COMMENT 'Nom équipe domicile FFF',
ADD COLUMN fff_away_team VARCHAR(150) DEFAULT NULL COMMENT 'Nom équipe extérieur FFF',
ADD COLUMN fff_home_logo VARCHAR(500) DEFAULT NULL COMMENT 'URL logo équipe domicile',
ADD COLUMN fff_away_logo VARCHAR(500) DEFAULT NULL COMMENT 'URL logo équipe extérieur',
ADD COLUMN fff_venue VARCHAR(255) DEFAULT NULL COMMENT 'Lieu du match depuis FFF',
ADD COLUMN fff_synced_at DATETIME DEFAULT NULL COMMENT 'Dernière synchronisation FFF',
ADD UNIQUE INDEX idx_fff_id (fff_id);

-- Create table to log scraping activities
CREATE TABLE IF NOT EXISTS fff_scraping_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    started_at DATETIME NOT NULL,
    finished_at DATETIME,
    status ENUM('running', 'success', 'error') DEFAULT 'running',
    teams_found INT DEFAULT 0,
    matches_found INT DEFAULT 0,
    matches_inserted INT DEFAULT 0,
    matches_updated INT DEFAULT 0,
    error_message TEXT,
    execution_time_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_started_at (started_at)
) ENGINE=InnoDB COMMENT='Log des exécutions du scraper FFF';

-- Update existing teams with known FFF team IDs (to be filled manually or via scraper)
-- These are placeholder mappings - actual IDs will be discovered by the scraper

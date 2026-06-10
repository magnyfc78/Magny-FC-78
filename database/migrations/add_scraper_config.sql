-- Migration: Ajouter la table de configuration du scraper FFF
-- Date: 2025-01-22

-- Table de configuration du scraper
CREATE TABLE IF NOT EXISTS scraper_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cle VARCHAR(50) NOT NULL UNIQUE,
  valeur TEXT NOT NULL,
  description VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Configuration par défaut
INSERT INTO scraper_config (cle, valeur, description) VALUES
  ('enabled', 'true', 'Activer/désactiver le scraper automatique'),
  ('days', '0,1,6', 'Jours d''exécution (0=Dim, 1=Lun, 6=Sam)'),
  ('hours', '0,12', 'Heures d''exécution (0-23)'),
  ('timeout', '300000', 'Timeout en millisecondes (5 min par défaut)'),
  ('retries', '2', 'Nombre de tentatives en cas d''échec'),
  ('last_run', '', 'Date de dernière exécution'),
  ('last_status', '', 'Statut de la dernière exécution')
ON DUPLICATE KEY UPDATE description = VALUES(description);

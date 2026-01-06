-- =====================================================
-- MIGRATION: Ajout des tables organigrammes
-- Date: 2026-01-05
-- =====================================================

-- =====================================================
-- TABLE ORGANIGRAMMES (conteneurs)
-- =====================================================
CREATE TABLE IF NOT EXISTS organigrammes (
    id VARCHAR(50) PRIMARY KEY,
    titre VARCHAR(255) NOT NULL,
    ordre INT DEFAULT 0,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ordre (ordre),
    INDEX idx_actif (actif)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE ORGANIGRAMME_MEMBRES (membres hiérarchiques)
-- =====================================================
CREATE TABLE IF NOT EXISTS organigramme_membres (
    id VARCHAR(50) PRIMARY KEY,
    organigramme_id VARCHAR(50) NOT NULL,
    nom VARCHAR(100) NOT NULL,
    role VARCHAR(255),
    photo VARCHAR(255),
    niveau INT DEFAULT 1,
    parent_id VARCHAR(50) DEFAULT NULL,
    ordre INT DEFAULT 0,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organigramme_id) REFERENCES organigrammes(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES organigramme_membres(id) ON DELETE SET NULL,
    INDEX idx_organigramme (organigramme_id),
    INDEX idx_niveau (niveau),
    INDEX idx_parent (parent_id),
    INDEX idx_ordre (ordre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- DONNÉES INITIALES - Organigrammes
-- =====================================================
INSERT INTO organigrammes (id, titre, ordre, actif) VALUES
('comite', 'ORGANIGRAMME COMITE', 1, TRUE),
('foot-a-11', 'ORGANIGRAMME FOOT A 11', 2, TRUE),
('foot-a-5', 'ORGANIGRAMME FOOT A 5', 3, TRUE),
('foot-a-8', 'ORGANIGRAMME FOOT A 8', 4, TRUE)
ON DUPLICATE KEY UPDATE titre = VALUES(titre), ordre = VALUES(ordre);

-- =====================================================
-- DONNÉES INITIALES - Membres Comité
-- =====================================================
INSERT INTO organigramme_membres (id, organigramme_id, nom, role, niveau, parent_id, ordre) VALUES
-- Niveau 1
('president', 'comite', 'Jaafar', 'Président', 1, NULL, 1),
-- Niveau 2
('sg', 'comite', 'Fouzia', 'Secrétaire générale', 2, 'president', 1),
('tresorier', 'comite', 'Myriam', 'Trésorier', 2, 'president', 2),
('resp-materiel', 'comite', 'Rafik', 'Responsable matériel', 2, 'president', 3),
('resp-sportif', 'comite', 'Cherif', 'Responsable sportif Foot à 11', 2, 'president', 4),
('resp-f5f8', 'comite', 'Abdelaziz', 'Responsable Foot 5 / Foot 8', 2, 'president', 5),
-- Niveau 3
('adj-sg', 'comite', 'Camille', 'Secrétaire général adjoint', 3, 'sg', 1),
('adj-tresorier', 'comite', 'Hakim', 'Trésorier adjoint', 3, 'tresorier', 1),
('adj-materiel', 'comite', 'Hervé', 'Responsable matériel adjoint', 3, 'resp-materiel', 1),
('coord-tech', 'comite', 'Anthony', 'Coordinateur technique', 3, 'resp-sportif', 1)
ON DUPLICATE KEY UPDATE nom = VALUES(nom), role = VALUES(role), niveau = VALUES(niveau), parent_id = VALUES(parent_id), ordre = VALUES(ordre);

-- =====================================================
-- DONNÉES INITIALES - Membres Foot à 11
-- =====================================================
INSERT INTO organigramme_membres (id, organigramme_id, nom, role, niveau, parent_id, ordre) VALUES
-- Niveau 1
('coordinateur-f11', 'foot-a-11', 'Cherif', 'Coordinateur Foot à 11', 1, NULL, 1),
-- Niveau 2
('seniors-coach', 'foot-a-11', 'Jamal', 'Seniors', 2, 'coordinateur-f11', 1),
('veterans-coach', 'foot-a-11', 'Hervé', 'Vétérans', 2, 'coordinateur-f11', 2),
('u18-coach', 'foot-a-11', 'Anthony', 'U18', 2, 'coordinateur-f11', 3),
('u15-coach', 'foot-a-11', 'Myriam', 'U15', 2, 'coordinateur-f11', 4),
('u13-coach', 'foot-a-11', 'Sofiane', 'U13', 2, 'coordinateur-f11', 5),
('u11-coach', 'foot-a-11', 'Jérémy', 'U11', 2, 'coordinateur-f11', 6),
('u9-coach', 'foot-a-11', 'Cherif', 'U9', 2, 'coordinateur-f11', 7),
-- Niveau 3
('seniors-adj', 'foot-a-11', 'Eddy / Jérémy', 'Adjoints Seniors', 3, 'seniors-coach', 1),
('u18-adj', 'foot-a-11', 'Marc', 'Adjoint U18', 3, 'u18-coach', 1),
('u15-adj', 'foot-a-11', 'Ahmed', 'Adjoint U15', 3, 'u15-coach', 1),
('u13-adj', 'foot-a-11', 'Julien', 'Adjoint U13', 3, 'u13-coach', 1),
('u11-adj', 'foot-a-11', 'Laurent', 'Adjoint U11', 3, 'u11-coach', 1),
('u9-adj1', 'foot-a-11', 'Mégane', 'Adjointe U9', 3, 'u9-coach', 1),
('u9-adj2', 'foot-a-11', 'Mathis', 'Adjoint U9', 3, 'u9-coach', 2)
ON DUPLICATE KEY UPDATE nom = VALUES(nom), role = VALUES(role), niveau = VALUES(niveau), parent_id = VALUES(parent_id), ordre = VALUES(ordre);

-- =====================================================
-- DONNÉES INITIALES - Membres Foot à 5
-- =====================================================
INSERT INTO organigramme_membres (id, organigramme_id, nom, role, niveau, parent_id, ordre) VALUES
-- Niveau 1
('coordinateur-f5', 'foot-a-5', 'Anthony', 'Coordinateur technique foot à 5', 1, NULL, 1),
-- Niveau 2
('crevettes-elodie', 'foot-a-5', 'Elodie', 'Crevettes', 2, 'coordinateur-f5', 1),
('crevettes-delphine', 'foot-a-5', 'Delphine', 'Crevettes', 2, 'coordinateur-f5', 2),
('u7-alexandra', 'foot-a-5', 'Alexandra', 'U7', 2, 'coordinateur-f5', 3),
('u7-greg', 'foot-a-5', 'Greg', 'U7', 2, 'coordinateur-f5', 4),
-- Niveau 3
('crevettes-maud', 'foot-a-5', 'Maud', 'Crevettes', 3, 'crevettes-elodie', 1),
('crevettes-marianne', 'foot-a-5', 'Marianne', 'Crevettes', 3, 'crevettes-delphine', 1)
ON DUPLICATE KEY UPDATE nom = VALUES(nom), role = VALUES(role), niveau = VALUES(niveau), parent_id = VALUES(parent_id), ordre = VALUES(ordre);

-- =====================================================
-- DONNÉES INITIALES - Membres Foot à 8
-- =====================================================
INSERT INTO organigramme_membres (id, organigramme_id, nom, role, niveau, parent_id, ordre) VALUES
-- Niveau 1
('coordinateur-f8', 'foot-a-8', 'Jalil', 'Coordinateur technique foot à 8', 1, NULL, 1),
-- Niveau 2
('u10-jalil', 'foot-a-8', 'Jalil', 'U10', 2, 'coordinateur-f8', 1),
('u10-jimmy', 'foot-a-8', 'Jimmy', 'U10', 2, 'coordinateur-f8', 2),
('u8-quentin', 'foot-a-8', 'Quentin', 'U8', 2, 'coordinateur-f8', 3),
('u8-anthony', 'foot-a-8', 'Anthony', 'U8', 2, 'coordinateur-f8', 4),
-- Niveau 3
('u10-marco', 'foot-a-8', 'Marco', 'U10', 3, 'u10-jalil', 1)
ON DUPLICATE KEY UPDATE nom = VALUES(nom), role = VALUES(role), niveau = VALUES(niveau), parent_id = VALUES(parent_id), ordre = VALUES(ordre);

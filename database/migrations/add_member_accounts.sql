-- =====================================================
-- MAGNY FC 78 - Système de gestion des comptes adhérents
-- Migration: add_member_accounts.sql
-- Date: 2024-12-07
--
-- Concept: COMPTE vs LICENCE
-- - Un COMPTE = une personne physique qui se connecte (joueur adulte ou parent)
-- - Une LICENCE = un joueur licencié au club (peut être un enfant)
-- =====================================================

USE magnyfc78_db;

-- =====================================================
-- TABLE: licenses (Licences FFF)
-- Licences importées depuis la FFF ou saisies manuellement
-- =====================================================
CREATE TABLE IF NOT EXISTS licenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    license_number VARCHAR(20) UNIQUE NOT NULL COMMENT 'Numéro de licence FFF',
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    gender ENUM('M', 'F') NOT NULL,
    category VARCHAR(20) COMMENT 'U7, U9, U11, U13, U15, U17, U19, Seniors, Vétérans',
    team_id INT COMMENT 'Équipe principale',
    photo_url VARCHAR(255),
    email VARCHAR(255) COMMENT 'Email du licencié ou du parent responsable',
    phone VARCHAR(20),
    address TEXT,
    postal_code VARCHAR(10),
    city VARCHAR(100),
    emergency_contact_name VARCHAR(100) COMMENT 'Contact urgence',
    emergency_contact_phone VARCHAR(20),
    medical_certificate_date DATE COMMENT 'Date du certificat médical',
    medical_certificate_valid BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    season VARCHAR(9) NOT NULL COMMENT 'Format: 2024-2025',
    notes TEXT COMMENT 'Notes internes admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_license_number (license_number),
    INDEX idx_season (season),
    INDEX idx_category (category),
    INDEX idx_team (team_id),
    INDEX idx_email (email),
    INDEX idx_active (is_active),
    FULLTEXT idx_search (first_name, last_name),

    FOREIGN KEY (team_id) REFERENCES equipes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: member_accounts (Comptes membres/parents)
-- Comptes utilisateurs pour les adhérents et parents
-- Séparé de la table users (admin) pour plus de clarté
-- =====================================================
CREATE TABLE IF NOT EXISTS member_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    avatar_url VARCHAR(255),

    -- Rôles spécifiques membres
    role ENUM('member', 'coach', 'manager', 'admin') DEFAULT 'member' COMMENT 'Rôle au sein du club',

    -- Vérification email
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    verification_token_expires DATETIME,
    verified_at DATETIME,

    -- Reset mot de passe
    reset_token VARCHAR(255),
    reset_token_expires DATETIME,

    -- Préférences notifications
    notify_email BOOLEAN DEFAULT TRUE COMMENT 'Notifications par email',
    notify_match BOOLEAN DEFAULT TRUE COMMENT 'Rappels matchs',
    notify_training BOOLEAN DEFAULT TRUE COMMENT 'Rappels entraînements',
    notify_news BOOLEAN DEFAULT TRUE COMMENT 'Actualités du club',

    -- Sécurité et audit
    is_active BOOLEAN DEFAULT TRUE,
    last_login DATETIME,
    login_count INT DEFAULT 0,
    failed_login_count INT DEFAULT 0,
    locked_until DATETIME COMMENT 'Compte bloqué temporairement après trop de tentatives',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_active (is_active),
    INDEX idx_verified (is_verified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: account_licenses (Liaison compte ↔ licences)
-- Un compte peut gérer plusieurs licences (parent avec enfants)
-- =====================================================
CREATE TABLE IF NOT EXISTS account_licenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    license_id INT NOT NULL,
    relationship ENUM('self', 'parent', 'tutor', 'other') NOT NULL COMMENT 'Lien avec le licencié',
    is_primary BOOLEAN DEFAULT FALSE COMMENT 'Licence principale affichée par défaut',
    can_manage BOOLEAN DEFAULT TRUE COMMENT 'Peut modifier les infos de cette licence',

    -- Vérification du lien
    verified_at DATETIME COMMENT 'Date de vérification par admin',
    verified_by INT COMMENT 'Admin qui a vérifié',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY unique_account_license (account_id, license_id),
    INDEX idx_account (account_id),
    INDEX idx_license (license_id),

    FOREIGN KEY (account_id) REFERENCES member_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: license_invitations (Codes d'invitation)
-- Pour permettre à un parent de rattacher une licence à son compte
-- =====================================================
CREATE TABLE IF NOT EXISTS license_invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    license_id INT NOT NULL,
    invitation_code VARCHAR(50) UNIQUE NOT NULL COMMENT 'Code unique à 8 caractères',
    invited_email VARCHAR(255) COMMENT 'Email spécifique invité (optionnel)',
    relationship ENUM('self', 'parent', 'tutor', 'other') DEFAULT 'parent',

    -- Validité
    expires_at DATETIME NOT NULL,
    max_uses INT DEFAULT 1 COMMENT 'Nombre max d''utilisations',
    use_count INT DEFAULT 0,

    -- Utilisation
    used_at DATETIME,
    used_by INT COMMENT 'Compte qui a utilisé l''invitation',

    -- Audit
    created_by VARCHAR(36) COMMENT 'Admin qui a créé l''invitation',
    revoked_at DATETIME,
    revoked_by VARCHAR(36),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_code (invitation_code),
    INDEX idx_license (license_id),
    INDEX idx_email (invited_email),
    INDEX idx_expires (expires_at),

    FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
    FOREIGN KEY (used_by) REFERENCES member_accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: member_sessions (Sessions actives - sécurité)
-- Pour gérer les sessions multi-appareils
-- =====================================================
CREATE TABLE IF NOT EXISTS member_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL COMMENT 'Hash du refresh token',
    device_info VARCHAR(255) COMMENT 'Navigateur/App',
    ip_address VARCHAR(45),
    user_agent TEXT,

    expires_at DATETIME NOT NULL,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_account (account_id),
    INDEX idx_token (token_hash),
    INDEX idx_expires (expires_at),

    FOREIGN KEY (account_id) REFERENCES member_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: member_activity_logs (Audit trail membres)
-- Historique des actions importantes
-- =====================================================
CREATE TABLE IF NOT EXISTS member_activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT,
    license_id INT,
    action VARCHAR(100) NOT NULL COMMENT 'login, logout, update_profile, link_license, etc.',
    details JSON COMMENT 'Détails de l''action',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_account (account_id),
    INDEX idx_license (license_id),
    INDEX idx_action (action),
    INDEX idx_date (created_at),

    FOREIGN KEY (account_id) REFERENCES member_accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: team_staff (Encadrement des équipes)
-- Liaison entre comptes membres et équipes pour les coachs/managers
-- =====================================================
CREATE TABLE IF NOT EXISTS team_staff (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    team_id INT NOT NULL,
    role ENUM('head_coach', 'assistant_coach', 'manager', 'delegate') NOT NULL,
    season VARCHAR(9) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY unique_staff_team_role (account_id, team_id, role, season),
    INDEX idx_team (team_id),
    INDEX idx_account (account_id),

    FOREIGN KEY (account_id) REFERENCES member_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES equipes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- DONNÉES DE TEST / EXEMPLES
-- =====================================================

-- Saison courante
SET @current_season = '2024-2025';

-- Quelques licences exemples
INSERT INTO licenses (license_number, first_name, last_name, birth_date, gender, category, email, phone, season, is_active) VALUES
('2500001234', 'Lucas', 'Dupont', '2015-03-15', 'M', 'U11', 'famille.dupont@email.com', '0612345678', @current_season, TRUE),
('2500001235', 'Emma', 'Dupont', '2017-08-22', 'F', 'U9', 'famille.dupont@email.com', '0612345678', @current_season, TRUE),
('2500001236', 'Thomas', 'Martin', '1990-05-10', 'M', 'Seniors', 'thomas.martin@email.com', '0698765432', @current_season, TRUE),
('2500001237', 'Sophie', 'Bernard', '1988-12-03', 'F', 'Seniors', 'sophie.bernard@email.com', '0611223344', @current_season, TRUE),
('2500001238', 'Maxime', 'Petit', '2010-01-20', 'M', 'U15', 'mpetit.parent@email.com', '0655667788', @current_season, TRUE),
('2500001239', 'Julie', 'Petit', '2012-06-11', 'F', 'U13', 'mpetit.parent@email.com', '0655667788', @current_season, TRUE)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Exemple de compte membre (password: Member123!)
-- Hash: $2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.qKLXFg7VJXqXXe
INSERT INTO member_accounts (email, password_hash, first_name, last_name, phone, role, is_verified, verified_at) VALUES
('famille.dupont@email.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.qKLXFg7VJXqXXe', 'Pierre', 'Dupont', '0612345678', 'member', TRUE, NOW()),
('thomas.martin@email.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.qKLXFg7VJXqXXe', 'Thomas', 'Martin', '0698765432', 'member', TRUE, NOW()),
('mpetit.parent@email.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.qKLXFg7VJXqXXe', 'Marc', 'Petit', '0655667788', 'member', TRUE, NOW())
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Liaisons compte-licences
-- Pierre Dupont (parent) avec ses 2 enfants Lucas et Emma
INSERT INTO account_licenses (account_id, license_id, relationship, is_primary, verified_at) VALUES
(1, 1, 'parent', TRUE, NOW()),  -- Pierre -> Lucas (primary)
(1, 2, 'parent', FALSE, NOW()), -- Pierre -> Emma
-- Thomas Martin avec sa propre licence
(2, 3, 'self', TRUE, NOW()),
-- Marc Petit (parent) avec ses 2 enfants Maxime et Julie
(3, 5, 'parent', TRUE, NOW()),  -- Marc -> Maxime (primary)
(3, 6, 'parent', FALSE, NOW())  -- Marc -> Julie
ON DUPLICATE KEY UPDATE verified_at = NOW();

-- =====================================================
-- VUES UTILES
-- =====================================================

-- Vue: Comptes avec leurs licences
CREATE OR REPLACE VIEW v_account_licenses AS
SELECT
    ma.id AS account_id,
    ma.email AS account_email,
    CONCAT(ma.first_name, ' ', ma.last_name) AS account_name,
    ma.role AS account_role,
    l.id AS license_id,
    l.license_number,
    CONCAT(l.first_name, ' ', l.last_name) AS licensee_name,
    l.category,
    l.season,
    al.relationship,
    al.is_primary,
    al.verified_at
FROM member_accounts ma
JOIN account_licenses al ON ma.id = al.account_id
JOIN licenses l ON al.license_id = l.id
WHERE ma.is_active = TRUE AND l.is_active = TRUE;

-- Vue: Licences par catégorie avec compte lié
CREATE OR REPLACE VIEW v_licenses_with_accounts AS
SELECT
    l.*,
    e.nom AS team_name,
    ma.id AS linked_account_id,
    ma.email AS linked_account_email,
    al.relationship
FROM licenses l
LEFT JOIN equipes e ON l.team_id = e.id
LEFT JOIN account_licenses al ON l.id = al.license_id
LEFT JOIN member_accounts ma ON al.account_id = ma.id
WHERE l.is_active = TRUE;

-- Vue: Statistiques par catégorie
CREATE OR REPLACE VIEW v_license_stats AS
SELECT
    category,
    season,
    COUNT(*) AS total_licenses,
    SUM(CASE WHEN gender = 'M' THEN 1 ELSE 0 END) AS male_count,
    SUM(CASE WHEN gender = 'F' THEN 1 ELSE 0 END) AS female_count,
    COUNT(DISTINCT (SELECT account_id FROM account_licenses WHERE license_id = l.id LIMIT 1)) AS linked_accounts
FROM licenses l
WHERE is_active = TRUE
GROUP BY category, season;

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================

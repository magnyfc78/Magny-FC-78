-- =====================================================
-- Migration: Licences FFF & comptes liés (Partie 2)
-- Date: 2026-06-17
-- Description: Socle du processus d'inscription (scénarios joueur adulte,
--              parent, licence supplémentaire, invitation admin).
--              SOLUTION A : la licence est une entité de premier plan.
--              - `licenses`         : registre FFF importé (par saison)
--              - `account_licenses` : lien canonique compte (users) <-> licence
--                                     avec relation (self/parent) + principale
--              - Extension `users`  : vérification email, reset mot de passe, RGPD
--              - `login_history`    : historique des connexions (Partie 5)
--              - Extension `invitations` (Partie 1) : ciblage par licence
--              - Pont `joueurs.license_id` : rattache l'effectif sportif au
--                registre de licences (les liens P1 joueur_tuteurs /
--                joueurs.user_id sont conservés, non cassés).
--   Vérification d'identité (scénarios 2/3) : numero_licence + date_naissance
--     contrôlés dans `licenses` ; règles d'unicité appliquées côté backend.
-- =====================================================

USE magnyfc78_db;

-- -----------------------------------------------------
-- 1. licenses — Registre des licences FFF (source: import FootClubs/FFF)
--    Une licence est rattachée à un club et à une saison. Le même
--    numéro de licence peut réapparaître chaque saison (réimport) :
--    unicité sur (numero_licence, saison).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS licenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    club_id INT NOT NULL DEFAULT 1 COMMENT 'Club propriétaire de la licence',
    numero_licence VARCHAR(50) NOT NULL COMMENT 'Numéro de licence FFF',
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    date_naissance DATE NOT NULL COMMENT 'Sert à la vérification d''identité',
    sexe ENUM('M', 'F') DEFAULT NULL,
    email VARCHAR(255) DEFAULT NULL,
    telephone VARCHAR(20) DEFAULT NULL,
    adresse VARCHAR(255) DEFAULT NULL,
    code_postal VARCHAR(10) DEFAULT NULL,
    ville VARCHAR(150) DEFAULT NULL,
    categorie VARCHAR(100) DEFAULT NULL COMMENT 'Catégorie FFF (U11, Senior, Vétéran...)',
    saison VARCHAR(20) NOT NULL COMMENT 'ex. "2024-2025"',
    statut ENUM('active', 'inactive') DEFAULT 'active' COMMENT 'Licence active sur la saison',
    source VARCHAR(50) DEFAULT 'import_fff' COMMENT 'Origine de la donnée',
    imported_at DATETIME DEFAULT NULL COMMENT 'Date du dernier import',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_license_numero_saison (numero_licence, saison),
    INDEX idx_license_numero (numero_licence),
    INDEX idx_license_email (email),
    INDEX idx_license_naissance (date_naissance),
    INDEX idx_license_categorie (categorie),
    INDEX idx_license_club (club_id),
    INDEX idx_license_statut (statut),
    FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Registre des licences FFF (par saison)';

-- -----------------------------------------------------
-- 2. account_licenses — Lien compte <-> licence (M:N)
--    relationship :
--      'self'   -> le titulaire du compte EST le licencié
--      'parent' -> le titulaire est parent/tuteur du licencié (mineur)
--    is_primary : licence affichée par défaut dans l'espace membre.
--    Règle "une licence 'self' = un seul compte" (Partie 5) : appliquée
--    côté backend (MySQL ne permet pas d'index unique conditionnel simple).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS account_licenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    license_id INT NOT NULL,
    relationship ENUM('self', 'parent') NOT NULL DEFAULT 'self',
    is_primary BOOLEAN DEFAULT FALSE COMMENT 'Licence principale du compte',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_account_license (user_id, license_id),
    INDEX idx_acclic_user (user_id),
    INDEX idx_acclic_license (license_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Licences liées à un compte (self/parent)';

-- -----------------------------------------------------
-- 3. Extension users — Vérification email, reset mot de passe, RGPD
--    NB: les noms restent nom/prenom (mapping API : last_name->nom,
--        first_name->prenom). Aucun ajout de colonne de nom.
-- -----------------------------------------------------
ALTER TABLE users
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE COMMENT 'Email confirmé',
ADD COLUMN email_verified_at DATETIME DEFAULT NULL,
ADD COLUMN verification_token VARCHAR(100) DEFAULT NULL COMMENT 'Token de vérification email',
ADD COLUMN verification_expires DATETIME DEFAULT NULL,
ADD COLUMN reset_token VARCHAR(100) DEFAULT NULL COMMENT 'Token de réinitialisation mot de passe',
ADD COLUMN reset_expires DATETIME DEFAULT NULL,
ADD COLUMN deleted_at DATETIME DEFAULT NULL COMMENT 'Suppression RGPD (soft-delete)',
ADD INDEX idx_user_verification_token (verification_token),
ADD INDEX idx_user_reset_token (reset_token),
ADD INDEX idx_user_deleted (deleted_at);

-- -----------------------------------------------------
-- 4. login_history — Historique des connexions (Partie 5)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS login_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IPv4/IPv6',
    user_agent VARCHAR(255) DEFAULT NULL,
    success BOOLEAN DEFAULT TRUE COMMENT 'Tentative réussie ou échouée',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_login_user (user_id),
    INDEX idx_login_date (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Historique des connexions';

-- -----------------------------------------------------
-- 5. Extension invitations (Partie 1) — Ciblage par licence
--    Permet "POST /admin/invitations { license_id, email }" : l'admin
--    invite le titulaire (ou son parent) d'une licence précise.
-- -----------------------------------------------------
ALTER TABLE invitations
ADD COLUMN license_id INT DEFAULT NULL COMMENT 'Licence ciblée par l''invitation',
ADD INDEX idx_invitation_license (license_id),
ADD CONSTRAINT fk_invitation_license FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE;

-- -----------------------------------------------------
-- 6. Pont joueurs <-> licences
--    Rattache une fiche "effectif/équipe" au registre de licences.
--    Optionnel : un joueur peut exister sans licence importée.
-- -----------------------------------------------------
ALTER TABLE joueurs
ADD COLUMN license_id INT DEFAULT NULL COMMENT 'Licence FFF rattachée (nullable)',
ADD INDEX idx_joueur_license (license_id),
ADD CONSTRAINT fk_joueur_license FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE SET NULL;

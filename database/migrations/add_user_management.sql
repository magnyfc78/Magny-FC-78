-- =====================================================
-- Migration: Gestion utilisateurs & inscriptions (Partie 1)
-- Date: 2026-06-17
-- Description: Adapte le modèle "club management" (type SportEasy)
--              à la base MagnyFC78.
--              - Réutilise les tables existantes users / equipes / joueurs
--              - Introduit `clubs` comme pivot multi-club (1 club par défaut
--                aujourd'hui : Magny FC 78, id=1) -> prêt pour le multi-club
--              - Ajoute l'appartenance, les coachs, les tuteurs (parents),
--                les invitations et les codes d'auto-inscription.
--   Sécurité d'accès : gérée côté backend (pas de RLS en MySQL).
--   Rôles applicatifs : NON stockés dans une colonne `role` unique.
--     admin  -> membres_club.role = 'admin'   (à l'échelle du club)
--     coach  -> equipe_coachs                 (par équipe)
--     joueur -> joueurs.user_id               (par équipe)
--     tuteur -> joueur_tuteurs                (par joueur)
-- =====================================================

USE magnyfc78_db;

-- -----------------------------------------------------
-- 1. clubs — Pivot multi-club (mono-club aujourd'hui).
--    fff_cl_no n'est PAS unique (revendications indépendantes possibles).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS clubs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fff_cl_no INT DEFAULT NULL COMMENT 'Numéro de club FFF (non unique)',
    nom VARCHAR(255) NOT NULL,
    nom_court VARCHAR(100) DEFAULT NULL,
    logo VARCHAR(255) DEFAULT NULL,
    ville VARCHAR(150) DEFAULT NULL,
    code_postal VARCHAR(10) DEFAULT NULL,
    couleurs VARCHAR(100) DEFAULT NULL COMMENT 'ex. "BLEU/OR"',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_club_fff (fff_cl_no)
) ENGINE=InnoDB COMMENT='Clubs (pivot multi-club)';

-- Club par défaut (id=1) : toutes les données existantes y sont rattachées.
INSERT INTO clubs (id, nom, nom_court, ville, code_postal)
VALUES (1, 'Magny FC 78', 'MFC78', 'Magny-les-Hameaux', '78114')
ON DUPLICATE KEY UPDATE nom = VALUES(nom);

-- -----------------------------------------------------
-- 2. Extension de la table users (comptes membres app)
--    NB: la colonne `role` existante reste dédiée au back-office
--        ('user','editor','admin'). Les rôles club viennent des
--        tables d'appartenance ci-dessous.
-- -----------------------------------------------------
ALTER TABLE users
ADD COLUMN telephone VARCHAR(20) DEFAULT NULL COMMENT 'Téléphone du membre',
ADD COLUMN numero_licence VARCHAR(50) DEFAULT NULL COMMENT 'Numéro de licence FFF',
ADD COLUMN push_token TEXT DEFAULT NULL COMMENT 'Token push Expo (notifications mobiles)',
ADD COLUMN notif_joueur_absent BOOLEAN DEFAULT TRUE COMMENT 'Préférence push : joueur absent',
ADD COLUMN notif_joueur_dispo BOOLEAN DEFAULT TRUE COMMENT 'Préférence push : joueur disponible',
ADD COLUMN notif_joueur_confirme BOOLEAN DEFAULT TRUE COMMENT 'Préférence push : joueur confirmé';

-- -----------------------------------------------------
-- 3. Rattachement des équipes à un club (multi-club ready)
--    Les équipes existantes sont rattachées au club par défaut (1).
-- -----------------------------------------------------
ALTER TABLE equipes
ADD COLUMN club_id INT NOT NULL DEFAULT 1 COMMENT 'Club propriétaire de l''équipe',
ADD INDEX idx_equipe_club (club_id),
ADD CONSTRAINT fk_equipe_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;

-- -----------------------------------------------------
-- 4. Extension de la table joueurs
--    - Lien optionnel vers un compte utilisateur (un joueur peut ne pas
--      avoir de compte ; l'accès passe alors par ses tuteurs).
--    - Champs d'inscription / suivi de statut.
-- -----------------------------------------------------
ALTER TABLE joueurs
ADD COLUMN user_id VARCHAR(36) DEFAULT NULL COMMENT 'Compte lié (nullable : joueur sans compte)',
ADD COLUMN email VARCHAR(255) DEFAULT NULL COMMENT 'Email de contact du joueur',
ADD COLUMN telephone VARCHAR(20) DEFAULT NULL COMMENT 'Téléphone de contact du joueur',
ADD COLUMN numero_licence VARCHAR(50) DEFAULT NULL COMMENT 'Numéro de licence FFF',
ADD COLUMN pied_fort ENUM('gauche', 'droit', 'les_deux') DEFAULT NULL COMMENT 'Pied préféré',
ADD COLUMN statut ENUM('disponible', 'blesse', 'suspendu', 'autre') DEFAULT 'disponible' COMMENT 'Disponibilité du joueur',
ADD COLUMN statut_raison VARCHAR(255) DEFAULT NULL COMMENT 'Motif du statut (ex. blessure)',
ADD COLUMN statut_jusqu_au DATE DEFAULT NULL COMMENT 'Date de fin du statut',
ADD INDEX idx_joueur_user (user_id),
ADD CONSTRAINT fk_joueur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- -----------------------------------------------------
-- 5. membres_club — Appartenance au club + chaîne de confiance
--    Seul 'admin' est appliqué à l'échelle du club ; coach/joueur
--    se déduisent de equipe_coachs / joueurs (ne PAS dupliquer ici).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS membres_club (
    id INT AUTO_INCREMENT PRIMARY KEY,
    club_id INT NOT NULL DEFAULT 1,
    user_id VARCHAR(36) NOT NULL,
    role ENUM('admin', 'coach', 'joueur') NOT NULL DEFAULT 'joueur',
    verifie BOOLEAN DEFAULT FALSE COMMENT 'Membre vérifié (chaîne de confiance)',
    verifie_methode VARCHAR(50) DEFAULT NULL COMMENT 'Méthode de vérification',
    verifie_le DATETIME DEFAULT NULL,
    fff_role VARCHAR(100) DEFAULT NULL COMMENT 'Rôle déclaré côté FFF',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_membre_club_user (club_id, user_id),
    INDEX idx_membre_role (role),
    FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Appartenance au club et vérification des membres';

-- -----------------------------------------------------
-- 6. equipe_coachs — Coachs rattachés à une équipe (par équipe)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS equipe_coachs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipe_id INT NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    principal BOOLEAN DEFAULT FALSE COMMENT 'Coach principal de l''équipe',
    assigne_par VARCHAR(36) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_coach_equipe_user (equipe_id, user_id),
    INDEX idx_coach_user (user_id),
    FOREIGN KEY (equipe_id) REFERENCES equipes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigne_par) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Coachs par équipe';

-- -----------------------------------------------------
-- 7. joueur_tuteurs — Parents / tuteurs ↔ joueurs (M:N)
--    Un tuteur n'a PAS de ligne membres_club : son accès passe par
--    joueur_tuteurs -> joueurs -> equipes (logique applicative).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS joueur_tuteurs (
    joueur_id INT NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (joueur_id, user_id),
    INDEX idx_tuteur_user (user_id),
    FOREIGN KEY (joueur_id) REFERENCES joueurs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Relation parent/tuteur vers joueur';

-- -----------------------------------------------------
-- 8. invitations — Invitations à rejoindre le club / une équipe
--    joueur_id renseigné pour les invitations de type 'tuteur'.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    club_id INT NOT NULL DEFAULT 1,
    email VARCHAR(255) DEFAULT NULL,
    token VARCHAR(100) NOT NULL,
    role_invite ENUM('admin', 'coach', 'joueur', 'tuteur') NOT NULL,
    equipe_id INT DEFAULT NULL COMMENT 'Équipe ciblée (coach/joueur/tuteur)',
    joueur_id INT DEFAULT NULL COMMENT 'Joueur ciblé (invitation tuteur)',
    statut ENUM('en_attente', 'acceptee', 'expiree', 'annulee') DEFAULT 'en_attente',
    invite_par VARCHAR(36) DEFAULT NULL,
    expire_le DATETIME DEFAULT NULL,
    acceptee_le DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_invitation_token (token),
    INDEX idx_invitation_email (email),
    INDEX idx_invitation_equipe (equipe_id),
    INDEX idx_invitation_statut (statut),
    FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
    FOREIGN KEY (equipe_id) REFERENCES equipes(id) ON DELETE CASCADE,
    FOREIGN KEY (joueur_id) REFERENCES joueurs(id) ON DELETE CASCADE,
    FOREIGN KEY (invite_par) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Invitations à rejoindre le club';

-- -----------------------------------------------------
-- 9. codes_inscription — Codes courts d'auto-inscription par équipe
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS codes_inscription (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipe_id INT NOT NULL,
    code VARCHAR(20) NOT NULL,
    expire_le DATETIME DEFAULT NULL,
    utilisations_max INT DEFAULT NULL COMMENT 'Nombre max d''utilisations (NULL = illimité)',
    utilisations INT DEFAULT 0 COMMENT 'Compteur d''utilisations',
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_code_inscription (code),
    INDEX idx_code_equipe (equipe_id),
    FOREIGN KEY (equipe_id) REFERENCES equipes(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Codes d''auto-inscription par équipe';

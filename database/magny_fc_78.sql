-- =====================================================
-- MAGNY FC 78 - Base de données complète
-- Tout le contenu est dynamique et administrable
-- =====================================================

CREATE DATABASE IF NOT EXISTS magnyfc78_db 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE magnyfc78_db;

-- =====================================================
-- UTILISATEURS & AUTHENTIFICATION
-- =====================================================
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100),
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'editor', 'admin') DEFAULT 'user',
    avatar VARCHAR(255),
    actif BOOLEAN DEFAULT TRUE,
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB;

-- Admin par défaut (password: Admin123!)
INSERT INTO users (id, nom, prenom, email, password, role) VALUES 
('admin-001', 'Admin', 'MFC', 'admin@magnyfc78.fr', 
'$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.qKLXFg7VJXqXXe', 'admin');

-- =====================================================
-- CONFIGURATION DU SITE
-- =====================================================
CREATE TABLE site_config (
    cle VARCHAR(100) PRIMARY KEY,
    valeur TEXT,
    type ENUM('text', 'textarea', 'image', 'color', 'boolean', 'json') DEFAULT 'text',
    groupe VARCHAR(50) DEFAULT 'general',
    label VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO site_config (cle, valeur, type, groupe, label) VALUES 
-- Général
('site_nom', 'MAGNY FC 78', 'text', 'general', 'Nom du site'),
('site_slogan', 'Le club de football amateur de Magny-les-Hameaux, Yvelines.', 'text', 'general', 'Slogan'),
('site_description', 'Club de football amateur depuis 2000', 'textarea', 'general', 'Description'),
('site_logo', '/assets/images/logo.jpeg', 'image', 'general', 'Logo'),
('site_favicon', '/assets/images/favicon.ico', 'image', 'general', 'Favicon'),
-- Contact
('contact_adresse', 'Stade Jean Jaurès, 4 rue Jean Jaurès, 78114 Magny-les-Hameaux', 'textarea', 'contact', 'Adresse'),
('contact_telephone', '01 XX XX XX XX', 'text', 'contact', 'Téléphone'),
('contact_email', 'contact@magnyfc78.fr', 'text', 'contact', 'Email'),
('contact_horaires', 'Mercredi : 14h - 18h | Samedi : 9h - 12h', 'text', 'contact', 'Horaires'),
-- Réseaux sociaux
('social_facebook', 'https://facebook.com/magnyfc78', 'text', 'social', 'Facebook'),
('social_instagram', 'https://instagram.com/magnyfc78', 'text', 'social', 'Instagram'),
('social_twitter', '', 'text', 'social', 'Twitter'),
('social_youtube', '', 'text', 'social', 'YouTube'),
-- Couleurs
('couleur_primaire', '#1a4d92', 'color', 'apparence', 'Couleur primaire'),
('couleur_secondaire', '#dabb81', 'color', 'apparence', 'Couleur secondaire'),
('couleur_accent', '#ffffff', 'color', 'apparence', 'Couleur accent'),
-- Hero
('hero_titre', 'MAGNY FC 78', 'text', 'hero', 'Titre Hero'),
('hero_soustitre', 'Le club de football amateur de Magny-les-Hameaux, Yvelines.', 'text', 'hero', 'Sous-titre Hero'),
('hero_image', '/assets/images/hero-bg.jpg', 'image', 'hero', 'Image de fond'),
('hero_bouton_texte', 'REJOINDRE LE CLUB', 'text', 'hero', 'Texte du bouton'),
('hero_bouton_lien', '/contact', 'text', 'hero', 'Lien du bouton'),
-- Stats
('stats', '[{"valeur":"300+","label":"Licenciés"},{"valeur":"17","label":"Équipes"},{"valeur":"24","label":"Années"},{"valeur":"1er","label":"Club de la ville"}]', 'json', 'stats', 'Statistiques');

-- =====================================================
-- MENU DE NAVIGATION
-- =====================================================
CREATE TABLE menu_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    url VARCHAR(255) NOT NULL,
    icone VARCHAR(50),
    parent_id INT DEFAULT NULL,
    ordre INT DEFAULT 0,
    actif BOOLEAN DEFAULT TRUE,
    target ENUM('_self', '_blank') DEFAULT '_self',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES menu_items(id) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO menu_items (label, url, ordre, actif) VALUES 
('ÉQUIPES', '/equipes', 1, TRUE),
('ACTUALITÉS', '/actualites', 2, TRUE),
('GALERIE', '/galerie', 3, TRUE),
('PARTENAIRES', '/partenaires', 4, TRUE),
('CONTACT', '/contact', 5, TRUE);

-- =====================================================
-- CATÉGORIES D'ÉQUIPES
-- =====================================================
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(50) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    couleur VARCHAR(7) DEFAULT '#1a2744',
    ordre INT DEFAULT 0,
    actif BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

INSERT INTO categories (nom, slug, ordre) VALUES 
('Seniors', 'seniors', 1),
('Féminines', 'feminines', 2),
('Vétérans', 'veterans', 3),
('Jeunes', 'jeunes', 4),
('École de Foot', 'ecole-de-foot', 5);

-- =====================================================
-- ÉQUIPES
-- =====================================================
CREATE TABLE equipes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    categorie_id INT,
    division VARCHAR(50),
    coach VARCHAR(100),
    assistant VARCHAR(100),
    description TEXT,
    photo VARCHAR(255),
    photo_equipe VARCHAR(255),
    horaires_entrainement TEXT,
    terrain VARCHAR(100),
    actif BOOLEAN DEFAULT TRUE,
    ordre INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (categorie_id) REFERENCES categories(id)
) ENGINE=InnoDB;

INSERT INTO equipes (nom, slug, categorie_id, division, coach, description) VALUES 
('Seniors 1', 'seniors-1', 1, 'R3', 'Mohamed K.', 'Équipe fanion du club évoluant en Régional 3'),
('Seniors 2', 'seniors-2', 1, 'D5', 'Eric L.', 'Équipe réserve seniors'),
('Seniors Féminines', 'seniors-feminines', 2, 'Critérium', 'Sophie M.', 'Équipe féminine senior'),
('Vétérans 1', 'veterans-1', 3, 'D3', 'Hervé M.', 'Équipe vétérans principale'),
('Vétérans 2', 'veterans-2', 3, 'D5', 'Jean-Pierre R.', 'Équipe vétérans loisir'),
('U19', 'u19', 4, 'D2', 'Karim B.', 'Équipe U19'),
('U17', 'u17', 4, 'D3', 'Fouzi B.', 'Équipe U17'),
('U15', 'u15', 4, 'D2', 'Myriam T.', 'Équipe U15'),
('U13', 'u13', 4, 'Critérium', 'David P.', 'Équipe U13'),
('U11', 'u11', 5, 'Critérium', 'Nicolas F.', 'École de foot U11'),
('U9', 'u9', 5, 'Plateau', 'Stéphane D.', 'École de foot U9'),
('U7', 'u7', 5, 'Éveil', 'Laurent G.', 'École de foot - Éveil');

-- =====================================================
-- JOUEURS
-- =====================================================
CREATE TABLE joueurs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    equipe_id INT,
    poste ENUM('Gardien', 'Défenseur', 'Milieu', 'Attaquant') DEFAULT 'Milieu',
    numero INT,
    date_naissance DATE,
    nationalite VARCHAR(50) DEFAULT 'France',
    photo VARCHAR(255),
    bio TEXT,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipe_id) REFERENCES equipes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =====================================================
-- MATCHS
-- =====================================================
CREATE TABLE matchs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipe_id INT,
    adversaire VARCHAR(100) NOT NULL,
    logo_adversaire VARCHAR(255),
    date_match DATETIME NOT NULL,
    lieu ENUM('domicile', 'exterieur') DEFAULT 'domicile',
    adresse_match VARCHAR(255),
    competition VARCHAR(100),
    journee VARCHAR(50),
    score_domicile INT DEFAULT NULL,
    score_exterieur INT DEFAULT NULL,
    resume TEXT,
    statut ENUM('a_venir', 'en_cours', 'termine', 'reporte', 'annule') DEFAULT 'a_venir',
    visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (equipe_id) REFERENCES equipes(id) ON DELETE CASCADE,
    INDEX idx_date (date_match),
    INDEX idx_statut (statut)
) ENGINE=InnoDB;

INSERT INTO matchs (equipe_id, adversaire, date_match, lieu, competition, statut) VALUES 
(1, 'Élancourt OSC', '2024-12-07 15:00:00', 'domicile', 'R3 - Journée 12', 'a_venir'),
(1, 'Buc Foot AO', '2024-12-14 15:00:00', 'exterieur', 'R3 - Journée 13', 'a_venir'),
(1, 'Rambouillet Yvelines', '2024-12-21 14:00:00', 'domicile', 'Coupe des Yvelines', 'a_venir'),
(2, 'Jouy en Josas US', '2024-12-08 15:00:00', 'domicile', 'D5 - Journée 10', 'a_venir'),
(6, 'Versailles FC', '2024-12-07 14:00:00', 'exterieur', 'U19 D2', 'a_venir'),
(1, 'Versailles Jussieu', '2024-11-30 15:00:00', 'domicile', 'R3 - Journée 11', 'termine'),
(1, 'Chesnay 78 FC', '2024-11-23 15:00:00', 'exterieur', 'R3 - Journée 10', 'termine');

UPDATE matchs SET score_domicile = 3, score_exterieur = 1 WHERE id = 6;
UPDATE matchs SET score_domicile = 1, score_exterieur = 2 WHERE id = 7;

-- =====================================================
-- ACTUALITÉS
-- =====================================================
CREATE TABLE actualites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    contenu TEXT,
    extrait VARCHAR(500),
    image VARCHAR(255),
    images_galerie JSON,
    categorie ENUM('Match', 'Club', 'Événement', 'Formation', 'Partenaire', 'Autre') DEFAULT 'Club',
    auteur_id VARCHAR(36),
    tags JSON,
    vues INT DEFAULT 0,
    publie BOOLEAN DEFAULT TRUE,
    a_la_une BOOLEAN DEFAULT FALSE,
    date_publication DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (auteur_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_publie (publie),
    INDEX idx_date (date_publication),
    FULLTEXT idx_recherche (titre, contenu, extrait)
) ENGINE=InnoDB;

INSERT INTO actualites (titre, slug, extrait, contenu, categorie, publie, a_la_une, date_publication) VALUES 
('Victoire des Seniors face à Versailles !', 'victoire-seniors-versailles', 
'Belle performance de nos seniors qui s\'imposent 3-1 à domicile lors de cette rencontre de R3.',
'<p>Ce samedi, nos Seniors 1 ont réalisé une très belle prestation face à Versailles Jussieu. Menés au score dès la 15ème minute, nos joueurs ont su réagir et renverser la situation grâce à un doublé de notre attaquant et un but du milieu de terrain.</p><p>Le coach se dit satisfait de la performance collective.</p>',
'Match', TRUE, TRUE, '2024-11-30 18:00:00'),

('Inscriptions saison 2024-2025 ouvertes', 'inscriptions-saison-2024-2025',
'Les inscriptions pour la nouvelle saison sont ouvertes. Rejoignez le Magny FC 78 !',
'<p>Le Magny FC 78 ouvre ses inscriptions pour la saison 2024-2025. Que vous soyez débutant ou confirmé, enfant ou adulte, il y a une place pour vous dans notre club !</p><p>Rendez-vous au secrétariat aux horaires d\'ouverture ou contactez-nous par email.</p>',
'Club', TRUE, FALSE, '2024-11-15 10:00:00'),

('Tournoi de Noël U10-U11', 'tournoi-noel-u10-u11',
'Le traditionnel tournoi de Noël aura lieu le 21 décembre au stade Jean Jaurès.',
'<p>Comme chaque année, le club organise son tournoi de Noël pour les catégories U10 et U11. Au programme : matchs, animations et goûter pour tous les participants !</p>',
'Événement', TRUE, FALSE, '2024-11-10 14:00:00'),

('Nouveau partenariat avec Sport 2000', 'partenariat-sport-2000',
'Le club est fier d\'annoncer son partenariat avec Sport 2000 pour l\'équipement des équipes.',
'<p>Nous sommes heureux de vous annoncer notre nouveau partenariat avec Sport 2000 Magny. Ce partenariat permettra à nos équipes de bénéficier d\'équipements de qualité à des tarifs préférentiels.</p>',
'Partenaire', TRUE, FALSE, '2024-11-05 09:00:00');

-- =====================================================
-- GALERIE PHOTOS
-- =====================================================
CREATE TABLE galerie_albums (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    image_couverture VARCHAR(255),
    date_evenement DATE,
    actif BOOLEAN DEFAULT TRUE,
    ordre INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO galerie_albums (titre, slug, description, date_evenement) VALUES 
('Match Seniors vs Versailles', 'match-seniors-versailles', 'Photos du match du 30 novembre 2024', '2024-11-30'),
('Tournoi U11 Novembre', 'tournoi-u11-novembre', 'Photos du tournoi U11', '2024-11-16'),
('Remise des maillots', 'remise-maillots-2024', 'Cérémonie de remise des maillots saison 2024-2025', '2024-09-15'),
('Fête du club 2024', 'fete-club-2024', 'Photos de la fête annuelle du club', '2024-06-22');

CREATE TABLE galerie_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    album_id INT,
    titre VARCHAR(255),
    description TEXT,
    fichier VARCHAR(255) NOT NULL,
    thumbnail VARCHAR(255),
    ordre INT DEFAULT 0,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES galerie_albums(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- PARTENAIRES
-- =====================================================
CREATE TABLE partenaires (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    logo VARCHAR(255),
    site_web VARCHAR(255),
    type ENUM('principal', 'officiel', 'partenaire', 'fournisseur') DEFAULT 'partenaire',
    ordre INT DEFAULT 0,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO partenaires (nom, slug, type, site_web, ordre) VALUES 
('Sport 2000', 'sport-2000', 'principal', 'https://www.sport2000.fr', 1),
('Mairie de Magny-les-Hameaux', 'mairie-magny', 'officiel', 'https://magny-les-hameaux.fr', 2),
('Boulangerie du Centre', 'boulangerie-centre', 'partenaire', '', 3),
('Auto-École Magny', 'auto-ecole-magny', 'partenaire', '', 4),
('Pharmacie des Hameaux', 'pharmacie-hameaux', 'partenaire', '', 5);

-- =====================================================
-- DOCUMENTS
-- =====================================================
CREATE TABLE documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    fichier VARCHAR(255) NOT NULL,
    type_fichier VARCHAR(50),
    taille INT,
    categorie ENUM('inscription', 'reglement', 'convocation', 'rapport', 'autre') DEFAULT 'autre',
    public BOOLEAN DEFAULT TRUE,
    telechargements INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================
-- MESSAGES CONTACT
-- =====================================================
CREATE TABLE contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    telephone VARCHAR(20),
    sujet VARCHAR(255),
    message TEXT NOT NULL,
    lu BOOLEAN DEFAULT FALSE,
    traite BOOLEAN DEFAULT FALSE,
    reponse TEXT,
    repondu_par VARCHAR(36),
    repondu_le DATETIME,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repondu_par) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =====================================================
-- PAGES PERSONNALISÉES
-- =====================================================
CREATE TABLE pages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    contenu TEXT,
    meta_description VARCHAR(255),
    meta_keywords VARCHAR(255),
    image VARCHAR(255),
    template VARCHAR(50) DEFAULT 'default',
    publie BOOLEAN DEFAULT TRUE,
    ordre INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO pages (titre, slug, contenu, publie) VALUES 
('Mentions légales', 'mentions-legales', '<h2>Mentions légales</h2><p>Contenu à compléter...</p>', TRUE),
('Politique de confidentialité', 'politique-confidentialite', '<h2>Politique de confidentialité</h2><p>Contenu à compléter...</p>', TRUE);

-- =====================================================
-- LOGS D'ACTIVITÉ (AUDIT)
-- =====================================================
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36),
    action VARCHAR(100) NOT NULL,
    entite VARCHAR(50),
    entite_id INT,
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_date (created_at)
) ENGINE=InnoDB;

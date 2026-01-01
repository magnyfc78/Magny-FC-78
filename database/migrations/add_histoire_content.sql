-- Migration: Ajout du contenu dynamique pour la page Histoire
-- Date: 2024-12-30

-- Table de configuration Histoire
CREATE TABLE IF NOT EXISTS histoire_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cle VARCHAR(100) NOT NULL UNIQUE,
    valeur TEXT,
    type VARCHAR(20) DEFAULT 'text',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Insérer les configurations par défaut (ignore si existe déjà)
INSERT IGNORE INTO histoire_config (cle, valeur, type) VALUES
('intro_titre', '24 ans de passion footballistique', 'text'),
('intro_texte', 'Fondé en 2000, le Magny Football Club 78 est devenu au fil des années un pilier de la vie sportive de Magny-les-Hameaux. De sa création modeste à son statut actuel de premier club de la ville avec plus de 300 licenciés et 17 équipes, découvrez notre parcours à travers les images qui ont marqué notre histoire.', 'textarea'),
('annee_creation', '2000', 'number'),
('nombre_licencies', '300+', 'text'),
('nombre_equipes', '17', 'text'),
('slogan', 'Magny FC 78 - Depuis 2000', 'text');

-- Table des moments clés
CREATE TABLE IF NOT EXISTS histoire_moments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    annee INT NOT NULL,
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    image VARCHAR(255),
    ordre INT DEFAULT 0,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Insérer les moments clés par défaut (seulement si table vide)
INSERT INTO histoire_moments (annee, titre, description, ordre)
SELECT * FROM (
    SELECT 2000 as annee, 'Création du club' as titre, 'Naissance du Magny FC 78, un rêve partagé par des passionnés du ballon rond.' as description, 1 as ordre
    UNION SELECT 2005, 'Première montée', 'L''équipe première monte en division supérieure pour la première fois.', 2
    UNION SELECT 2010, '10 ans du club', 'Célébration de notre première décennie avec une grande fête réunissant anciens et nouveaux membres.', 3
    UNION SELECT 2015, 'Montée en R3', 'L''équipe première accède au niveau Régional 3, marquant une étape importante.', 4
    UNION SELECT 2018, 'Inauguration des vestiaires', 'Nouveaux vestiaires inaugurés au stade municipal.', 5
    UNION SELECT 2020, '20 ans du club', 'Deux décennies de football, de passion et de valeurs partagées.', 6
    UNION SELECT 2024, 'Record de licenciés', 'Le club atteint le cap historique des 300 licenciés.', 7
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM histoire_moments LIMIT 1);

commit;

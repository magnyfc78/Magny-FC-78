-- Migration: Corriger l'ordre des catégories d'équipes
-- Du plus jeune (crevettes/école de foot) au plus vieux (vétérans)

USE magnyfc78_db;

-- Mettre à jour l'ordre des catégories
UPDATE categories SET ordre = 1 WHERE slug = 'ecole-de-foot';
UPDATE categories SET ordre = 2 WHERE slug = 'jeunes';
UPDATE categories SET ordre = 3 WHERE slug = 'feminines';
UPDATE categories SET ordre = 4 WHERE slug = 'seniors';
UPDATE categories SET ordre = 5 WHERE slug = 'veterans';

-- Vérification
SELECT id, nom, slug, ordre FROM categories ORDER BY ordre;

-- =====================================================
-- Migration: Add FFF team name column
-- Date: 2026-01-19
-- Description: Adds fff_nom column to link local team to FFF team name
-- =====================================================

-- Add FFF team name to equipes table (the name as it appears on dyf78.fff.fr)
ALTER TABLE equipes
ADD COLUMN fff_nom VARCHAR(150) DEFAULT NULL COMMENT 'Nom de l''équipe sur le site FFF (pour le matching)';

-- Example values:
-- Local team: "Seniors A"     -> fff_nom: "MAGNY 78 FC - Seniors A"
-- Local team: "U18 Excellence" -> fff_nom: "MAGNY 78 FC - U18 Excellence"

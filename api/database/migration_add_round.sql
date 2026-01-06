-- Migration: Add round column to match table
-- This allows storing the round information for each match (e.g., "Round 1", "Semifinals", "Finals")

ALTER TABLE `match` 
ADD COLUMN `round` VARCHAR(100) NULL AFTER `winner_id`;


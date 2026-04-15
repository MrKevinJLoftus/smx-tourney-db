-- Migration: Add player.hidden_matches flag
-- When true, all matches involving the player are hidden site-wide.

ALTER TABLE `player`
  ADD COLUMN `hidden_matches` BOOLEAN NOT NULL DEFAULT FALSE AFTER `pronouns`;


-- Migration: Add song_order column to match_x_player_x_song table
-- This allows preserving the order of songs as they appear in the match form

ALTER TABLE `match_x_player_x_song` 
ADD COLUMN `song_order` INT NULL AFTER `song_id`;


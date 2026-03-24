-- Migration: Add chart_id column to match_x_player_x_song table
-- This allows storing which chart (from song_x_chart) was played for each song in a match

ALTER TABLE `match_x_player_x_song` 
ADD COLUMN `chart_id` INT NULL AFTER `song_id`,
ADD FOREIGN KEY (`chart_id`) REFERENCES `song_x_chart`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


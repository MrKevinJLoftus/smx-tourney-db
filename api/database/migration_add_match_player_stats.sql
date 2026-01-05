-- Migration: Add match_x_player_stats table
-- This table stores W-L-D (Wins-Losses-Draws) statistics for each player in each match
-- This allows simple match reporting without requiring individual song scores

CREATE TABLE IF NOT EXISTS `match_x_player_stats` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `match_id` INT NOT NULL,
    `player_id` INT NOT NULL,
    `wins` INT DEFAULT 0,
    `losses` INT DEFAULT 0,
    `draws` INT DEFAULT 0,
    `created_by` INT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    UNIQUE KEY `unique_match_player` (`match_id`, `player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


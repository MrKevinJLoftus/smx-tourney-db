-- Migration: Add player_rating table for Glicko-2 ratings used by the seed generator

CREATE TABLE IF NOT EXISTS `player_rating` (
    `player_id` INT NOT NULL PRIMARY KEY,
    `rating` DOUBLE NOT NULL DEFAULT 1500,
    `deviation` DOUBLE NOT NULL DEFAULT 350,
    `volatility` DOUBLE NOT NULL DEFAULT 0.06,
    `matches_counted` INT NOT NULL DEFAULT 0,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

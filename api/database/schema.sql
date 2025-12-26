-- MySQL script to create database tables for SMX Tournament Database
-- Execute this script to set up the database schema

-- Table 1: user (must be created first as it's referenced by other tables)
CREATE TABLE IF NOT EXISTS `user` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(20) NOT NULL,
    `hashed_pw` VARCHAR(500) NOT NULL,
    `role` VARCHAR(20),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 2: event (references user)
CREATE TABLE IF NOT EXISTS `event` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `date` DATETIME,
    `description` VARCHAR(500),
    `created_by` INT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 3: song (standalone table)
CREATE TABLE IF NOT EXISTS `song` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `title` VARCHAR(100) NOT NULL,
    `artist` VARCHAR(100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 4: song_x_chart (references song)
CREATE TABLE IF NOT EXISTS `song_x_chart` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `song_id` INT,
    `difficulty` INT,
    `mode` VARCHAR(20),
    FOREIGN KEY (`song_id`) REFERENCES `song`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 5: player (references user)
CREATE TABLE IF NOT EXISTS `player` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL,
    `pronouns` VARCHAR(20),
    `created_by` INT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 6: event_x_player (references event, player, user)
CREATE TABLE IF NOT EXISTS `event_x_player` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `event_id` INT,
    `player_id` INT,
    `seed` VARCHAR(20),
    `placement` VARCHAR(50),
    `created_by` INT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 7: match (references event, user)
CREATE TABLE IF NOT EXISTS `match` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `event_id` INT,
    `created_by` INT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 8: match_x_player_x_song (references match, player, song, user)
CREATE TABLE IF NOT EXISTS `match_x_player_x_song` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `match_id` INT,
    `player_id` INT,
    `song_id` INT,
    `score` INT,
    `win` BOOLEAN DEFAULT FALSE,
    `created_by` INT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`song_id`) REFERENCES `song`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 9: match_x_song (references match, song, user)
CREATE TABLE IF NOT EXISTS `match_x_song` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `match_id` INT,
    `song_id` INT,
    `song_order` INT,
    `created_by` INT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`song_id`) REFERENCES `song`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


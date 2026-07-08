CREATE TABLE IF NOT EXISTS `match_player_rating` (
    `match_id` INT NOT NULL,
    `player_id` INT NOT NULL,
    `rating` DOUBLE NOT NULL,
    `deviation` DOUBLE NOT NULL,
    PRIMARY KEY (`match_id`, `player_id`),
    KEY `idx_match_player_rating_player_id` (`player_id`),
    FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

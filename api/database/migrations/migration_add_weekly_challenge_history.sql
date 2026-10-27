-- Migration: Add weekly challenge history for the all-time top 10 / 1st place counts.
-- Only finalized weeks are stored, and only players who finished 10th or better.

CREATE TABLE IF NOT EXISTS `weekly_challenge_week` (
    `week_key` DATE NOT NULL PRIMARY KEY,
    `chart_ids` JSON NOT NULL,
    `finalized_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `weekly_challenge_result` (
    `week_key` DATE NOT NULL,
    `difficulty` ENUM('easy', 'hard', 'wild', 'full') NOT NULL,
    `gamer_id` INT NOT NULL,
    `username` VARCHAR(64) NOT NULL,
    `final_rank` SMALLINT NOT NULL,
    `total` INT NOT NULL,
    PRIMARY KEY (`week_key`, `difficulty`, `gamer_id`),
    KEY `idx_weekly_challenge_result_gamer` (`gamer_id`, `difficulty`),
    FOREIGN KEY (`week_key`) REFERENCES `weekly_challenge_week`(`week_key`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

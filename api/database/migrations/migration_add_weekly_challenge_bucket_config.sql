-- Migration: Admin-editable level buckets for the weekly challenge draw.
-- Each row applies to its difficulty from effective_week onward, until a later row replaces it.
-- A NULL buckets value means the automatic thirds of the level range.

CREATE TABLE IF NOT EXISTS `weekly_challenge_bucket_config` (
    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `effective_week` DATE NOT NULL,
    `difficulty` ENUM('easy', 'hard', 'wild', 'dual', 'full') NOT NULL,
    `buckets` JSON NULL,
    `created_by` INT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_weekly_challenge_bucket_config_lookup` (`difficulty`, `effective_week`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

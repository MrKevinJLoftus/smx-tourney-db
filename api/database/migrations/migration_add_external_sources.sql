-- Adds external source tracking for events and matches imported from blamethepads / ddr.tools.
-- Event key examples: ('blamethepads', '101'), ('ddrtools', '<room code>').
-- Match key examples: ('blamethepads', 'round:1674'), ('ddrtools', 'draw:<room>:<drawing id>').

ALTER TABLE `event`
  ADD COLUMN `external_source` VARCHAR(30) NULL DEFAULT NULL AFTER `start_gg_event_id`,
  ADD COLUMN `external_id` VARCHAR(100) NULL DEFAULT NULL AFTER `external_source`;

ALTER TABLE `event`
  ADD UNIQUE KEY `uniq_event_external_source_id` (`external_source`, `external_id`);

CREATE TABLE IF NOT EXISTS `match_external_source` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `match_id` INT NOT NULL,
    `source` VARCHAR(30) NOT NULL,
    `source_key` VARCHAR(150) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY `uniq_match_external_source_key` (`source`, `source_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tracks max event.startAt (unix sec) seen on last "Refresh from start.gg" for StepManiaX discovery.
-- Next refresh only returns events with startAt strictly greater than this value (incremental manual/cron).
CREATE TABLE IF NOT EXISTS `start_gg_discovery_state` (
  `id` TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  `last_max_event_start_at` INT UNSIGNED NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `start_gg_discovery_state` (`id`, `last_max_event_start_at`) VALUES (1, NULL);

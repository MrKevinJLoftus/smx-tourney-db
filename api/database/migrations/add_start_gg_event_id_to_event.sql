-- Adds start.gg source id for deduplication and traceability (nullable; unique when set).
ALTER TABLE `event`
  ADD COLUMN `start_gg_event_id` BIGINT UNSIGNED NULL DEFAULT NULL AFTER `created_by`;

ALTER TABLE `event`
  ADD UNIQUE KEY `uniq_event_start_gg_event_id` (`start_gg_event_id`);

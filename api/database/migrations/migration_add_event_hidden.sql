-- Migration: Add event.hidden flag
-- Hidden events should not appear in public site queries.

ALTER TABLE `event`
  ADD COLUMN `hidden` BOOLEAN NOT NULL DEFAULT FALSE AFTER `start_gg_event_id`;


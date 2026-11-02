-- Migration: Recover Dual weekly challenge results saved before 'dual' was allowed.
-- Without STRICT mode, MySQL stored the unknown ENUM value as '' instead of rejecting it.
-- Dual is the only difficulty that was ever missing from the ENUM, so '' rows are Dual rows.
-- Safe to run more than once.

ALTER TABLE `weekly_challenge_result`
    MODIFY `difficulty` ENUM('easy', 'hard', 'wild', 'dual', 'full') NOT NULL;

UPDATE `weekly_challenge_result` SET `difficulty` = 'dual' WHERE `difficulty` = '';

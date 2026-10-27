-- Migration: Allow Dual results in the weekly challenge history.

ALTER TABLE `weekly_challenge_result`
    MODIFY `difficulty` ENUM('easy', 'hard', 'wild', 'dual', 'full') NOT NULL;

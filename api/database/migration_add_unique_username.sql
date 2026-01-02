-- Migration: Add UNIQUE constraint to username column in user table
-- This prevents duplicate email addresses from being registered
-- 
-- WARNING: If duplicate usernames already exist in the database, this migration will fail.
-- Before running this migration, check for duplicates with:
-- SELECT username, COUNT(*) as count FROM user GROUP BY username HAVING count > 1;
-- If duplicates exist, they must be resolved before running this migration.

ALTER TABLE `user` 
ADD UNIQUE KEY `unique_username` (`username`);


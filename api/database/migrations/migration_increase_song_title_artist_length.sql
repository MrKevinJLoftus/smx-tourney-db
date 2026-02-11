-- Migration: Increase song title and artist column character limits
-- Changes title and artist columns from VARCHAR(100) to VARCHAR(250)
-- to accommodate longer song titles and artist names

ALTER TABLE `song` 
MODIFY COLUMN `title` VARCHAR(250) NOT NULL,
MODIFY COLUMN `artist` VARCHAR(250);


-- Migration: Allow null values for is_folder column
-- This migration removes the NOT NULL constraint from the is_folder column
-- to handle cases where Jellyfin API doesn't provide IsFolder property

-- Remove NOT NULL constraint from is_folder column
ALTER TABLE "items" ALTER COLUMN "is_folder" DROP NOT NULL;

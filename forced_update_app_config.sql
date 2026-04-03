-- Forced Update System Configuration
-- ====================================
-- INSTRUCTIONS:
-- 1. Copy this entire script
-- 2. Go to Supabase Dashboard → SQL Editor
-- 3. Paste and run the entire script
-- 4. DO NOT EDIT anything in this script - use Supabase UI to update values

-- Create app_config table if it doesn't exist
CREATE TABLE IF NOT EXISTS app_config (
  id BIGINT PRIMARY KEY DEFAULT 1
);

-- Add columns if they don't exist (schema-safe)
ALTER TABLE app_config 
  ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0.0';

ALTER TABLE app_config 
  ADD COLUMN IF NOT EXISTS apk_url TEXT DEFAULT 'https://your-storage-url/app-release.apk';

ALTER TABLE app_config 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Ensure id=1 row exists with default values
INSERT INTO app_config (id, version, apk_url, updated_at)
VALUES (1, '1.0.0', 'https://your-storage-url/app-release.apk', CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET
  version = '1.0.0',
  apk_url = 'https://your-storage-url/app-release.apk',
  updated_at = CURRENT_TIMESTAMP;

-- TO UPDATE VALUES AFTER RUNNING THIS SCRIPT:
-- 1. Go to Supabase Dashboard → Database → Tables → app_config
-- 2. Edit the row with id=1
-- 3. Update 'version' to your current app version (e.g., '1.0.0')
-- 4. Update 'apk_url' to your cloud storage URL (e.g., S3, Google Cloud Storage)
-- 5. Save changes
--
-- Your app will automatically fetch these values on startup and block old versions!

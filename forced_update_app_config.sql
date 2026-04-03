-- Forced Update System Configuration
-- ====================================
-- This is a reusable migration script. Every time you release a new APK:
-- 1. Update the VERSION value below (must match your app version)
-- 2. Update the APK_URL value below (path to your APK in cloud storage)
-- 3. Run this entire script in your Supabase SQL editor

-- DO NOT MODIFY: These are the values to change
-- EDIT THESE TWO VALUES FOR EACH RELEASE:
\set VERSION '1.0.0'
\set APK_URL 'https://your-storage-url/app-release.apk'

-- Setup table if it doesn't exist
CREATE TABLE IF NOT EXISTS app_config (
  id BIGINT PRIMARY KEY DEFAULT 1,
  version TEXT NOT NULL,
  apk_url TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add columns if they don't exist (schema-safe)
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '';
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS apk_url TEXT;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Ensure row id=1 exists
INSERT INTO app_config (id, version, apk_url, updated_at)
VALUES (1, :'VERSION', :'APK_URL', CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET
  version = :'VERSION',
  apk_url = :'APK_URL',
  updated_at = CURRENT_TIMESTAMP;

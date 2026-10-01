-- V5: Alter profile_image_url to TEXT to support Data URLs (Base64 images)
ALTER TABLE blog_users ALTER COLUMN profile_image_url TYPE TEXT;

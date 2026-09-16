-- DORO Blog Schema Migration V2
-- Target DB: service_blog
-- Description: User Profile Expansion (public_email, linkedin, about_markdown, follow counts) and User Follows Table

ALTER TABLE blog_users
    ADD COLUMN IF NOT EXISTS public_email VARCHAR(100),
    ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255),
    ADD COLUMN IF NOT EXISTS about_markdown TEXT,
    ADD COLUMN IF NOT EXISTS follower_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS following_count INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_follows (
    id UUID PRIMARY KEY,
    follower_id UUID NOT NULL REFERENCES blog_users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES blog_users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_user_follows UNIQUE (follower_id, following_id),
    CONSTRAINT ck_user_follows_self CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

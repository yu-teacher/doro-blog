-- V4__notifications.sql
-- Social Notifications (Comments, Replies, Likes, Follows)

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES blog_users(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES blog_users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    target_post_id UUID,
    target_post_title VARCHAR(255),
    target_post_slug VARCHAR(255),
    target_username VARCHAR(100),
    message VARCHAR(500),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications (recipient_id, is_read);

-- DORO Blog V13: 플랫폼 알림 서비스(doro-notify)로 보낼 푸시 요청 아웃박스.
-- 알림을 저장하는 같은 트랜잭션에서 한 줄을 쌓고(blog.notify.service-token 이 있을 때만), 재시도기가 알림 서비스에 보낸다.
-- 알림 서비스가 느리거나 잠깐 죽어 있어도 알림 요청을 잃지 않는다. 보낸 행은 지운다(내용은 보내기 전까지만 남는다).
-- 알림 서비스의 멱등 키 덕분에 다시 보내도 두 번 가지 않는다.
CREATE TABLE IF NOT EXISTS notify_outbox (
    id UUID PRIMARY KEY,
    recipient_id UUID NOT NULL,
    type VARCHAR(40) NOT NULL,
    title VARCHAR(300) NOT NULL,
    body VARCHAR(2000) NOT NULL,
    tag VARCHAR(200) NOT NULL,
    url VARCHAR(500) NOT NULL,
    urgent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_error VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS idx_notify_outbox_next_attempt ON notify_outbox (next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_notify_outbox_recipient ON notify_outbox (recipient_id);

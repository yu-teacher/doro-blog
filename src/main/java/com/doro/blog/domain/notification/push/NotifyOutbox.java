package com.doro.blog.domain.notification.push;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** 알림 서비스로 아직 보내지 못한 알림 요청. 보낼 때까지(또는 만료될 때까지) 다시 시도한다. */
@Repository
@RequiredArgsConstructor
public class NotifyOutbox {

    /** 다시 보내야 하는 알림 한 건(내용 포함). */
    public record Row(UUID id, UUID recipientId, String type, String title, String body, String tag, String url, boolean urgent, Instant expiresAt, int attempts) {
    }

    private final JdbcTemplate jdbc;

    /** 호출한 쪽의 트랜잭션에 참여한다(알림 저장과 같이 커밋되거나 같이 되돌려진다). */
    public void enqueue(UUID recipientId, String type, String title, String body, String tag, String url, boolean urgent, Instant now, Instant expiresAt) {
        jdbc.update("""
                INSERT INTO notify_outbox (id, recipient_id, type, title, body, tag, url, urgent, created_at, expires_at, attempts, next_attempt_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)""",
                UUID.randomUUID(), recipientId, type, limit(title, 300), limit(body, 2000), limit(tag, 200), limit(url, 500), urgent,
                Timestamp.from(now), Timestamp.from(expiresAt), Timestamp.from(now));
    }

    /** 시도할 때가 된 행 id 를 오래된 순으로. */
    public List<UUID> findDueIds(Instant now, int limit) {
        return jdbc.query("SELECT id FROM notify_outbox WHERE next_attempt_at <= ? ORDER BY next_attempt_at LIMIT ?",
                (rs, n) -> rs.getObject("id", UUID.class), Timestamp.from(now), limit);
    }

    /** 행을 잠그고 가져온다(다른 인스턴스가 잡은 행은 건너뛴다). 이미 처리됐으면 빈 값. 트랜잭션 안에서 불러야 한다. */
    public Optional<Row> lock(UUID id) {
        return jdbc.query("""
                SELECT id, recipient_id, type, title, body, tag, url, urgent, expires_at, attempts FROM notify_outbox WHERE id = ? FOR UPDATE SKIP LOCKED""",
                (rs, n) -> new Row(rs.getObject("id", UUID.class), rs.getObject("recipient_id", UUID.class), rs.getString("type"), rs.getString("title"),
                        rs.getString("body"), rs.getString("tag"), rs.getString("url"), rs.getBoolean("urgent"), rs.getTimestamp("expires_at").toInstant(),
                        rs.getInt("attempts")), id)
                .stream().findFirst();
    }

    public void delete(UUID id) {
        jdbc.update("DELETE FROM notify_outbox WHERE id = ?", id);
    }

    /** 탈퇴한 사용자에게 갈 아직 안 보낸 요청을 지운다(개인 정보 최소화). */
    public int deleteByRecipient(UUID recipientId) {
        return jdbc.update("DELETE FROM notify_outbox WHERE recipient_id = ?", recipientId);
    }

    public void reschedule(UUID id, int attempts, Instant next, String error) {
        jdbc.update("UPDATE notify_outbox SET attempts = ?, next_attempt_at = ?, last_error = ? WHERE id = ?", attempts, Timestamp.from(next), limit(error, 500), id);
    }

    public long count() {
        Long n = jdbc.queryForObject("SELECT count(*) FROM notify_outbox", Long.class);
        return n == null ? 0 : n;
    }

    private static String limit(String value, int max) {
        if (value == null) {
            return "";
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}

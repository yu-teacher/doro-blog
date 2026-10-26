package com.doro.blog.domain.notification.push;

import com.doro.blog.domain.notification.entity.NotificationType;
import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.user.entity.BlogUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * 저장된 알림을 알림 서비스 요청으로 아웃박스에 쌓는다. 알림을 저장하는 트랜잭션 안에서 부르므로 알림이 커밋될 때만 같이 남고,
 * 여기서 하는 일은 INSERT 하나뿐이라 알림 서비스가 죽어 있어도 댓글·좋아요 저장에는 영향이 없다(보내기는 재시도기가 따로 한다).
 * 알림 서비스를 쓰지 않는 상태(토큰 없음)에서는 아무것도 하지 않는다.
 */
@Component
@RequiredArgsConstructor
public class NotifyEnqueuer {

    /** 이 시간 안에 보내지 못한 알림은 버린다(낡은 알림이 늦게 가지 않게). */
    static final Duration RETRY_WINDOW = Duration.ofHours(1);

    private final NotifyProperties properties;
    private final NotifyOutbox outbox;
    private final Clock clock = Clock.systemUTC();

    public void enqueue(BlogUser recipient, BlogUser sender, NotificationType type, Post post, String targetUsername, String message) {
        if (!properties.enabled()) {
            return;
        }
        NotifyMapper.Content content = NotifyMapper.content(type, sender.getId(), sender.getNickname(), sender.getUsername(),
                post != null ? post.getId() : null, post != null ? post.getTitle() : null, post != null ? post.getSlug() : null, targetUsername, message);
        Instant now = clock.instant();
        outbox.enqueue(recipient.getId(), content.type(), content.title(), content.body(), content.tag(),
                properties.toNotifyUrl(content.path()), content.urgent(), now, now.plus(RETRY_WINDOW));
    }
}

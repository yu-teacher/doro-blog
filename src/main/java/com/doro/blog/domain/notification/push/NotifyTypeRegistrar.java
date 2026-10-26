package com.doro.blog.domain.notification.push;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * 시작할 때 블로그의 알림 종류 4개를 알림 서비스에 등록한다(멱등 upsert). 토큰이 있을 때만 하고, 별도 스레드에서 하며,
 * 실패해도 조용히 넘어간다(알림 서비스가 아직 안 떠 있어도 블로그 기동은 영향받지 않는다. 다음 기동 때 다시 등록된다).
 * 종류 id 는 {@link NotifyMapper#typeId} 와 같다: COMMENT→comment, REPLY→reply, LIKE→like, FOLLOW→follow.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotifyTypeRegistrar {

    static final List<Map<String, Object>> TYPES = List.of(
            type("comment", "새 댓글", "내 글에 댓글이 달리면 알려 줘요.", true),
            type("reply", "답글", "내 댓글에 답글이 달리면 알려 줘요.", true),
            type("like", "좋아요", "내 글에 좋아요가 눌리면 알려 줘요.", true),
            type("follow", "새 팔로워", "누군가 나를 팔로우하면 알려 줘요.", true));

    private final NotifyProperties properties;
    private final NotifyClient client;

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        if (!properties.enabled()) {
            return;
        }
        Thread thread = new Thread(this::register, "notify-type-registrar");
        thread.setDaemon(true);
        thread.start();
    }

    /** 종류를 등록한다. 성공 여부만 돌려주고 예외는 밖으로 내지 않는다. */
    boolean register() {
        try {
            NotifyClient.Reply reply = client.registerTypes(TYPES);
            if (reply.ok()) {
                log.info("Notify types registered: {}", TYPES.size());
                return true;
            }
            log.warn("Notify types registration rejected: status={}", reply.status());
        } catch (RuntimeException e) {
            log.warn("Notify types registration failed: {}", e.getClass().getSimpleName());
        }
        return false;
    }

    private static Map<String, Object> type(String id, String label, String description, boolean defaultOn) {
        return Map.of("type", id, "label", label, "description", description, "defaultOn", defaultOn);
    }
}

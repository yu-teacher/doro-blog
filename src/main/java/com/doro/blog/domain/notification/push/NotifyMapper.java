package com.doro.blog.domain.notification.push;

import com.doro.blog.domain.notification.entity.NotificationType;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * 블로그 알림을 알림 서비스의 요청 내용(종류·제목·본문·tag·이동 주소·긴급도)으로 바꾸는 순수 규칙.
 */
final class NotifyMapper {

    private NotifyMapper() {
    }

    /** 알림 한 건의 푸시 내용. url 은 블로그 안의 경로(예: /@name/slug)이고, 앱 범위(/blog/…) 절대 경로로의 변환은 보낼 때 한다. */
    record Content(String type, String title, String body, String tag, String path, boolean urgent) {
    }

    /** 블로그 알림 종류 → 알림 서비스의 종류 id. */
    static String typeId(NotificationType type) {
        return switch (type) {
            case COMMENT -> "comment";
            case REPLY -> "reply";
            case LIKE -> "like";
            case FOLLOW -> "follow";
        };
    }

    /**
     * 푸시 내용을 만든다.
     * <ul>
     *   <li>제목: 글 알림은 글 제목, 글이 없으면(팔로우) "새 팔로워".</li>
     *   <li>본문: 댓글·답글은 "보낸 사람: 내용", 좋아요·팔로우는 한 줄 문장.</li>
     *   <li>tag: 같은 글의 같은 종류는 하나로 합친다(댓글이 연달아 달려도 알림 하나만 남는다). 팔로우는 팔로워별.</li>
     *   <li>path: 앱 안에서 알림 목록이 여는 곳과 같다 — 글 알림은 {@code /@글쓴이/슬러그}, 팔로우는 {@code /@보낸사람}(web 의 notificationLink 와 같은 규칙).</li>
     *   <li>긴급도: 댓글·답글은 대화라 바로 가야 하므로 high, 좋아요·팔로우는 늦어도 되므로 normal(기기 배터리 절약 상태에서 깨우지 않는다).</li>
     * </ul>
     */
    static Content content(NotificationType type, UUID senderId, String senderName, String senderUsername,
                           UUID postId, String postTitle, String postSlug, String targetUsername, String message) {
        String who = senderName == null || senderName.isBlank() ? senderUsername : senderName;
        String title = postTitle != null && !postTitle.isBlank() ? postTitle : (type == NotificationType.FOLLOW ? "새 팔로워" : who);
        String body = switch (type) {
            case COMMENT, REPLY -> message == null || message.isBlank() ? who + "님이 " + (type == NotificationType.COMMENT ? "댓글을 남겼어요" : "답글을 남겼어요")
                    : who + ": " + message;
            case LIKE -> who + "님이 글을 좋아해요";
            case FOLLOW -> who + "님이 팔로우하기 시작했어요";
        };
        String tag = switch (type) {
            case FOLLOW -> "follow:" + senderId;
            default -> typeId(type) + ":" + (postId != null ? postId : senderId);
        };
        boolean urgent = type == NotificationType.COMMENT || type == NotificationType.REPLY;
        return new Content(typeId(type), title, body, tag, path(type, senderUsername, postSlug, targetUsername), urgent);
    }

    /** web/src/utils/notifications.ts 의 notificationLink 와 같은 목적지. 이동할 곳이 없으면 앱 첫 화면("/"). */
    static String path(NotificationType type, String senderUsername, String postSlug, String targetUsername) {
        if (postSlug != null && !postSlug.isBlank()) {
            String username = targetUsername != null && !targetUsername.isBlank() ? targetUsername : senderUsername;
            return "/@" + segment(username) + "/" + segment(postSlug);
        }
        if (type == NotificationType.FOLLOW) {
            return "/@" + segment(senderUsername);
        }
        return "/";
    }

    private static String segment(String value) {
        return UriUtils.encodePathSegment(value, StandardCharsets.UTF_8);
    }
}

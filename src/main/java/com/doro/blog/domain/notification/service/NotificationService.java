package com.doro.blog.domain.notification.service;

import com.doro.blog.domain.notification.dto.NotificationDtos.NotificationResponse;
import com.doro.blog.domain.notification.dto.NotificationDtos.UnreadCountResponse;
import com.doro.blog.domain.notification.entity.Notification;
import com.doro.blog.domain.notification.entity.NotificationType;
import com.doro.blog.domain.notification.repository.NotificationRepository;
import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.repository.BlogUserRepository;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final BlogUserRepository userRepository;

    // Notification 컬럼 길이(V4__notifications.sql)
    private static final int TITLE_MAX_LENGTH = 255;
    private static final int MESSAGE_MAX_LENGTH = 500;

    /** 같은 사람이 같은 대상에 한 좋아요/팔로우 알림을 다시 만들지 않는 기간. */
    private static final Duration TOGGLE_DEDUPE_WINDOW = Duration.ofHours(24);

    /**
     * 알림을 저장한다. 글/댓글과 같은 트랜잭션에서 저장하므로 컬럼 길이를 넘는 값이 들어가면 INSERT 가 커밋 시점에 실패해
     * 원래 요청(예: 댓글 작성)까지 되돌려진다. 그래서 제목/메시지를 컬럼 길이에 맞게 잘라서 넣는다.
     * (별도 트랜잭션으로 미루면 요청 하나가 DB 연결을 두 개 잡아 동시 요청이 많을 때 풀이 고갈될 수 있어 같은 트랜잭션을 쓴다.)
     */
    @Transactional
    public void sendNotification(
            BlogUser recipient,
            BlogUser sender,
            NotificationType type,
            Post post,
            String targetUsername,
            String message
    ) {
        if (recipient == null || sender == null) {
            return;
        }

        // Do not notify self-actions
        if (recipient.getId().equals(sender.getId())) {
            return;
        }

        // Do not notify for non-published posts (DRAFT, PRIVATE)
        if (post != null && post.getStatus() != PostStatus.PUBLISHED) {
            return;
        }

        // 좋아요/팔로우는 토글을 반복해 같은 알림을 계속 만들 수 있으므로 같은 행위는 일정 시간 안에 한 번만 알린다
        if (isRepeatedToggleNotification(recipient, sender, type, post)) {
            log.debug("Skipped duplicate {} notification within {}", type, TOGGLE_DEDUPE_WINDOW);
            return;
        }

        Notification notification = Notification.builder()
                .recipient(recipient)
                .sender(sender)
                .type(type)
                .targetPostId(post != null ? post.getId() : null)
                .targetPostTitle(post != null ? truncate(post.getTitle(), TITLE_MAX_LENGTH) : null)
                .targetPostSlug(post != null ? post.getSlug() : null)
                .targetUsername(targetUsername != null ? targetUsername : (post != null ? post.getUser().getUsername() : null))
                .message(truncate(message, MESSAGE_MAX_LENGTH))
                .build();

        notificationRepository.save(notification);
    }

    private boolean isRepeatedToggleNotification(BlogUser recipient, BlogUser sender, NotificationType type, Post post) {
        if (type != NotificationType.LIKE && type != NotificationType.FOLLOW) {
            return false;
        }
        Instant since = Instant.now().minus(TOGGLE_DEDUPE_WINDOW);
        return post != null
                ? notificationRepository.existsByRecipientIdAndSenderIdAndTypeAndTargetPostIdAndCreatedAtAfter(
                        recipient.getId(), sender.getId(), type, post.getId(), since)
                : notificationRepository.existsByRecipientIdAndSenderIdAndTypeAndTargetPostIdIsNullAndCreatedAtAfter(
                        recipient.getId(), sender.getId(), type, since);
    }

    private static String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    /**
     * 알림을 보는 사용자. 블로그에서 아무 활동도 하지 않은 신규 사용자는 아직 블로그 사용자 행이 없을 수 있다.
     * 그 사용자는 받은 알림이 없을 뿐이므로 오류가 아니라 "없음"으로 다룬다(조회 경로에서 사용자를 만들지는 않는다).
     */
    private Optional<BlogUser> findUser(DoroUser doroUser) {
        if (!doroUser.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }
        return userRepository.findById(doroUser.userId());
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> getNotifications(DoroUser doroUser, Pageable pageable) {
        return findUser(doroUser)
                .map(user -> notificationRepository.findByRecipientIdOrderByCreatedAtDesc(user.getId(), pageable)
                        .map(NotificationResponse::from))
                .orElseGet(() -> Page.empty(pageable));
    }

    @Transactional(readOnly = true)
    public UnreadCountResponse getUnreadCount(DoroUser doroUser) {
        long count = findUser(doroUser)
                .map(user -> notificationRepository.countByRecipientIdAndIsReadFalse(user.getId()))
                .orElse(0L);
        return new UnreadCountResponse(count);
    }

    @Transactional
    public void markAsRead(UUID notificationId, DoroUser doroUser) {
        BlogUser user = findUser(doroUser).orElseThrow(() -> new BlogException(ErrorCode.NOTIFICATION_NOT_FOUND));
        Notification notification = notificationRepository.findByIdAndRecipientId(notificationId, user.getId())
                .orElseThrow(() -> new BlogException(ErrorCode.NOTIFICATION_NOT_FOUND));
        notification.markAsRead();
    }

    @Transactional
    public void markAllAsRead(DoroUser doroUser) {
        findUser(doroUser).ifPresent(user -> notificationRepository.markAllAsRead(user.getId()));
    }

    @Transactional
    public void deleteNotification(UUID notificationId, DoroUser doroUser) {
        findUser(doroUser).ifPresent(user -> notificationRepository.deleteByIdAndRecipientId(notificationId, user.getId()));
    }
}

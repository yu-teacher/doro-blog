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

    private static String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private BlogUser getUser(DoroUser doroUser) {
        if (!doroUser.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }
        return userRepository.findById(doroUser.userId())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> getNotifications(DoroUser doroUser, Pageable pageable) {
        BlogUser user = getUser(doroUser);
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(user.getId(), pageable)
                .map(NotificationResponse::from);
    }

    @Transactional(readOnly = true)
    public UnreadCountResponse getUnreadCount(DoroUser doroUser) {
        BlogUser user = getUser(doroUser);
        long count = notificationRepository.countByRecipientIdAndIsReadFalse(user.getId());
        return new UnreadCountResponse(count);
    }

    @Transactional
    public void markAsRead(UUID notificationId, DoroUser doroUser) {
        BlogUser user = getUser(doroUser);
        Notification notification = notificationRepository.findByIdAndRecipientId(notificationId, user.getId())
                .orElseThrow(() -> new BlogException(ErrorCode.NOTIFICATION_NOT_FOUND));
        notification.markAsRead();
    }

    @Transactional
    public void markAllAsRead(DoroUser doroUser) {
        BlogUser user = getUser(doroUser);
        notificationRepository.markAllAsRead(user.getId());
    }

    @Transactional
    public void deleteNotification(UUID notificationId, DoroUser doroUser) {
        BlogUser user = getUser(doroUser);
        notificationRepository.deleteByIdAndRecipientId(notificationId, user.getId());
    }
}

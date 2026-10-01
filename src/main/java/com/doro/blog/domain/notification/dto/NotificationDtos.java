package com.doro.blog.domain.notification.dto;

import com.doro.blog.domain.notification.entity.Notification;
import com.doro.blog.domain.notification.entity.NotificationType;

import java.time.Instant;
import java.util.UUID;

public class NotificationDtos {

    public record SenderDto(
            UUID id,
            String username,
            String nickname,
            String profileImageUrl
    ) {}

    public record NotificationResponse(
            UUID id,
            NotificationType type,
            SenderDto sender,
            UUID targetPostId,
            String targetPostTitle,
            String targetPostSlug,
            String targetUsername,
            String message,
            boolean isRead,
            Instant createdAt
    ) {
        public static NotificationResponse from(Notification n) {
            SenderDto senderDto = null;
            if (n.getSender() != null) {
                senderDto = new SenderDto(
                        n.getSender().getId(),
                        n.getSender().getUsername(),
                        n.getSender().getNickname(),
                        n.getSender().getProfileImageUrl()
                );
            }
            return new NotificationResponse(
                    n.getId(),
                    n.getType(),
                    senderDto,
                    n.getTargetPostId(),
                    n.getTargetPostTitle(),
                    n.getTargetPostSlug(),
                    n.getTargetUsername(),
                    n.getMessage(),
                    n.isRead(),
                    n.getCreatedAt()
            );
        }
    }

    public record UnreadCountResponse(
            long unreadCount
    ) {}
}

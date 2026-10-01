package com.doro.blog.domain.notification.entity;

import com.doro.blog.domain.user.entity.BlogUser;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
    name = "notifications",
    indexes = {
        @Index(name = "idx_notifications_recipient_created", columnList = "recipient_id, created_at DESC"),
        @Index(name = "idx_notifications_recipient_unread", columnList = "recipient_id, is_read")
    }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_id", nullable = false)
    private BlogUser recipient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private BlogUser sender;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NotificationType type;

    @Column(name = "target_post_id")
    private UUID targetPostId;

    @Column(name = "target_post_title", length = 255)
    private String targetPostTitle;

    @Column(name = "target_post_slug", length = 255)
    private String targetPostSlug;

    @Column(name = "target_username", length = 100)
    private String targetUsername;

    @Column(name = "message", length = 500)
    private String message;

    @Column(name = "is_read", nullable = false)
    @Builder.Default
    private boolean isRead = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public void markAsRead() {
        this.isRead = true;
    }
}

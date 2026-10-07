package com.doro.blog.domain.notification.repository;

import com.doro.blog.domain.notification.entity.Notification;
import com.doro.blog.domain.notification.entity.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    @EntityGraph(attributePaths = {"sender"})
    Page<Notification> findByRecipientIdOrderByCreatedAtDesc(UUID recipientId, Pageable pageable);

    long countByRecipientIdAndIsReadFalse(UUID recipientId);

    Optional<Notification> findByIdAndRecipientId(UUID id, UUID recipientId);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.recipient.id = :recipientId AND n.isRead = false")
    void markAllAsRead(@Param("recipientId") UUID recipientId);

    void deleteByIdAndRecipientId(UUID id, UUID recipientId);

    boolean existsByRecipientIdAndSenderIdAndTypeAndTargetPostIdAndCreatedAtAfter(
            UUID recipientId, UUID senderId, NotificationType type, UUID targetPostId, Instant after);

    boolean existsByRecipientIdAndSenderIdAndTypeAndTargetPostIdIsNullAndCreatedAtAfter(
            UUID recipientId, UUID senderId, NotificationType type, Instant after);

    /** 탈퇴 익명화: 본인에게 온 알림함을 비운다. */
    @Modifying
    @Query("DELETE FROM Notification n WHERE n.recipient.id = :recipientId")
    int deleteAllByRecipientId(@Param("recipientId") UUID recipientId);

    /** 사용자명이 바뀌어도 다른 사람 알림의 글 링크가 깨지지 않게 비정규화된 사용자명을 함께 바꾼다. */
    @Modifying
    @Query("UPDATE Notification n SET n.targetUsername = :newUsername WHERE n.targetUsername = :oldUsername")
    int renameTargetUsername(@Param("oldUsername") String oldUsername, @Param("newUsername") String newUsername);
}

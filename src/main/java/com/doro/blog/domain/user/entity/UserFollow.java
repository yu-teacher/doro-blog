package com.doro.blog.domain.user.entity;
 
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "user_follows",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_follows", columnNames = {"follower_id", "following_id"})
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class UserFollow {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "follower_id", nullable = false)
    private UUID followerId;

    @Column(name = "following_id", nullable = false)
    private UUID followingId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

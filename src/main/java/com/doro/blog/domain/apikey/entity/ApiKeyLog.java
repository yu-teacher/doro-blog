package com.doro.blog.domain.apikey.entity;

import com.doro.blog.domain.user.entity.BlogUser;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "api_key_logs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class ApiKeyLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "api_key_id")
    private UUID apiKeyId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private BlogUser user;

    @Column(name = "method", nullable = false, length = 10)
    private String method;

    @Column(name = "endpoint", nullable = false, length = 255)
    private String endpoint;

    @Column(name = "status_code", nullable = false)
    private int statusCode;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "user_agent", length = 255)
    private String userAgent;

    @Column(name = "duration_ms", nullable = false)
    @Builder.Default
    private long durationMs = 0L;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

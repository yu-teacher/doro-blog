package com.doro.blog.domain.apikey.dto;

import com.doro.blog.domain.apikey.entity.ApiKey;
import com.doro.blog.domain.apikey.entity.ApiKeyLog;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public class ApiKeyDtos {

    public record CreateApiKeyRequest(
            @NotBlank(message = "API 키 이름은 필수입니다.")
            @Size(max = 50, message = "API 키 이름은 최대 50자까지 입력 가능합니다.")
            String name,

            Integer expireDays // null이면 무기한
    ) {}

    public record CreateApiKeyResponse(
            UUID id,
            String name,
            String apiKey, // 원본 시크릿 키 (생성 시 1회만 제공)
            String keyPrefix,
            Instant expiresAt,
            Instant createdAt
    ) {}

    public record ApiKeyResponse(
            UUID id,
            String name,
            String keyPrefix,
            Instant expiresAt,
            Instant lastUsedAt,
            boolean isActive,
            boolean isExpired,
            Instant createdAt
    ) {
        public static ApiKeyResponse from(ApiKey apiKey) {
            return new ApiKeyResponse(
                    apiKey.getId(),
                    apiKey.getName(),
                    apiKey.getKeyPrefix(),
                    apiKey.getExpiresAt(),
                    apiKey.getLastUsedAt(),
                    apiKey.isActive(),
                    apiKey.isExpired(),
                    apiKey.getCreatedAt()
            );
        }
    }

    public record ApiKeyLogResponse(
            UUID id,
            UUID apiKeyId,
            String method,
            String endpoint,
            int statusCode,
            String ipAddress,
            String userAgent,
            long durationMs,
            String errorMessage,
            Instant createdAt
    ) {
        public static ApiKeyLogResponse from(ApiKeyLog log) {
            return new ApiKeyLogResponse(
                    log.getId(),
                    log.getApiKeyId(),
                    log.getMethod(),
                    log.getEndpoint(),
                    log.getStatusCode(),
                    log.getIpAddress(),
                    log.getUserAgent(),
                    log.getDurationMs(),
                    log.getErrorMessage(),
                    log.getCreatedAt()
            );
        }
    }
}

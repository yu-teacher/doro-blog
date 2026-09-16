package com.doro.blog.domain.apikey.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.apikey.dto.ApiKeyDtos.*;
import com.doro.blog.domain.apikey.entity.ApiKey;
import com.doro.blog.domain.apikey.entity.ApiKeyLog;
import com.doro.blog.domain.apikey.repository.ApiKeyLogRepository;
import com.doro.blog.domain.apikey.repository.ApiKeyRepository;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.service.BlogUserService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApiKeyService {

    private final ApiKeyRepository apiKeyRepository;
    private final ApiKeyLogRepository apiKeyLogRepository;
    private final BlogUserService blogUserService;

    private static final String KEY_PREFIX = "doro_live_";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Transactional
    public CreateApiKeyResponse createApiKey(DoroUser doroUser, CreateApiKeyRequest request) {
        if (!doroUser.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }

        BlogUser user = blogUserService.getOrCreateUser(doroUser);

        // 1. Generate cryptographically secure random token
        byte[] randomBytes = new byte[24];
        SECURE_RANDOM.nextBytes(randomBytes);
        String randomHex = HexFormat.of().formatHex(randomBytes);
        String rawApiKey = KEY_PREFIX + randomHex;

        // 2. Hash token with SHA-256 for secure DB storage
        String keyHash = hashKey(rawApiKey);
        String displayPrefix = rawApiKey.substring(0, Math.min(14, rawApiKey.length())) + "...";

        // 3. Expiration calculation
        Instant expiresAt = null;
        if (request.expireDays() != null && request.expireDays() > 0) {
            expiresAt = Instant.now().plus(Duration.ofDays(request.expireDays()));
        }

        ApiKey apiKey = ApiKey.builder()
                .user(user)
                .name(request.name().trim())
                .keyPrefix(displayPrefix)
                .keyHash(keyHash)
                .expiresAt(expiresAt)
                .isActive(true)
                .build();

        ApiKey saved = apiKeyRepository.saveAndFlush(apiKey);
        log.info("API Key issued: id={}, userId={}, name={}, prefix={}", saved.getId(), user.getId(), saved.getName(), displayPrefix);

        return new CreateApiKeyResponse(
                saved.getId(),
                saved.getName(),
                rawApiKey, // 원본 키는 이때 1회만 제공
                saved.getKeyPrefix(),
                saved.getExpiresAt(),
                saved.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public List<ApiKeyResponse> getMyApiKeys(DoroUser doroUser) {
        if (!doroUser.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }
        return apiKeyRepository.findAllByUserIdOrderByCreatedAtDesc(doroUser.userId())
                .stream()
                .map(ApiKeyResponse::from)
                .toList();
    }

    @Transactional
    public void revokeApiKey(DoroUser doroUser, UUID apiKeyId) {
        if (!doroUser.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }
        ApiKey apiKey = apiKeyRepository.findByIdAndUserId(apiKeyId, doroUser.userId())
                .orElseThrow(() -> new BlogException(ErrorCode.API_KEY_NOT_FOUND));

        apiKeyRepository.delete(apiKey);
        log.info("API Key revoked: id={}, userId={}", apiKeyId, doroUser.userId());
    }

    @Transactional
    public Optional<ApiKey> validateAndUseApiKey(String rawApiKey) {
        if (rawApiKey == null || rawApiKey.isBlank()) {
            return Optional.empty();
        }
        String keyHash = hashKey(rawApiKey.trim());
        Optional<ApiKey> opt = apiKeyRepository.findByKeyHashWithUser(keyHash);
        if (opt.isPresent()) {
            ApiKey key = opt.get();
            if (key.isValid()) {
                key.updateLastUsed();
                return Optional.of(key);
            }
        }
        return Optional.empty();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordLog(
            UUID apiKeyId,
            BlogUser user,
            String method,
            String endpoint,
            int statusCode,
            String ipAddress,
            String userAgent,
            long durationMs,
            String errorMessage
    ) {
        try {
            ApiKeyLog apiKeyLog = ApiKeyLog.builder()
                    .apiKeyId(apiKeyId)
                    .user(user)
                    .method(method)
                    .endpoint(endpoint)
                    .statusCode(statusCode)
                    .ipAddress(ipAddress)
                    .userAgent(userAgent)
                    .durationMs(durationMs)
                    .errorMessage(errorMessage != null && errorMessage.length() > 500 ? errorMessage.substring(0, 500) : errorMessage)
                    .build();

            apiKeyLogRepository.save(apiKeyLog);
        } catch (Exception e) {
            log.warn("Failed to record api key log: {}", e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public Page<ApiKeyLogResponse> getMyLogs(DoroUser doroUser, int page, int size) {
        if (!doroUser.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }
        Pageable pageable = PageRequest.of(page, size);
        return apiKeyLogRepository.findAllByUserIdOrderByCreatedAtDesc(doroUser.userId(), pageable)
                .map(ApiKeyLogResponse::from);
    }

    public static String hashKey(String rawKey) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedhash = digest.digest(rawKey.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(encodedhash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }
}

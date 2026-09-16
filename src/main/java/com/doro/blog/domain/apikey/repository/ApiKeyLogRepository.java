package com.doro.blog.domain.apikey.repository;

import com.doro.blog.domain.apikey.entity.ApiKeyLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ApiKeyLogRepository extends JpaRepository<ApiKeyLog, UUID> {

    Page<ApiKeyLog> findAllByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Page<ApiKeyLog> findAllByApiKeyIdOrderByCreatedAtDesc(UUID apiKeyId, Pageable pageable);
}

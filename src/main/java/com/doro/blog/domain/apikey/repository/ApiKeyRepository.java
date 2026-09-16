package com.doro.blog.domain.apikey.repository;

import com.doro.blog.domain.apikey.entity.ApiKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApiKeyRepository extends JpaRepository<ApiKey, UUID> {

    @Query("SELECT k FROM ApiKey k JOIN FETCH k.user WHERE k.keyHash = :keyHash")
    Optional<ApiKey> findByKeyHashWithUser(@Param("keyHash") String keyHash);

    Optional<ApiKey> findByKeyHash(String keyHash);

    List<ApiKey> findAllByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<ApiKey> findByIdAndUserId(UUID id, UUID userId);
}

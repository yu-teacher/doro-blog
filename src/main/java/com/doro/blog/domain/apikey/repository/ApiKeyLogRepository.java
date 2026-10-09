package com.doro.blog.domain.apikey.repository;

import com.doro.blog.domain.apikey.entity.ApiKeyLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface ApiKeyLogRepository extends JpaRepository<ApiKeyLog, UUID> {

    Page<ApiKeyLog> findAllByUserIdOrderByCreatedAtDescIdDesc(UUID userId, Pageable pageable);

    Page<ApiKeyLog> findAllByApiKeyIdOrderByCreatedAtDesc(UUID apiKeyId, Pageable pageable);

    /** 보존 기간이 지난 호출 기록을 지운다. */
    @Modifying
    @Query("DELETE FROM ApiKeyLog l WHERE l.createdAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") java.time.Instant cutoff);

    /** 탈퇴 익명화: IP·User-Agent 가 담긴 호출 기록을 삭제한다. */
    @Modifying
    @Query("DELETE FROM ApiKeyLog l WHERE l.user.id = :userId")
    int deleteAllByUserId(@Param("userId") UUID userId);
}

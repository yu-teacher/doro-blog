package com.doro.blog.domain.apikey.repository;

import com.doro.blog.domain.apikey.entity.ApiKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApiKeyRepository extends JpaRepository<ApiKey, UUID> {

    @Query("SELECT k FROM ApiKey k JOIN FETCH k.user WHERE k.keyHash = :keyHash")
    Optional<ApiKey> findByKeyHashWithUser(@Param("keyHash") String keyHash);

    Optional<ApiKey> findByKeyHash(String keyHash);

    List<ApiKey> findAllByUserIdOrderByCreatedAtDescIdDesc(UUID userId);

    Optional<ApiKey> findByIdAndUserId(UUID id, UUID userId);

    /** 탈퇴 익명화: 사용자의 모든 API 키를 삭제한다. 삭제된 키로는 더 이상 인증되지 않는다. */
    @Modifying
    @Query("DELETE FROM ApiKey k WHERE k.user.id = :userId")
    int deleteAllByUserId(@Param("userId") UUID userId);
}

package com.doro.blog.domain.auth.repository;

import com.doro.blog.domain.auth.entity.AuthSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface AuthSessionRepository extends JpaRepository<AuthSession, UUID> {

    Optional<AuthSession> findBySessionHash(String sessionHash);

    @Modifying
    @Query("DELETE FROM AuthSession s WHERE s.sessionHash = :hash")
    int deleteBySessionHash(@Param("hash") String hash);

    @Modifying
    @Query("DELETE FROM AuthSession s WHERE s.expiresAt <= :now")
    int deleteExpired(@Param("now") Instant now);

    /** 탈퇴 익명화: 사용자의 모든 BFF 세션(암호화된 토큰 포함)을 삭제한다. */
    @Modifying
    @Query("DELETE FROM AuthSession s WHERE s.userId = :userId")
    int deleteAllByUserId(@Param("userId") UUID userId);
}

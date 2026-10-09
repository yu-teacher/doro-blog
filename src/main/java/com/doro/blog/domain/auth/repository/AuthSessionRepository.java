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

    /**
     * 마지막 사용 시각만 바꾼다. 요청 처리 초반에 읽어 둔 세션 엔티티를 통째로 저장하면, 그사이 다른 요청이 갱신해 둔 토큰을
     * 옛 값으로 되돌려 쓰고(이미 폐기된 리프레시 토큰이 돌아와 세션이 끊긴다) 말기 때문에 이 한 컬럼만 갱신한다.
     */
    @Modifying
    @Query("UPDATE AuthSession s SET s.lastUsedAt = :now WHERE s.sessionHash = :hash")
    int touchLastUsed(@Param("hash") String hash, @Param("now") Instant now);

    @Modifying
    @Query("DELETE FROM AuthSession s WHERE s.expiresAt <= :now")
    int deleteExpired(@Param("now") Instant now);

    /** 탈퇴 익명화: 사용자의 모든 BFF 세션(암호화된 토큰 포함)을 삭제한다. */
    @Modifying
    @Query("DELETE FROM AuthSession s WHERE s.userId = :userId")
    int deleteAllByUserId(@Param("userId") UUID userId);
}

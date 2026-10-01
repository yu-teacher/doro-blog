package com.doro.blog.domain.user.repository;

import com.doro.blog.domain.user.entity.UserFollow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserFollowRepository extends JpaRepository<UserFollow, UUID> {

    boolean existsByFollowerIdAndFollowingId(UUID followerId, UUID followingId);

    /** 팔로우를 지우고 지워진 행 수를 돌려준다. 동시에 두 번 요청해도 한 번만 1 이 된다. */
    @Modifying
    @Query("delete from UserFollow f where f.followerId = :followerId and f.followingId = :followingId")
    int deleteFollow(@Param("followerId") UUID followerId, @Param("followingId") UUID followingId);

    /** 이미 팔로우 중이면 아무것도 하지 않고 0 을 돌려준다 (uk_user_follows 충돌로 트랜잭션이 깨지지 않는다). */
    @Modifying
    @Query(value = "insert into user_follows (id, follower_id, following_id, created_at) "
            + "values (:id, :followerId, :followingId, now()) on conflict on constraint uk_user_follows do nothing",
            nativeQuery = true)
    int insertFollowIfAbsent(@Param("id") UUID id, @Param("followerId") UUID followerId, @Param("followingId") UUID followingId);

    void deleteByFollowerIdAndFollowingId(UUID followerId, UUID followingId);

    Page<UserFollow> findByFollowingIdOrderByCreatedAtDesc(UUID followingId, Pageable pageable);

    Page<UserFollow> findByFollowerIdOrderByCreatedAtDesc(UUID followerId, Pageable pageable);

    List<UserFollow> findByFollowerIdAndFollowingIdIn(UUID followerId, Collection<UUID> followingIds);
}

package com.doro.blog.domain.user.repository;

import com.doro.blog.domain.user.entity.UserFollow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface UserFollowRepository extends JpaRepository<UserFollow, UUID> {

    boolean existsByFollowerIdAndFollowingId(UUID followerId, UUID followingId);

    void deleteByFollowerIdAndFollowingId(UUID followerId, UUID followingId);

    Page<UserFollow> findByFollowingIdOrderByCreatedAtDesc(UUID followingId, Pageable pageable);

    Page<UserFollow> findByFollowerIdOrderByCreatedAtDesc(UUID followerId, Pageable pageable);

    List<UserFollow> findByFollowerIdAndFollowingIdIn(UUID followerId, Collection<UUID> followingIds);
}

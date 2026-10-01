package com.doro.blog.domain.like.repository;

import com.doro.blog.domain.like.entity.PostLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface PostLikeRepository extends JpaRepository<PostLike, UUID> {
    Optional<PostLike> findByPostIdAndUserId(UUID postId, UUID userId);
    boolean existsByPostIdAndUserId(UUID postId, UUID userId);
    void deleteByPostIdAndUserId(UUID postId, UUID userId);

    /** 좋아요를 삭제하고 지워진 행 수를 돌려준다. 동시에 두 번 눌러도 한 번만 1 이 된다. */
    @Modifying
    @Query("delete from PostLike l where l.post.id = :postId and l.user.id = :userId")
    int deleteLike(@Param("postId") UUID postId, @Param("userId") UUID userId);

    /** 이미 있으면 아무것도 하지 않고 0 을 돌려준다 (uk_post_likes 충돌로 트랜잭션이 깨지지 않는다). */
    @Modifying
    @Query(value = "insert into post_likes (id, post_id, user_id, created_at) "
            + "values (:id, :postId, :userId, now()) on conflict on constraint uk_post_likes do nothing",
            nativeQuery = true)
    int insertLikeIfAbsent(@Param("id") UUID id, @Param("postId") UUID postId, @Param("userId") UUID userId);
}

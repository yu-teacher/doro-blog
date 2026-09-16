package com.doro.blog.domain.post.repository;

import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.entity.PostStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PostRepository extends JpaRepository<Post, UUID> {

    Optional<Post> findByUserIdAndSlug(UUID userId, String slug);

    boolean existsByUserIdAndSlug(UUID userId, String slug);

    Page<Post> findAllByStatusOrderByPublishedAtDesc(PostStatus status, Pageable pageable);

    Page<Post> findAllByStatusOrderByLikeCountDesc(PostStatus status, Pageable pageable);

    Page<Post> findAllByUserIdAndStatusOrderByPublishedAtDesc(UUID userId, PostStatus status, Pageable pageable);

    Page<Post> findAllByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, PostStatus status, Pageable pageable);

    Page<Post> findAllByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    @Query("SELECT p FROM Post p WHERE p.user.id = :userId AND p.status = 'PUBLISHED' " +
           "AND (LOWER(p.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(p.summary) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(p.content) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "ORDER BY p.publishedAt DESC")
    Page<Post> searchUserPostsByKeyword(
            @Param("userId") UUID userId,
            @Param("keyword") String keyword,
            Pageable pageable
    );

    @Query("SELECT p FROM Post p JOIN PostTag pt ON pt.post.id = p.id WHERE p.user.id = :userId AND p.status = 'PUBLISHED' AND LOWER(pt.tag.name) = LOWER(:tag) ORDER BY p.publishedAt DESC")
    Page<Post> findUserPostsByTag(
            @Param("userId") UUID userId,
            @Param("tag") String tag,
            Pageable pageable
    );

    @Query("SELECT p FROM Post p JOIN PostTag pt ON pt.post.id = p.id WHERE p.user.id = :userId AND p.status = 'PUBLISHED' AND LOWER(pt.tag.name) = LOWER(:tag) " +
           "AND (LOWER(p.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(p.summary) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(p.content) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "ORDER BY p.publishedAt DESC")
    Page<Post> searchUserPostsByKeywordAndTag(
            @Param("userId") UUID userId,
            @Param("keyword") String keyword,
            @Param("tag") String tag,
            Pageable pageable
    );

    List<Post> findAllBySeriesIdOrderBySeriesOrderAsc(UUID seriesId);

    @Query("SELECT p FROM Post p JOIN PostTag pt ON pt.post.id = p.id WHERE pt.tag.name = :tagName AND p.status = 'PUBLISHED' ORDER BY p.publishedAt DESC")
    Page<Post> findAllByTagName(@Param("tagName") String tagName, Pageable pageable);

    @Query("SELECT p FROM Post p WHERE p.status = 'PUBLISHED' AND p.publishedAt >= :since ORDER BY p.likeCount DESC, p.viewCount DESC, p.publishedAt DESC")
    Page<Post> findTrendingPosts(
            @Param("since") java.time.Instant since,
            Pageable pageable
    );

    @Query("SELECT p FROM Post p WHERE p.status = 'PUBLISHED' AND (LOWER(p.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(p.summary) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(p.content) LIKE LOWER(CONCAT('%', :keyword, '%'))) ORDER BY p.publishedAt DESC")
    Page<Post> searchPublishedPosts(
            @Param("keyword") String keyword,
            Pageable pageable
    );

    @Query("SELECT pl.post FROM PostLike pl WHERE pl.user.id = :userId AND pl.post.status = 'PUBLISHED' ORDER BY pl.createdAt DESC")
    Page<Post> findLikedPostsByUserId(
            @Param("userId") UUID userId,
            Pageable pageable
    );

    long countByUserIdAndStatus(UUID userId, PostStatus status);

    @Query("SELECT pt.tag.name AS name, COUNT(p.id) AS postCount " +
           "FROM Post p JOIN PostTag pt ON pt.post.id = p.id " +
           "WHERE p.user.id = :userId AND p.status = 'PUBLISHED' " +
           "GROUP BY pt.tag.name " +
           "ORDER BY COUNT(p.id) DESC, pt.tag.name ASC")
    List<Object[]> countTagsByUserId(@Param("userId") UUID userId);

    @Query("SELECT FUNCTION('TO_CHAR', p.publishedAt, 'YYYY-MM-DD') AS postDate, COUNT(p.id) AS postCount " +
           "FROM Post p " +
           "WHERE p.user.id = :userId AND p.status = 'PUBLISHED' AND p.publishedAt >= :since " +
           "GROUP BY FUNCTION('TO_CHAR', p.publishedAt, 'YYYY-MM-DD') " +
           "ORDER BY postDate ASC")
    List<Object[]> countDailyPostsByUserIdSince(@Param("userId") UUID userId, @Param("since") java.time.Instant since);

    @Query("SELECT p FROM Post p WHERE p.status = 'PUBLISHED' AND p.user.id IN (" +
           "  SELECT uf.followingId FROM com.doro.blog.domain.user.entity.UserFollow uf WHERE uf.followerId = :userId" +
           ") ORDER BY p.publishedAt DESC")
    Page<Post> findFollowingPosts(@Param("userId") UUID userId, Pageable pageable);

    @Query("SELECT DISTINCT p FROM Post p JOIN PostTag pt ON pt.post.id = p.id " +
           "WHERE p.id != :postId AND p.status = 'PUBLISHED' AND LOWER(pt.tag.name) IN :tagNames " +
           "ORDER BY p.likeCount DESC, p.viewCount DESC, p.publishedAt DESC")
    List<Post> findRelatedPostsByTags(
            @Param("postId") UUID postId,
            @Param("tagNames") List<String> tagNames,
            Pageable pageable
    );

    @Query("SELECT p FROM Post p WHERE p.user.id = :authorId AND p.status = 'PUBLISHED' AND p.id NOT IN :excludeIds " +
           "ORDER BY p.publishedAt DESC")
    List<Post> findOtherPostsByAuthor(
            @Param("authorId") UUID authorId,
            @Param("excludeIds") List<UUID> excludeIds,
            Pageable pageable
    );

    @Query("SELECT p FROM Post p WHERE p.status = 'PUBLISHED' AND p.id NOT IN :excludeIds " +
           "ORDER BY p.likeCount DESC, p.viewCount DESC, p.publishedAt DESC")
    List<Post> findTrendingPostsExcluding(
            @Param("excludeIds") List<UUID> excludeIds,
            Pageable pageable
    );
}



package com.doro.blog.domain.post.repository;

import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.entity.PostStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PostRepository extends JpaRepository<Post, UUID> {

    /** 다른 글의 본문이나 썸네일이 이 업로드 키를 가리키는지. (글 삭제 때 공유 중인 이미지를 지우지 않기 위함) */
    @Query("SELECT COUNT(p) > 0 FROM Post p WHERE p.id <> :excludedId "
            + "AND (p.content LIKE CONCAT('%', :key, '%') OR p.thumbnailUrl LIKE CONCAT('%', :key, '%'))")
    boolean existsOtherPostReferencing(@Param("excludedId") UUID excludedId, @Param("key") String key);

    /** 시리즈를 지울 때 소속 글의 연결을 한 번의 UPDATE 로 풀어 준다 (글을 전부 읽어 하나씩 고치지 않는다). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Post p set p.series = null, p.seriesOrder = null where p.series.id = :seriesId")
    int detachFromSeries(@Param("seriesId") UUID seriesId);

    /** 시리즈 안에서 다음에 쓸 회차 번호. 글을 빼서 생긴 빈 번호나 글 수와 상관없이 항상 마지막 다음이다. */
    @Query("select coalesce(max(p.seriesOrder), 0) + 1 from Post p where p.series.id = :seriesId")
    int nextSeriesOrder(@Param("seriesId") UUID seriesId);

    @Modifying
    @Query("update Post p set p.viewCount = p.viewCount + 1 where p.id = :id")
    int incrementViewCount(@Param("id") UUID id);

    @Modifying
    @Query("update Post p set p.likeCount = p.likeCount + 1 where p.id = :id")
    int incrementLikeCount(@Param("id") UUID id);

    @Modifying
    @Query("update Post p set p.likeCount = case when p.likeCount > 0 then p.likeCount - 1 else 0 end where p.id = :id")
    int decrementLikeCount(@Param("id") UUID id);

    @Modifying
    @Query("update Post p set p.commentCount = p.commentCount + 1 where p.id = :id")
    int incrementCommentCount(@Param("id") UUID id);

    @Modifying
    @Query("update Post p set p.commentCount = case when p.commentCount > 0 then p.commentCount - 1 else 0 end where p.id = :id")
    int decrementCommentCount(@Param("id") UUID id);

    Optional<Post> findByUserIdAndSlug(UUID userId, String slug);

    boolean existsByUserIdAndSlug(UUID userId, String slug);

    boolean existsByUserIdAndSlugAndIdNot(UUID userId, String slug, UUID id);

    Page<Post> findAllByStatusOrderByPublishedAtDesc(PostStatus status, Pageable pageable);

    Page<Post> findAllByStatusOrderByLikeCountDesc(PostStatus status, Pageable pageable);

    Page<Post> findAllByUserIdAndStatusOrderByPublishedAtDesc(UUID userId, PostStatus status, Pageable pageable);

    Page<Post> findAllByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, PostStatus status, Pageable pageable);

    Page<Post> findAllByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    @Query("SELECT p FROM Post p WHERE p.user.id = :userId AND p.status = 'PUBLISHED' " +
           "AND (LOWER(p.title) LIKE :pattern ESCAPE '!' OR LOWER(p.summary) LIKE :pattern ESCAPE '!' OR LOWER(p.content) LIKE :pattern ESCAPE '!') " +
           "ORDER BY p.publishedAt DESC")
    Page<Post> searchUserPostsByKeyword(
            @Param("userId") UUID userId,
            @Param("pattern") String pattern,
            Pageable pageable
    );

    @Query("SELECT p FROM Post p JOIN PostTag pt ON pt.post.id = p.id WHERE p.user.id = :userId AND p.status = 'PUBLISHED' AND LOWER(pt.tag.name) = LOWER(:tag) ORDER BY p.publishedAt DESC")
    Page<Post> findUserPostsByTag(
            @Param("userId") UUID userId,
            @Param("tag") String tag,
            Pageable pageable
    );

    @Query("SELECT p FROM Post p JOIN PostTag pt ON pt.post.id = p.id WHERE p.user.id = :userId AND p.status = 'PUBLISHED' AND LOWER(pt.tag.name) = LOWER(:tag) " +
           "AND (LOWER(p.title) LIKE :pattern ESCAPE '!' OR LOWER(p.summary) LIKE :pattern ESCAPE '!' OR LOWER(p.content) LIKE :pattern ESCAPE '!') " +
           "ORDER BY p.publishedAt DESC")
    Page<Post> searchUserPostsByKeywordAndTag(
            @Param("userId") UUID userId,
            @Param("pattern") String pattern,
            @Param("tag") String tag,
            Pageable pageable
    );

    List<Post> findAllBySeriesIdOrderBySeriesOrderAsc(UUID seriesId);

    List<Post> findAllBySeriesIdAndStatusOrderBySeriesOrderAsc(UUID seriesId, PostStatus status);

    long countBySeriesIdAndStatus(UUID seriesId, PostStatus status);

    @Query("SELECT p FROM Post p JOIN PostTag pt ON pt.post.id = p.id WHERE LOWER(pt.tag.name) = LOWER(:tagName) AND p.status = 'PUBLISHED' ORDER BY p.publishedAt DESC")
    Page<Post> findAllByTagName(@Param("tagName") String tagName, Pageable pageable);

    @Query("SELECT p FROM Post p JOIN PostTag pt ON pt.post.id = p.id " +
           "WHERE LOWER(pt.tag.name) IN :tagNames AND p.status = 'PUBLISHED' " +
           "GROUP BY p.id " +
           "HAVING COUNT(DISTINCT LOWER(pt.tag.name)) = :tagCount " +
           "ORDER BY p.publishedAt DESC")
    Page<Post> findAllByAllTagNames(
            @Param("tagNames") List<String> tagNames,
            @Param("tagCount") long tagCount,
            Pageable pageable
    );

    @Query("SELECT p FROM Post p WHERE p.status = 'PUBLISHED' AND p.publishedAt >= :since ORDER BY p.likeCount DESC, p.viewCount DESC, p.publishedAt DESC")
    Page<Post> findTrendingPosts(
            @Param("since") java.time.Instant since,
            Pageable pageable
    );

    @Query("SELECT p FROM Post p WHERE p.status = 'PUBLISHED' AND (LOWER(p.title) LIKE :pattern ESCAPE '!' OR LOWER(p.summary) LIKE :pattern ESCAPE '!' OR LOWER(p.content) LIKE :pattern ESCAPE '!') ORDER BY p.publishedAt DESC")
    Page<Post> searchPublishedPosts(
            @Param("pattern") String pattern,
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



package com.doro.blog.domain.tag.repository;

import com.doro.blog.domain.tag.entity.PostTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PostTagRepository extends JpaRepository<PostTag, UUID> {
    @Query("SELECT pt FROM PostTag pt JOIN FETCH pt.tag WHERE pt.post.id = :postId")
    List<PostTag> findAllByPostIdWithTag(@Param("postId") UUID postId);

    /** 여러 글의 태그를 한 번에 조회한다 (목록 화면에서 글마다 쿼리를 날리지 않기 위함). */
    @Query("SELECT pt FROM PostTag pt JOIN FETCH pt.tag WHERE pt.post.id IN :postIds ORDER BY pt.tag.name")
    List<PostTag> findAllByPostIdsWithTag(@Param("postIds") Collection<UUID> postIds);

    /**
     * 글의 태그 연결을 즉시 지운다. 파생 삭제(deleteAllBy...)는 엔티티 삭제가 flush 까지 미뤄지고 Hibernate 가 INSERT 를
     * DELETE 보다 먼저 실행하므로, 같은 (글, 태그)를 바로 다시 연결하면 unique 위반이 난다.
     */
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM PostTag pt WHERE pt.post.id = :postId")
    void deleteAllByPostId(@Param("postId") UUID postId);
}

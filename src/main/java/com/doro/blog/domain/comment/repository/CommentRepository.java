package com.doro.blog.domain.comment.repository;

import com.doro.blog.domain.comment.entity.Comment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CommentRepository extends JpaRepository<Comment, UUID> {

    @Query("SELECT DISTINCT c FROM Comment c LEFT JOIN FETCH c.children ch LEFT JOIN FETCH c.user LEFT JOIN FETCH ch.user WHERE c.post.id = :postId AND c.parent IS NULL ORDER BY c.createdAt ASC")
    List<Comment> findRootCommentsWithChildren(@Param("postId") UUID postId);

    long countByPostIdAndIsDeletedFalse(UUID postId);

    /** 이 글 말고 다른 글의 댓글 본문이 key 를 담고 있는가. 지우는 글의 댓글은 글과 함께 사라지므로 뺀다. */
    boolean existsByContentContainingAndPostIdNot(String key, UUID postId);

    /** 삭제 처리를 직렬화하려고 행을 잠그고 읽는다. 동시에 같은 댓글을 지우는 요청이 서로의 결과를 보고 판단하게 한다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Comment c WHERE c.id = :id")
    Optional<Comment> findByIdForUpdate(@Param("id") UUID id);
}

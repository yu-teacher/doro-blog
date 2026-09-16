package com.doro.blog.domain.comment.repository;

import com.doro.blog.domain.comment.entity.Comment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CommentRepository extends JpaRepository<Comment, UUID> {

    @Query("SELECT DISTINCT c FROM Comment c LEFT JOIN FETCH c.children ch LEFT JOIN FETCH c.user LEFT JOIN FETCH ch.user WHERE c.post.id = :postId AND c.parent IS NULL ORDER BY c.createdAt ASC")
    List<Comment> findRootCommentsWithChildren(@Param("postId") UUID postId);

    long countByPostIdAndIsDeletedFalse(UUID postId);
}

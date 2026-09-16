package com.doro.blog.domain.tag.repository;

import com.doro.blog.domain.tag.entity.PostTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PostTagRepository extends JpaRepository<PostTag, UUID> {
    @Query("SELECT pt FROM PostTag pt JOIN FETCH pt.tag WHERE pt.post.id = :postId")
    List<PostTag> findAllByPostIdWithTag(@Param("postId") UUID postId);

    void deleteAllByPostId(UUID postId);
}

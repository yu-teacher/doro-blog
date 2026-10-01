package com.doro.blog.domain.post.service;

import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.repository.PostRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 글의 조회수/좋아요/댓글 수를 DB 에서 원자적으로(`SET x = x + 1`) 갱신한다.
 * 엔티티 필드를 읽어 +1 한 뒤 저장하면 동시 요청에서 갱신이 유실되기 때문이다.
 * 갱신 후 같은 트랜잭션의 엔티티를 새로고침해 응답에 최신 값이 담기게 한다.
 */
@Component
@RequiredArgsConstructor
public class PostCounterService {

    private final PostRepository postRepository;
    private final EntityManager entityManager;

    @Transactional(propagation = Propagation.MANDATORY)
    public void incrementView(Post post) {
        apply(post, postRepository.incrementViewCount(post.getId()));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void incrementLike(Post post) {
        apply(post, postRepository.incrementLikeCount(post.getId()));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void decrementLike(Post post) {
        apply(post, postRepository.decrementLikeCount(post.getId()));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void incrementComment(Post post) {
        apply(post, postRepository.incrementCommentCount(post.getId()));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void decrementComment(Post post) {
        apply(post, postRepository.decrementCommentCount(post.getId()));
    }

    private void apply(Post post, int updatedRows) {
        if (updatedRows == 1) {
            entityManager.refresh(post);
        }
    }
}

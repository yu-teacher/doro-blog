package com.doro.blog.domain.like.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.like.entity.PostLike;
import com.doro.blog.domain.like.repository.PostLikeRepository;
import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.service.BlogUserService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PostLikeService {

    private final PostLikeRepository likeRepository;
    private final PostRepository postRepository;
    private final BlogUserService userService;

    @Transactional
    public boolean toggleLike(UUID postId, DoroUser doroUser) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new BlogException(ErrorCode.POST_NOT_FOUND));
        BlogUser user = userService.getOrCreateUser(doroUser);

        Optional<PostLike> existing = likeRepository.findByPostIdAndUserId(postId, user.getId());

        if (existing.isPresent()) {
            likeRepository.delete(existing.get());
            post.decrementLikeCount();
            return false;
        } else {
            PostLike newLike = PostLike.builder()
                    .post(post)
                    .user(user)
                    .build();
            likeRepository.save(newLike);
            post.incrementLikeCount();
            return true;
        }
    }
}

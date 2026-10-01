package com.doro.blog.domain.like.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.like.entity.PostLike;
import com.doro.blog.domain.like.repository.PostLikeRepository;
import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.service.BlogUserService;
import com.doro.blog.domain.notification.entity.NotificationType;
import com.doro.blog.domain.notification.service.NotificationService;
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
    private final NotificationService notificationService;

    @Transactional
    public boolean toggleLike(UUID postId, DoroUser doroUser) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new BlogException(ErrorCode.POST_NOT_FOUND));

        if (post.getStatus() != PostStatus.PUBLISHED) {
            throw new BlogException(ErrorCode.ACCESS_DENIED, "발행된 글에만 좋아요를 누를 수 있습니다.");
        }

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

            // 알림 발송: 글 작성자에게 좋아요 알림
            notificationService.sendNotification(
                    post.getUser(),
                    user,
                    NotificationType.LIKE,
                    post,
                    post.getUser().getUsername(),
                    null
            );

            return true;
        }
    }
}

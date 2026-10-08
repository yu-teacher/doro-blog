package com.doro.blog.domain.like.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.like.repository.PostLikeRepository;
import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.post.service.PostAccess;
import com.doro.blog.domain.post.service.PostCounterService;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.service.BlogUserService;
import com.doro.blog.domain.notification.entity.NotificationType;
import com.doro.blog.domain.notification.service.NotificationService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PostLikeService {

    private final PostLikeRepository likeRepository;
    private final PostRepository postRepository;
    private final BlogUserService userService;
    private final NotificationService notificationService;
    private final PostCounterService counterService;
    private final PostAccess postAccess;

    @Transactional
    public boolean toggleLike(UUID postId, DoroUser doroUser) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new BlogException(ErrorCode.POST_NOT_FOUND));

        // 볼 수 없는 글은 없는 글과 똑같이 404, 볼 수 있지만 출간되지 않은 글(작성자 본인)에만 이유를 알려 주는 403
        if (!postAccess.canView(post, doroUser)) {
            throw new BlogException(ErrorCode.POST_NOT_FOUND);
        }
        if (post.getStatus() != PostStatus.PUBLISHED) {
            throw new BlogException(ErrorCode.ACCESS_DENIED, "발행된 글에만 좋아요를 누를 수 있습니다.");
        }

        BlogUser user = userService.getOrCreateUser(doroUser);

        // 존재 확인 후 저장하면 더블클릭 시 둘 다 "없음"으로 보고 중복 삽입(unique 위반, 500)이 난다.
        // 삭제/삽입 결과 행 수로 판단해, 실제로 상태가 바뀐 요청만 카운터를 움직인다.
        if (likeRepository.deleteLike(postId, user.getId()) > 0) {
            counterService.decrementLike(post);
            return false;
        }

        if (likeRepository.insertLikeIfAbsent(UUID.randomUUID(), postId, user.getId()) == 0) {
            // 동시에 들어온 다른 요청이 먼저 좋아요를 만들었다. 결과 상태는 "좋아요됨"이므로 그대로 돌려준다.
            return true;
        }
        counterService.incrementLike(post);

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

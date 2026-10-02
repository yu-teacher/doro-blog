package com.doro.blog.domain.notification;

import com.doro.blog.domain.like.service.PostLikeService;
import com.doro.blog.domain.notification.entity.NotificationType;
import com.doro.blog.domain.notification.service.NotificationService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.user.service.FollowService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** 좋아요/팔로우를 반복해서 눌러도 알림이 계속 쌓이지 않는지 검증한다. */
@SpringBootTest
class NotificationDedupeTest {

    @Autowired private NotificationService notifications;
    @Autowired private PostLikeService likes;
    @Autowired private FollowService follows;
    @Autowired private PostCommandService postCommands;

    private DoroUser newUser(String prefix) {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, prefix + "_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private long countOf(DoroUser recipient, NotificationType type) {
        return notifications.getNotifications(recipient, PageRequest.of(0, 100)).getContent().stream()
                .filter(n -> n.type() == type).count();
    }

    @Test
    @DisplayName("좋아요를 취소했다 다시 눌러도 좋아요 알림은 한 번만 쌓인다")
    void likeToggleDoesNotSpamNotifications() {
        DoroUser author = newUser("dedupeauthor");
        DoroUser liker = newUser("deduper");
        var post = postCommands.createPost(author, new CreatePostRequest("글", null, null, "본문", null, PostStatus.PUBLISHED, null, null));

        likes.toggleLike(post.id(), liker); // 좋아요
        likes.toggleLike(post.id(), liker); // 취소
        likes.toggleLike(post.id(), liker); // 다시 좋아요
        likes.toggleLike(post.id(), liker); // 취소
        likes.toggleLike(post.id(), liker); // 다시 좋아요

        assertThat(countOf(author, NotificationType.LIKE)).isEqualTo(1);
    }

    @Test
    @DisplayName("팔로우를 취소했다 다시 해도 팔로우 알림은 한 번만 쌓인다")
    void followToggleDoesNotSpamNotifications() {
        DoroUser target = newUser("followtarget");
        DoroUser follower = newUser("follower");
        var post = postCommands.createPost(target, new CreatePostRequest("글", null, null, "본문", null, PostStatus.PUBLISHED, null, null));
        String targetName = post.username();

        follows.followUser(follower, targetName);
        follows.unfollowUser(follower, targetName);
        follows.followUser(follower, targetName);
        follows.unfollowUser(follower, targetName);
        follows.followUser(follower, targetName);

        assertThat(countOf(target, NotificationType.FOLLOW)).isEqualTo(1);
    }

    @Test
    @DisplayName("서로 다른 사람의 좋아요 알림은 각각 쌓인다")
    void differentSendersAreNotDeduplicated() {
        DoroUser author = newUser("multiauthor");
        var post = postCommands.createPost(author, new CreatePostRequest("글", null, null, "본문", null, PostStatus.PUBLISHED, null, null));

        likes.toggleLike(post.id(), newUser("likera"));
        likes.toggleLike(post.id(), newUser("likerb"));

        assertThat(countOf(author, NotificationType.LIKE)).isEqualTo(2);
    }
}

package com.doro.blog.domain.user;

import com.doro.blog.domain.comment.dto.CommentDtos.CreateCommentRequest;
import com.doro.blog.domain.comment.dto.CommentDtos.CreateReplyRequest;
import com.doro.blog.domain.comment.service.CommentService;
import com.doro.blog.domain.notification.dto.NotificationDtos.NotificationResponse;
import com.doro.blog.domain.notification.service.NotificationService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.post.service.PostQueryService;
import com.doro.blog.domain.user.service.BlogUserService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** 댓글·알림·사용자 사이의 정합성(이름 변경, 신규 사용자, 댓글 삭제). 감사에서 확정된 버그들의 회귀 테스트이기도 하다. */
@SpringBootTest
class SocialConsistencyTest {

    @Autowired private PostCommandService commands;
    @Autowired private PostQueryService queries;
    @Autowired private CommentService comments;
    @Autowired private NotificationService notifications;
    @Autowired private BlogUserService users;

    private DoroUser newUser(String prefix) {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, prefix + "_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private PostSummaryResponse publishedPost(DoroUser author) {
        return commands.createPost(author, new CreatePostRequest("공개 글", null, "요약", "본문", null, PostStatus.PUBLISHED, null, null));
    }

    @Test
    @DisplayName("사용자명을 바꾸면 이미 받은 알림의 링크도 새 사용자명을 가리킨다")
    void renameUpdatesExistingNotificationLinks() {
        DoroUser author = newUser("renamer");
        DoroUser reader = newUser("reader");
        PostSummaryResponse post = publishedPost(author);
        comments.createRootComment(post.id(), reader, new CreateCommentRequest("댓글입니다"));
        assertThat(notifications.getNotifications(author, PageRequest.of(0, 10)).getContent()).isNotEmpty();

        String renamed = "renamed" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        users.updateUsername(author, renamed);

        List<NotificationResponse> after = notifications.getNotifications(author, PageRequest.of(0, 10)).getContent();
        assertThat(after).isNotEmpty().allSatisfy(n -> assertThat(n.targetUsername()).isEqualTo(renamed));
    }

    @Test
    @DisplayName("이메일 앞부분이 같은 서로 다른 신규 사용자 여럿이 동시에 처음 요청해도 모두 성공하고 사용자명이 겹치지 않는다")
    void concurrentFirstRequestsWithSameLocalPart() throws Exception {
        int n = 8;
        String local = "same" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        List<DoroUser> people = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            people.add(new DoroUser(UUID.randomUUID(), local + "@host" + i + ".com", UUID.randomUUID(), 100, "USER"));
        }
        ExecutorService pool = Executors.newFixedThreadPool(n);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<String>> futures = new ArrayList<>();
        for (DoroUser person : people) {
            Callable<String> task = () -> {
                start.await();
                return users.getOrCreateUser(person).getUsername();
            };
            futures.add(pool.submit(task));
        }
        start.countDown();
        List<String> names = new ArrayList<>();
        List<String> failures = new ArrayList<>();
        for (Future<String> f : futures) {
            try {
                names.add(f.get(60, TimeUnit.SECONDS));
            } catch (Exception e) {
                failures.add(String.valueOf(e.getCause() != null ? e.getCause() : e));
            }
        }
        pool.shutdownNow();

        assertThat(failures).as("첫 요청이 실패한 사용자").isEmpty();
        assertThat(names).doesNotHaveDuplicates().hasSize(n);
    }

    @Test
    @DisplayName("한 번도 활동하지 않은 신규 사용자의 알림 조회는 오류가 아니라 빈 결과·0 이다")
    void freshUserNotificationsAreEmptyNotAnError() {
        DoroUser fresh = newUser("fresh");

        assertThat(notifications.getUnreadCount(fresh).unreadCount()).isZero();
        assertThat(notifications.getNotifications(fresh, PageRequest.of(0, 10)).getContent()).isEmpty();
    }

    @Test
    @DisplayName("답글이 모두 지워지면 소프트 삭제된 부모 댓글 자리도 목록에서 사라진다")
    void softDeletedRootIsPurgedWhenLastReplyIsDeleted() {
        DoroUser author = newUser("postowner");
        DoroUser u1 = newUser("cmt1");
        DoroUser u2 = newUser("cmt2");
        PostSummaryResponse post = publishedPost(author);
        var root = comments.createRootComment(post.id(), u1, new CreateCommentRequest("루트"));
        var reply = comments.createReply(post.id(), root.id(), u2, new CreateReplyRequest("답글"));

        comments.deleteComment(root.id(), u1);   // 자식이 있어 소프트 삭제
        comments.deleteComment(reply.id(), u2);  // 마지막 답글 삭제

        assertThat(comments.getCommentsByPostId(post.id(), author))
                .as("살아 있는 댓글이 없는데 '삭제된 댓글입니다' 자리가 남으면 안 된다").isEmpty();
    }

    @Test
    @DisplayName("자식이 있는 댓글을 작성자와 글쓴이가 동시에 지워도 댓글 수는 한 번만 줄어든다")
    void concurrentDeleteOfParentDecrementsOnce() throws Exception {
        DoroUser author = newUser("race_post");
        DoroUser commenter = newUser("race_cmt");
        DoroUser replier = newUser("race_rep");
        PostSummaryResponse post = publishedPost(author);
        var root = comments.createRootComment(post.id(), commenter, new CreateCommentRequest("루트"));
        comments.createReply(post.id(), root.id(), replier, new CreateReplyRequest("살아남을 답글"));

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> futures = new ArrayList<>();
        for (DoroUser deleter : List.of(commenter, author)) {
            futures.add(pool.submit(() -> {
                start.await();
                try {
                    comments.deleteComment(root.id(), deleter);
                } catch (RuntimeException ignored) {
                    // 두 번째 삭제 요청은 거부돼도 된다
                }
                return null;
            }));
        }
        start.countDown();
        for (Future<?> f : futures) {
            f.get(60, TimeUnit.SECONDS);
        }
        pool.shutdownNow();

        // 루트는 삭제됐고 답글 1개만 살아 있으므로 댓글 수는 1
        assertThat(queries.getPostById(post.id(), author).post().commentCount()).isEqualTo(1);
    }
}

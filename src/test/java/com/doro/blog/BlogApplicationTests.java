package com.doro.blog;

import com.doro.blog.domain.comment.dto.CommentDtos.CreateCommentRequest;
import com.doro.blog.domain.comment.dto.CommentDtos.CreateReplyRequest;
import com.doro.blog.domain.comment.service.CommentService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostService;
import com.doro.blog.domain.series.dto.SeriesDtos.CreateSeriesRequest;
import com.doro.blog.domain.series.service.SeriesService;
import com.doro.blog.domain.user.dto.BlogUserDtos.UpdateProfileRequest;
import com.doro.blog.domain.user.service.BlogUserService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class BlogApplicationTests {

    @Autowired
    private BlogUserService userService;

    @Autowired
    private SeriesService seriesService;

    @Autowired
    private PostService postService;

    @Autowired
    private CommentService commentService;

    @Test
    @DisplayName("1. 컨텍스트 로딩 및 JIT 작가 프로필 생성/수정 검증")
    void testUserProvisioningAndProfile() {
        UUID testUserId = UUID.randomUUID();
        DoroUser doroUser = new DoroUser(testUserId, "tester@doro.local", UUID.randomUUID(), 1, "USER");

        var user = userService.getOrCreateUser(doroUser);
        assertThat(user).isNotNull();
        assertThat(user.getId()).isEqualTo(testUserId);

        var updated = userService.updateProfile(doroUser, new UpdateProfileRequest(
                "테스터닉", null, "풀스택 엔지니어입니다.", null, "테스터.log", null, null, null, null, null, null
        ));
        assertThat(updated.nickname()).isEqualTo("테스터닉");
        assertThat(updated.bio()).isEqualTo("풀스택 엔지니어입니다.");
    }

    @Test
    @DisplayName("2. 시리즈 생성 및 포스트 연재 출간, 2-Level 대댓글 계층 검증")
    void testSeriesPostAndNestedComments() {
        UUID authorId = UUID.randomUUID();
        DoroUser author = new DoroUser(authorId, "writer@doro.local", UUID.randomUUID(), 2, "USER");

        // 시리즈 생성
        var series = seriesService.createSeries(author, new CreateSeriesRequest(
                "스프링 부트 4 완전 정복", "spring-boot-4-guide", "신규 스프링 가이드", null
        ));
        assertThat(series.id()).isNotNull();

        // 글 작성 (시리즈 편입 & 태그 바인딩)
        var post = postService.createPost(author, new CreatePostRequest(
                "1화: Zanzibar와 ReBAC 소개", "intro-zanzibar", "ReBAC 기초 요약",
                "# Zanzibar ReBAC\n\n구글의 권한 인가 시스템입니다.", null,
                PostStatus.PUBLISHED, series.id(), List.of("Spring", "Zanzibar", "Security")
        ));
        assertThat(post.id()).isNotNull();
        assertThat(post.seriesTitle()).isEqualTo("스프링 부트 4 완전 정복");
        assertThat(post.tags()).contains("spring", "zanzibar", "security");

        // 독자 1 댓글 작성
        UUID readerId = UUID.randomUUID();
        DoroUser reader = new DoroUser(readerId, "reader@doro.local", UUID.randomUUID(), 3, "USER");
        var rootComment = commentService.createRootComment(post.id(), reader, new CreateCommentRequest("글 잘 읽었습니다!"));
        assertThat(rootComment.id()).isNotNull();

        // 작가의 답글 (대댓글) 작성
        var reply = commentService.createReply(post.id(), rootComment.id(), author, new CreateReplyRequest("감사합니다! 좋은 하루 되세요."));
        assertThat(reply.id()).isNotNull();

        // 계층형 댓글 조회 검증
        var commentTree = commentService.getCommentsByPostId(post.id());
        assertThat(commentTree).hasSize(1);
        assertThat(commentTree.get(0).content()).isEqualTo("글 잘 읽었습니다!");
        assertThat(commentTree.get(0).replies()).hasSize(1);
        assertThat(commentTree.get(0).replies().get(0).content()).isEqualTo("감사합니다! 좋은 하루 되세요.");

        // 원글 작성자(Author)의 댓글 삭제 권한 검증 및 소프트 삭제
        commentService.deleteComment(rootComment.id(), author);
        var afterDelete = commentService.getCommentsByPostId(post.id());
        assertThat(afterDelete.get(0).isDeleted()).isTrue();
        assertThat(afterDelete.get(0).content()).isEqualTo("삭제된 댓글입니다.");
        assertThat(afterDelete.get(0).replies()).hasSize(1);
    }

    @Autowired
    private com.doro.blog.domain.notification.service.NotificationService notificationService;

    @Test
    @DisplayName("3. 알림 생성, 조회, 읽음 처리 및 다중 태그 피드 조회 검증")
    void testNotificationsAndMultiTagSearch() {
        UUID authorId = UUID.randomUUID();
        DoroUser author = new DoroUser(authorId, "author2@doro.local", UUID.randomUUID(), 4, "USER");
        UUID readerId = UUID.randomUUID();
        DoroUser reader = new DoroUser(readerId, "reader2@doro.local", UUID.randomUUID(), 5, "USER");

        var post = postService.createPost(author, new CreatePostRequest(
                "테스트 포스트", "test-post-" + System.currentTimeMillis(), "요약",
                "본문 내용입니다.", null, PostStatus.PUBLISHED, null, List.of("Java", "Spring", "Backend")
        ));

        // 독자가 댓글 작성 -> author에게 알림 발생
        commentService.createRootComment(post.id(), reader, new CreateCommentRequest("멋진 글입니다!"));

        var unreadCount = notificationService.getUnreadCount(author);
        assertThat(unreadCount.unreadCount()).isGreaterThanOrEqualTo(1);

        var notifications = notificationService.getNotifications(author, org.springframework.data.domain.PageRequest.of(0, 10));
        assertThat(notifications.getContent()).isNotEmpty();
        var latest = notifications.getContent().get(0);
        assertThat(latest.type()).isEqualTo(com.doro.blog.domain.notification.entity.NotificationType.COMMENT);

        // 단일 알림 읽음 처리
        notificationService.markAsRead(latest.id(), author);
        var afterReadCount = notificationService.getUnreadCount(author);
        assertThat(afterReadCount.unreadCount()).isEqualTo(unreadCount.unreadCount() - 1);

        // 다중 태그 피드 조회 검증
        var multiTagPosts = postService.getFeed("latest", List.of("java", "spring"), 0, 10);
        assertThat(multiTagPosts.getContent()).isNotEmpty();
        assertThat(multiTagPosts.getContent().stream().anyMatch(p -> p.id().equals(post.id()))).isTrue();
    }

    @Test
    @DisplayName("4. 시리즈 비공개 글 열람 권한 제어 (타인 완전 차단 vs 본인/관리자 열람) 검증")
    void testSeriesPrivatePostAccessControl() {
        UUID authorId = UUID.randomUUID();
        DoroUser author = new DoroUser(authorId, "author_series@doro.local", UUID.randomUUID(), 6, "USER");
        UUID readerId = UUID.randomUUID();
        DoroUser reader = new DoroUser(readerId, "reader_series@doro.local", UUID.randomUUID(), 7, "USER");
        DoroUser admin = new DoroUser(UUID.randomUUID(), "admin@doro.local", UUID.randomUUID(), 8, "ADMIN");

        // 시리즈 생성
        var series = seriesService.createSeries(author, new CreateSeriesRequest(
                "보안 연재 시리즈", "security-series-" + System.currentTimeMillis(), "비공개 글 테스트", null
        ));

        // 1화 (공개)
        postService.createPost(author, new CreatePostRequest(
                "1화 공개 포스트", "post-pub-" + System.currentTimeMillis(), "요약1",
                "공개 본문", null, PostStatus.PUBLISHED, series.id(), List.of("Security")
        ));

        // 2화 (비공개 PRIVATE)
        postService.createPost(author, new CreatePostRequest(
                "2화 비공개 포스트", "post-priv-" + System.currentTimeMillis(), "요약2",
                "비공개 본문", null, PostStatus.PRIVATE, series.id(), List.of("Security")
        ));

        // 1) 일반 독자(타인) 조회: 1화만 노출, 2화(비공개) 완전 미노출
        var readerView = seriesService.getSeriesDetail(series.id(), reader);
        assertThat(readerView.posts()).hasSize(1);
        assertThat(readerView.posts().get(0).title()).isEqualTo("1화 공개 포스트");
        assertThat(readerView.series().postCount()).isEqualTo(1);

        // 2) 비로그인(익명) 조회: 1화만 노출
        var anonView = seriesService.getSeriesDetail(series.id(), DoroUser.anonymous());
        assertThat(anonView.posts()).hasSize(1);
        assertThat(anonView.series().postCount()).isEqualTo(1);

        // 3) 작성자 본인 조회: 1화(공개) + 2화(비공개) 모두 노출 및 status 확인
        var authorView = seriesService.getSeriesDetail(series.id(), author);
        assertThat(authorView.posts()).hasSize(2);
        assertThat(authorView.posts().stream().anyMatch(p -> p.status() == PostStatus.PRIVATE)).isTrue();
        assertThat(authorView.series().postCount()).isEqualTo(2);

        // 4) 관리자(ADMIN) 조회: 발행자와 동일하게 비공개 글 포함 전체 열람 가능
        var adminView = seriesService.getSeriesDetail(series.id(), admin);
        assertThat(adminView.posts()).hasSize(2);
        assertThat(adminView.posts().stream().anyMatch(p -> p.status() == PostStatus.PRIVATE)).isTrue();
    }
}

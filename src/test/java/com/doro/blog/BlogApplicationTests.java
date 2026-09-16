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
                "테스터닉", "풀스택 엔지니어입니다.", null, "테스터.log", null, null, null
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
}

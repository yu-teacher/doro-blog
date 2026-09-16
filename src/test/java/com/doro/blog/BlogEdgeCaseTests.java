package com.doro.blog;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.comment.dto.CommentDtos.CreateCommentRequest;
import com.doro.blog.domain.comment.dto.CommentDtos.CreateReplyRequest;
import com.doro.blog.domain.comment.dto.CommentDtos.UpdateCommentRequest;
import com.doro.blog.domain.comment.service.CommentService;
import com.doro.blog.domain.like.service.PostLikeService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.UpdatePostRequest;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostService;
import com.doro.blog.domain.series.dto.SeriesDtos.CreateSeriesRequest;
import com.doro.blog.domain.series.dto.SeriesDtos.UpdateSeriesRequest;
import com.doro.blog.domain.series.service.SeriesService;
import com.doro.blog.domain.tag.service.TagService;
import com.doro.blog.domain.user.dto.BlogUserDtos.UpdateProfileRequest;
import com.doro.blog.domain.user.service.BlogUserService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class BlogEdgeCaseTests {

    @Autowired
    private BlogUserService userService;

    @Autowired
    private SeriesService seriesService;

    @Autowired
    private PostService postService;

    @Autowired
    private CommentService commentService;

    @Autowired
    private TagService tagService;

    @Autowired
    private PostLikeService likeService;

    private DoroUser createMockUser(String prefix) {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, prefix + "_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    @Nested
    @DisplayName("1. 대댓글(Comment & Reply) 엣지케이스 검증")
    class CommentEdgeCases {

        @Test
        @DisplayName("2-Level 초과 제한: 대댓글에 다시 답글(3-Level)을 작성하려고 하면 INVALID_COMMENT_DEPTH 예외 발생")
        void testExceedingMaxCommentDepth() {
            DoroUser author = createMockUser("author");
            DoroUser reader1 = createMockUser("reader1");
            DoroUser reader2 = createMockUser("reader2");

            var post = postService.createPost(author, new CreatePostRequest(
                    "대댓글 뎁스 테스트", null, null, "본문", null, PostStatus.PUBLISHED, null, null
            ));

            // Level 1: 루트 댓글
            var rootComment = commentService.createRootComment(post.id(), reader1, new CreateCommentRequest("루트 댓글입니다."));
            assertThat(rootComment.id()).isNotNull();

            // Level 2: 대댓글 (답글)
            var reply = commentService.createReply(post.id(), rootComment.id(), reader2, new CreateReplyRequest("대댓글입니다."));
            assertThat(reply.id()).isNotNull();

            // Level 3 시도: 대댓글에 다시 답글 달기 시도 -> 예외 발생해야 함
            assertThatThrownBy(() ->
                    commentService.createReply(post.id(), reply.id(), reader1, new CreateReplyRequest("3단계 대댓글 시도"))
            ).isInstanceOf(BlogException.class)
             .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_COMMENT_DEPTH);
        }

        @Test
        @DisplayName("권한 없는 제3자가 타인의 댓글 삭제 시도 시 ACCESS_DENIED 거부")
        void testUnauthorizedCommentDeletion() {
            DoroUser postAuthor = createMockUser("postAuthor");
            DoroUser commentAuthor = createMockUser("commentAuthor");
            DoroUser stranger = createMockUser("stranger");

            var post = postService.createPost(postAuthor, new CreatePostRequest(
                    "인가 테스트 글", null, null, "본문", null, PostStatus.PUBLISHED, null, null
            ));

            var comment = commentService.createRootComment(post.id(), commentAuthor, new CreateCommentRequest("작성자 댓글"));

            // 제3자 stranger가 삭제 시도 -> 거부
            assertThatThrownBy(() ->
                    commentService.deleteComment(comment.id(), stranger)
            ).isInstanceOf(BlogException.class)
             .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ACCESS_DENIED);
        }

        @Test
        @DisplayName("자식이 없는 단독 루트 댓글은 소프트삭제가 아닌 완전 삭제(Hard Delete)")
        void testHardDeleteSingleComment() {
            DoroUser author = createMockUser("author");
            DoroUser reader = createMockUser("reader");

            var post = postService.createPost(author, new CreatePostRequest(
                    "하드삭제 테스트", null, null, "본문", null, PostStatus.PUBLISHED, null, null
            ));

            var comment = commentService.createRootComment(post.id(), reader, new CreateCommentRequest("단독 댓글"));
            assertThat(commentService.getCommentsByPostId(post.id())).hasSize(1);

            // 삭제
            commentService.deleteComment(comment.id(), reader);

            // 조회 시 목록에서 완전히 제거됨
            assertThat(commentService.getCommentsByPostId(post.id())).isEmpty();
        }

        @Test
        @DisplayName("삭제된 댓글 수정 시도 시 IllegalStateException 발생")
        void testEditDeletedCommentFails() {
            DoroUser author = createMockUser("author");
            DoroUser reader = createMockUser("reader");

            var post = postService.createPost(author, new CreatePostRequest(
                    "삭제댓글 수정 테스트", null, null, "본문", null, PostStatus.PUBLISHED, null, null
            ));

            var root = commentService.createRootComment(post.id(), reader, new CreateCommentRequest("루트 댓글"));
            commentService.createReply(post.id(), root.id(), author, new CreateReplyRequest("답글"));

            // 소프트 삭제
            commentService.deleteComment(root.id(), reader);

            // 수정 시도 -> 예외
            assertThatThrownBy(() ->
                    commentService.updateComment(root.id(), reader, new UpdateCommentRequest("수정 시도"))
            ).isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("2. 태그(Tag) 동기화 및 엣지케이스 검증")
    class TagEdgeCases {

        @Test
        @DisplayName("특수문자 포함, 대소문자 중복 태그 정규화 및 글 수정 시 태그 카운트 증감 정합성")
        void testTagNormalizationAndCountIntegrity() {
            DoroUser author = createMockUser("tagAuthor");

            // ["Java", "JAVA", "java!", "#spring_boot", "   "] -> 중복 제거 및 소문자 정규화: "java", "springboot"
            var post = postService.createPost(author, new CreatePostRequest(
                    "태그 정규화 테스트", null, null, "본문", null, PostStatus.PUBLISHED, null,
                    List.of("Java", "JAVA", "java!", "#spring_boot", "   ")
            ));

            assertThat(post.tags()).containsExactlyInAnyOrder("java", "spring_boot");

            // 글 수정으로 태그 변경: "java" 제거, "react" 추가
            postService.updatePost(post.id(), new UpdatePostRequest(
                    "태그 정규화 테스트", null, null, "본문", null, PostStatus.PUBLISHED, null,
                    List.of("react", "spring_boot")
            ));

            var detail = postService.getPostDetail(author.email().split("@")[0], post.slug(), author);
            assertThat(detail.post().tags()).containsExactlyInAnyOrder("react", "spring_boot");
            assertThat(detail.post().tags()).doesNotContain("java");
        }
    }

    @Nested
    @DisplayName("3. 시리즈(Series) 및 연재 순서 엣지케이스 검증")
    class SeriesEdgeCases {

        @Test
        @DisplayName("동일 작가가 동일한 제목/슬러그로 시리즈 생성 시 유니크 충돌 없이 슬러그 자동 분기")
        void testDuplicateSeriesSlugAutoResolution() {
            DoroUser author = createMockUser("seriesAuthor");

            var series1 = seriesService.createSeries(author, new CreateSeriesRequest("도커 바이블", "docker-bible", null, null));
            var series2 = seriesService.createSeries(author, new CreateSeriesRequest("도커 바이블", "docker-bible", null, null));

            assertThat(series1.slug()).isEqualTo("docker-bible");
            assertThat(series2.slug()).startsWith("docker-bible-");
            assertThat(series1.id()).isNotEqualTo(series2.id());
        }

        @Test
        @DisplayName("시리즈 삭제 시 소속된 포스트는 삭제되지 않고 단독 글로 정상 분리")
        void testDeleteSeriesUnlinksPostsWithoutDeleting() {
            DoroUser author = createMockUser("seriesAuthor2");

            var series = seriesService.createSeries(author, new CreateSeriesRequest("쿠버네티스", null, null, null));
            var post = postService.createPost(author, new CreatePostRequest(
                    "k8s 1편", null, null, "본문", null, PostStatus.PUBLISHED, series.id(), null
            ));

            assertThat(post.seriesTitle()).isEqualTo("쿠버네티스");

            // 시리즈 삭제
            seriesService.deleteSeries(series.id());

            // 글이 여전히 존재하는지 확인
            var postDetail = postService.getPostDetail(author.email().split("@")[0], post.slug(), author);
            assertThat(postDetail.post().id()).isEqualTo(post.id());
            assertThat(postDetail.post().seriesId()).isNull();
            assertThat(postDetail.post().seriesTitle()).isNull();
        }
    }

    @Nested
    @DisplayName("4. 비공개 글 열람 및 권한(ReBAC) 엣지케이스 검증")
    class PrivatePostEdgeCases {

        @Test
        @DisplayName("비공개(PRIVATE) 및 임시저장(DRAFT) 글은 타 사용자가 조회 시 ACCESS_DENIED 발생")
        void testPrivatePostAccessDeniedForStranger() {
            DoroUser author = createMockUser("secretWriter");
            DoroUser stranger = createMockUser("curiousStranger");

            var draftPost = postService.createPost(author, new CreatePostRequest(
                    "작성중인 일기", "my-secret-draft", null, "비밀 본문", null, PostStatus.DRAFT, null, null
            ));

            // 작성자 본인은 열람 가능
            var authorView = postService.getPostDetail(author.email().split("@")[0], draftPost.slug(), author);
            assertThat(authorView.content()).isEqualTo("비밀 본문");

            // 타 사용자 stranger 열람 시도 -> ACCESS_DENIED
            assertThatThrownBy(() ->
                    postService.getPostDetail(author.email().split("@")[0], draftPost.slug(), stranger)
            ).isInstanceOf(BlogException.class)
             .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ACCESS_DENIED);
        }
    }

    @Nested
    @DisplayName("5. 좋아요(Like) 토글 엣지케이스 검증")
    class LikeEdgeCases {

        @Test
        @DisplayName("연속 좋아요 토글 시 1인 1좋아요 정합성 및 카운트 음수 방지")
        void testContinuousLikeToggle() {
            DoroUser author = createMockUser("likeAuthor");
            DoroUser user1 = createMockUser("liker");

            var post = postService.createPost(author, new CreatePostRequest(
                    "좋아요 글", null, null, "본문", null, PostStatus.PUBLISHED, null, null
            ));

            // 1회 클릭: 좋아요 등록 (true, likeCount = 1)
            boolean liked1 = likeService.toggleLike(post.id(), user1);
            assertThat(liked1).isTrue();

            var view1 = postService.getPostDetail(author.email().split("@")[0], post.slug(), user1);
            assertThat(view1.likedByMe()).isTrue();
            assertThat(view1.post().likeCount()).isEqualTo(1);

            // 2회 클릭: 좋아요 취소 (false, likeCount = 0)
            boolean liked2 = likeService.toggleLike(post.id(), user1);
            assertThat(liked2).isFalse();

            var view2 = postService.getPostDetail(author.email().split("@")[0], post.slug(), user1);
            assertThat(view2.likedByMe()).isFalse();
            assertThat(view2.post().likeCount()).isEqualTo(0);
        }
    }

    @Nested
    @DisplayName("6. 사용자명(username) 슬러그 검증 엣지케이스")
    class UsernameEdgeCases {

        @Test
        @DisplayName("잘못된 형식(특수문자, 2자 이하 등)의 username 변경 시도 시 INVALID_INPUT 발생")
        void testInvalidUsernameValidation() {
            DoroUser user = createMockUser("slugUser");
            userService.getOrCreateUser(user);

            // 2글자 이하
            assertThatThrownBy(() -> userService.updateUsername(user, "ab"))
                    .isInstanceOf(BlogException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_INPUT);

            // 공백 및 특수문자 포함
            assertThatThrownBy(() -> userService.updateUsername(user, "user!@#$"))
                    .isInstanceOf(BlogException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_INPUT);
        }
    }
}

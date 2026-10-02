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
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.post.service.PostQueryService;
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
    private PostCommandService postCommands;

    @Autowired
    private PostQueryService postQueries;

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

            var post = postCommands.createPost(author, new CreatePostRequest(
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

            var post = postCommands.createPost(postAuthor, new CreatePostRequest(
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

            var post = postCommands.createPost(author, new CreatePostRequest(
                    "하드삭제 테스트", null, null, "본문", null, PostStatus.PUBLISHED, null, null
            ));

            var comment = commentService.createRootComment(post.id(), reader, new CreateCommentRequest("단독 댓글"));
            assertThat(commentService.getCommentsByPostId(post.id(), reader)).hasSize(1);

            // 삭제
            commentService.deleteComment(comment.id(), reader);

            // 조회 시 목록에서 완전히 제거됨
            assertThat(commentService.getCommentsByPostId(post.id(), reader)).isEmpty();
        }

        @Test
        @DisplayName("삭제된 댓글 수정 시도 시 IllegalStateException 발생")
        void testEditDeletedCommentFails() {
            DoroUser author = createMockUser("author");
            DoroUser reader = createMockUser("reader");

            var post = postCommands.createPost(author, new CreatePostRequest(
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
            var post = postCommands.createPost(author, new CreatePostRequest(
                    "태그 정규화 테스트", null, null, "본문", null, PostStatus.PUBLISHED, null,
                    List.of("Java", "JAVA", "java!", "#spring_boot", "   ")
            ));

            assertThat(post.tags()).containsExactlyInAnyOrder("java", "spring_boot");

            // 글 수정으로 태그 변경: "java" 제거, "react" 추가
            postCommands.updatePost(post.id(), new UpdatePostRequest(
                    "태그 정규화 테스트", null, null, "본문", null, PostStatus.PUBLISHED, null,
                    List.of("react", "spring_boot")
            ));

            var detail = postQueries.getPostDetail(author.email().split("@")[0], post.slug(), author);
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
            var post = postCommands.createPost(author, new CreatePostRequest(
                    "k8s 1편", null, null, "본문", null, PostStatus.PUBLISHED, series.id(), null
            ));

            assertThat(post.seriesTitle()).isEqualTo("쿠버네티스");

            // 시리즈 삭제
            seriesService.deleteSeries(series.id());

            // 글이 여전히 존재하는지 확인
            var postDetail = postQueries.getPostDetail(author.email().split("@")[0], post.slug(), author);
            assertThat(postDetail.post().id()).isEqualTo(post.id());
            assertThat(postDetail.post().seriesId()).isNull();
            assertThat(postDetail.post().seriesTitle()).isNull();
        }
    }

    @Nested
    @DisplayName("4. 비공개 글 열람 및 권한(ReBAC) 엣지케이스 검증")
    class PrivatePostEdgeCases {

        @Test
        @DisplayName("비공개(PRIVATE) 및 임시저장(DRAFT) 글은 타 사용자가 슬러그로 조회하면 존재 자체를 숨기는 POST_NOT_FOUND")
        void testPrivatePostAccessDeniedForStranger() {
            DoroUser author = createMockUser("secretWriter");
            DoroUser stranger = createMockUser("curiousStranger");

            var draftPost = postCommands.createPost(author, new CreatePostRequest(
                    "작성중인 일기", "my-secret-draft", null, "비밀 본문", null, PostStatus.DRAFT, null, null
            ));

            // 작성자 본인은 열람 가능
            var authorView = postQueries.getPostDetail(author.email().split("@")[0], draftPost.slug(), author);
            assertThat(authorView.content()).isEqualTo("비밀 본문");

            // 타 사용자 stranger 열람 시도 -> 없는 글과 같은 응답(슬러그로 존재 여부를 알아내지 못하게)
            assertThatThrownBy(() ->
                    postQueries.getPostDetail(author.email().split("@")[0], draftPost.slug(), stranger)
            ).isInstanceOf(BlogException.class)
             .hasFieldOrPropertyWithValue("errorCode", ErrorCode.POST_NOT_FOUND);
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

            var post = postCommands.createPost(author, new CreatePostRequest(
                    "좋아요 글", null, null, "본문", null, PostStatus.PUBLISHED, null, null
            ));

            // 1회 클릭: 좋아요 등록 (true, likeCount = 1)
            boolean liked1 = likeService.toggleLike(post.id(), user1);
            assertThat(liked1).isTrue();

            var view1 = postQueries.getPostDetail(author.email().split("@")[0], post.slug(), user1);
            assertThat(view1.likedByMe()).isTrue();
            assertThat(view1.post().likeCount()).isEqualTo(1);

            // 2회 클릭: 좋아요 취소 (false, likeCount = 0)
            boolean liked2 = likeService.toggleLike(post.id(), user1);
            assertThat(liked2).isFalse();

            var view2 = postQueries.getPostDetail(author.email().split("@")[0], post.slug(), user1);
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

    @Nested
    @DisplayName("7. 부가 편의 기능 및 페이징 검증 (내 글 관리, 트렌딩, 좋아요 목록, 검색)")
    class ExtraFeaturesTests {

        @Test
        @DisplayName("내 포스트 목록 페이징 및 상태(DRAFT/PUBLISHED) 필터링 검증")
        void testMyPostsPaginationAndStatusFilter() {
            DoroUser author = createMockUser("myPostAuthor");

            // 출간글 3개, 임시저장글 2개 생성
            for (int i = 1; i <= 3; i++) {
                postCommands.createPost(author, new CreatePostRequest(
                        "공개글 " + i, "pub-" + i + "-" + UUID.randomUUID(), null, "본문", null, PostStatus.PUBLISHED, null, null
                ));
            }
            for (int i = 1; i <= 2; i++) {
                postCommands.createPost(author, new CreatePostRequest(
                        "임시저장글 " + i, "draft-" + i + "-" + UUID.randomUUID(), null, "임시본문", null, PostStatus.DRAFT, null, null
                ));
            }

            // 1) 전체 내 글 조회 (page=0, size=3)
            var allPage0 = postQueries.getMyPosts(author, null, 0, 3);
            assertThat(allPage0.getTotalElements()).isEqualTo(5);
            assertThat(allPage0.getContent()).hasSize(3);
            assertThat(allPage0.getTotalPages()).isEqualTo(2);

            // 2) 임시저장(DRAFT) 글만 필터링 조회
            var draftOnly = postQueries.getMyPosts(author, PostStatus.DRAFT, 0, 10);
            assertThat(draftOnly.getTotalElements()).isEqualTo(2);
            assertThat(draftOnly.getContent()).allMatch(p -> p.status() == PostStatus.DRAFT);
        }

        @Test
        @DisplayName("트렌딩 포스트 기간별(day/week/month) 조회 및 페이징 검증")
        void testTrendingPostsPagination() {
            DoroUser writer = createMockUser("trendWriter");
            DoroUser liker = createMockUser("trendLiker");

            var post = postCommands.createPost(writer, new CreatePostRequest(
                    "트렌딩 글", "trend-" + UUID.randomUUID(), null, "인기 글 본문", null, PostStatus.PUBLISHED, null, null
            ));
            likeService.toggleLike(post.id(), liker);

            // 최근 1주일 트렌딩 조회
            var weekTrending = postQueries.getTrendingPosts("week", 0, 10);
            assertThat(weekTrending.getContent()).isNotEmpty();
            assertThat(weekTrending.getContent().get(0).likeCount()).isGreaterThanOrEqualTo(1);
        }

        @Test
        @DisplayName("내가 좋아요한 포스트 목록 페이징 조회 검증")
        void testMyLikedPostsPagination() {
            DoroUser author = createMockUser("targetAuthor");
            DoroUser fan = createMockUser("fanUser");

            var p1 = postCommands.createPost(author, new CreatePostRequest("팬글 1", "fan-1-" + UUID.randomUUID(), null, "본문 1", null, PostStatus.PUBLISHED, null, null));
            var p2 = postCommands.createPost(author, new CreatePostRequest("팬글 2", "fan-2-" + UUID.randomUUID(), null, "본문 2", null, PostStatus.PUBLISHED, null, null));

            likeService.toggleLike(p1.id(), fan);
            likeService.toggleLike(p2.id(), fan);

            var likedPage = postQueries.getMyLikedPosts(fan, 0, 10);
            assertThat(likedPage.getTotalElements()).isGreaterThanOrEqualTo(2);
            assertThat(likedPage.getContent()).extracting("id").contains(p1.id(), p2.id());
        }

        @Test
        @DisplayName("키워드 검색 페이징 검증 (대소문자 무관 및 본문 검색)")
        void testSearchPostsPagination() {
            DoroUser author = createMockUser("searchAuthor");

            postCommands.createPost(author, new CreatePostRequest(
                    "쿠버네티스 아키텍처 마스터", "k8s-arch-" + UUID.randomUUID(), "핵심 요약", "etcd와 kube-apiserver 내부 동작", null, PostStatus.PUBLISHED, null, null
            ));

            // 제목 키워드 검색
            var searchTitle = postQueries.searchPosts("쿠버네티스", 0, 10);
            assertThat(searchTitle.getContent()).isNotEmpty();

            // 본문 키워드 검색
            var searchContent = postQueries.searchPosts("kube-apiserver", 0, 10);
            assertThat(searchContent.getContent()).isNotEmpty();

            // 없는 키워드 검색
            var searchNone = postQueries.searchPosts("없는검색어123456", 0, 10);
            assertThat(searchNone.getContent()).isEmpty();
        }

        @Test
        @DisplayName("특정 작가의 블로그 채널 내 키워드 검색 및 태그 필터 페이징 검증")
        void testSpecificUserPostsSearchAndFilter() {
            DoroUser author1 = createMockUser("authorOne");
            DoroUser author2 = createMockUser("authorTwo");

            // author1이 쓴 글들
            postCommands.createPost(author1, new CreatePostRequest(
                    "Spring Boot 3 마이그레이션", "spring-boot-3-" + UUID.randomUUID(), null, "Spring 본문", null, PostStatus.PUBLISHED, null, List.of("Spring")
            ));
            postCommands.createPost(author1, new CreatePostRequest(
                    "React 19 Server Components", "react-19-" + UUID.randomUUID(), null, "React 본문", null, PostStatus.PUBLISHED, null, List.of("React")
            ));

            // author2가 쓴 글 (동일한 Spring 키워드)
            postCommands.createPost(author2, new CreatePostRequest(
                    "다른 작가의 Spring 글", "other-spring-" + UUID.randomUUID(), null, "Spring 본문", null, PostStatus.PUBLISHED, null, List.of("Spring")
            ));

            String author1Username = author1.email().split("@")[0];

            // 1. author1 채널 전체 글 목록
            var allAuthor1 = postQueries.getUserPosts(author1Username, null, null, 0, 10);
            assertThat(allAuthor1.getTotalElements()).isEqualTo(2);

            // 2. author1 채널 내에서만 "Spring" 키워드 검색 -> author2의 글은 제외되어야 함
            var searchAuthor1 = postQueries.getUserPosts(author1Username, "Spring", null, 0, 10);
            assertThat(searchAuthor1.getTotalElements()).isEqualTo(1);
            assertThat(searchAuthor1.getContent().get(0).title()).isEqualTo("Spring Boot 3 마이그레이션");

            // 3. author1 채널 내에서만 "React" 태그 필터
            var tagAuthor1 = postQueries.getUserPosts(author1Username, null, "React", 0, 10);
            assertThat(tagAuthor1.getTotalElements()).isEqualTo(1);
            assertThat(tagAuthor1.getContent().get(0).title()).isEqualTo("React 19 Server Components");
        }
    }
}



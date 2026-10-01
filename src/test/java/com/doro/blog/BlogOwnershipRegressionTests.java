package com.doro.blog;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.comment.dto.CommentDtos.CreateCommentRequest;
import com.doro.blog.domain.comment.dto.CommentDtos.CreateReplyRequest;
import com.doro.blog.domain.comment.service.CommentService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.UpdatePostRequest;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.post.service.PostQueryService;
import com.doro.blog.domain.series.dto.SeriesDtos.CreateSeriesRequest;
import com.doro.blog.domain.series.dto.SeriesDtos.UpdateSeriesRequest;
import com.doro.blog.domain.series.service.SeriesService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 코드 리뷰에서 확인된 소유권/부분 수정/댓글 소속 결함의 회귀 방지 테스트. */
@SpringBootTest
class BlogOwnershipRegressionTests {

    @Autowired
    private PostCommandService postCommands;

    @Autowired
    private PostQueryService postQueries;

    @Autowired
    private SeriesService seriesService;

    @Autowired
    private CommentService commentService;

    private DoroUser mockUser(String prefix) {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, prefix + "_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private CreatePostRequest publishedPost(String title, UUID seriesId) {
        return new CreatePostRequest(title, null, null, "본문 " + title, null, PostStatus.PUBLISHED, seriesId, null);
    }

    @Test
    @DisplayName("다른 사용자의 시리즈에 글을 생성하면 ACCESS_DENIED 이고 시리즈 글 수는 변하지 않는다")
    void createPostInForeignSeriesIsDenied() {
        DoroUser owner = mockUser("owner");
        DoroUser attacker = mockUser("attacker");
        var series = seriesService.createSeries(owner, new CreateSeriesRequest("남의 시리즈", null, null, null));

        assertThatThrownBy(() -> postCommands.createPost(attacker, publishedPost("끼어들기", series.id())))
                .isInstanceOf(BlogException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ACCESS_DENIED);

        assertThat(seriesService.getSeriesDetail(series.id(), owner).series().postCount()).isZero();
    }

    @Test
    @DisplayName("글을 다른 사용자의 시리즈로 옮기면 ACCESS_DENIED 이고 기존 시리즈 글 수는 유지된다")
    void moveToForeignSeriesIsDenied() {
        DoroUser author = mockUser("author");
        DoroUser other = mockUser("other");
        var mine = seriesService.createSeries(author, new CreateSeriesRequest("내 시리즈", null, null, null));
        var theirs = seriesService.createSeries(other, new CreateSeriesRequest("남의 시리즈", null, null, null));
        var post = postCommands.createPost(author, publishedPost("내 글", mine.id()));

        assertThatThrownBy(() -> postCommands.updatePost(post.id(), new UpdatePostRequest(
                "내 글", null, null, "본문 내 글", null, PostStatus.PUBLISHED, theirs.id(), null)))
                .isInstanceOf(BlogException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ACCESS_DENIED);

        assertThat(seriesService.getSeriesDetail(mine.id(), author).series().postCount()).isEqualTo(1);
        assertThat(seriesService.getSeriesDetail(theirs.id(), other).series().postCount()).isZero();
    }

    @Test
    @DisplayName("본문 없이 보낸 수정 요청은 기존 본문과 요약을 지우지 않는다")
    void updateWithoutContentKeepsContentAndSummary() {
        DoroUser author = mockUser("author");
        var draft = postCommands.createPost(author, new CreatePostRequest(
                "초안", null, "직접 쓴 요약", "지켜야 할 본문", null, PostStatus.DRAFT, null, null));

        postCommands.updatePost(draft.id(), new UpdatePostRequest(
                "제목만 수정", null, null, null, null, PostStatus.DRAFT, null, null));

        var detail = postQueries.getPostById(draft.id(), author);
        assertThat(detail.content()).isEqualTo("지켜야 할 본문");
        assertThat(detail.post().summary()).isEqualTo("직접 쓴 요약");
        assertThat(detail.post().title()).isEqualTo("제목만 수정");
    }

    @Test
    @DisplayName("다른 글의 댓글을 부모로 지정한 답글은 거부되고 댓글 수가 늘지 않는다")
    void replyToCommentOfAnotherPostIsRejected() {
        DoroUser author = mockUser("author");
        DoroUser reader = mockUser("reader");
        var postA = postCommands.createPost(author, publishedPost("글 A", null));
        var postB = postCommands.createPost(author, publishedPost("글 B", null));
        var commentOnA = commentService.createRootComment(postA.id(), reader, new CreateCommentRequest("A 의 댓글"));

        assertThatThrownBy(() -> commentService.createReply(postB.id(), commentOnA.id(), reader, new CreateReplyRequest("엉뚱한 답글")))
                .isInstanceOf(BlogException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.COMMENT_NOT_FOUND);

        assertThat(postQueries.getPostById(postB.id(), author).post().commentCount()).isZero();
    }

    @Test
    @DisplayName("수정 시 이미 쓰는 슬러그로 바꾸면 500 이 아니라 SLUG_ALREADY_EXISTS")
    void updateToTakenSlugIsRejected() {
        DoroUser author = mockUser("author");
        var first = postCommands.createPost(author, new CreatePostRequest(
                "첫 글", "taken-slug", null, "본문", null, PostStatus.PUBLISHED, null, null));
        var second = postCommands.createPost(author, publishedPost("둘째 글", null));

        assertThatThrownBy(() -> postCommands.updatePost(second.id(), new UpdatePostRequest(
                "둘째 글", "taken-slug", null, null, null, PostStatus.PUBLISHED, null, null)))
                .isInstanceOf(BlogException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.SLUG_ALREADY_EXISTS);

        assertThat(first.slug()).isEqualTo("taken-slug");
        assertThat(postQueries.getPostById(second.id(), author).post().slug()).isNotEqualTo("taken-slug");
    }

    @Test
    @DisplayName("제목이 기호뿐이어도 '---' 같은 슬러그가 만들어지지 않는다")
    void symbolOnlyTitleGetsUsableSlug() {
        DoroUser author = mockUser("author");
        var post = postCommands.createPost(author, new CreatePostRequest(
                "!!!", null, null, "본문", null, PostStatus.PUBLISHED, null, null));

        assertThat(post.slug()).isNotBlank().doesNotContainPattern("^-+$");
    }

    @Test
    @DisplayName("시리즈 정렬: 모든 글을 한 번씩 담은 목록만 받아들이고, 결과는 요청 순서를 따른다")
    void reorderRequiresExactlyTheSeriesPosts() {
        DoroUser author = mockUser("author");
        var series = seriesService.createSeries(author, new CreateSeriesRequest("정렬 시리즈", null, null, null));
        var a = postCommands.createPost(author, publishedPost("A", series.id()));
        var b = postCommands.createPost(author, publishedPost("B", series.id()));
        var c = postCommands.createPost(author, publishedPost("C", series.id()));

        var detail = seriesService.reorderPosts(series.id(), List.of(c.id(), a.id(), b.id()));
        assertThat(detail.posts()).extracting(p -> p.id()).containsExactly(c.id(), a.id(), b.id());
        assertThat(detail.posts()).extracting(p -> p.seriesOrder()).containsExactly(1, 2, 3);

        // 빠진 글, 중복, 남의 글이 섞인 목록은 거부하고 기존 순서를 바꾸지 않는다
        assertThatThrownBy(() -> seriesService.reorderPosts(series.id(), List.of(a.id(), b.id())))
                .isInstanceOf(BlogException.class).hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_INPUT);
        assertThatThrownBy(() -> seriesService.reorderPosts(series.id(), List.of(a.id(), a.id(), b.id())))
                .isInstanceOf(BlogException.class).hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_INPUT);
        assertThatThrownBy(() -> seriesService.reorderPosts(series.id(), List.of(a.id(), b.id(), UUID.randomUUID())))
                .isInstanceOf(BlogException.class).hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_INPUT);
        assertThat(seriesService.getSeriesDetail(series.id(), author).posts()).extracting(p -> p.id())
                .containsExactly(c.id(), a.id(), b.id());
    }

    @Test
    @DisplayName("시리즈 슬러그를 이미 쓰는 값으로 바꾸면 SLUG_ALREADY_EXISTS")
    void updatingSeriesToTakenSlugIsRejected() {
        DoroUser author = mockUser("author");
        seriesService.createSeries(author, new CreateSeriesRequest("첫 시리즈", "taken-series", null, null));
        var second = seriesService.createSeries(author, new CreateSeriesRequest("둘째 시리즈", null, null, null));

        assertThatThrownBy(() -> seriesService.updateSeries(second.id(), new UpdateSeriesRequest("둘째 시리즈", "taken-series", null, null)))
                .isInstanceOf(BlogException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.SLUG_ALREADY_EXISTS);
    }

    @Test
    @DisplayName("검색어의 % 와 _ 는 와일드카드가 아니라 글자로 취급한다")
    void searchTreatsWildcardsLiterally() {
        DoroUser author = mockUser("author");
        String marker = "mk" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        postCommands.createPost(author, new CreatePostRequest(
                marker + " 100%_done", null, null, "본문", null, PostStatus.PUBLISHED, null, null));
        postCommands.createPost(author, new CreatePostRequest(
                marker + " 100xxdone", null, null, "본문", null, PostStatus.PUBLISHED, null, null));

        assertThat(postQueries.searchPosts(marker, 0, 20).getTotalElements()).isEqualTo(2);
        assertThat(postQueries.searchPosts(marker + " 100%_done", 0, 20).getTotalElements()).isEqualTo(1);
    }
}

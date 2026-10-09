package com.doro.blog.domain.post;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.domain.like.service.PostLikeService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.dto.PostDtos.UpdatePostRequest;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.post.service.PostQueryService;
import com.doro.blog.domain.series.dto.SeriesDtos.CreateSeriesRequest;
import com.doro.blog.domain.series.service.SeriesService;
import com.doro.blog.domain.tag.repository.TagRepository;
import com.doro.blog.domain.tag.service.TagService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 글 수정의 부분 업데이트 규칙(생략 = 유지), 시리즈·태그 정합성, 피드 필터. 감사에서 확정된 버그들의 회귀 테스트이기도 하다.
 */
@SpringBootTest
class PostLifecycleSemanticsTest {

    @Autowired private PostCommandService commands;
    @Autowired private PostQueryService queries;
    @Autowired private SeriesService seriesService;
    @Autowired private PostLikeService likes;
    @Autowired private TagRepository tagRepository;
    @Autowired private TagService tagService;

    private DoroUser newUser(String prefix) {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, prefix + "_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private static String unique() {
        return "t" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    private PostSummaryResponse create(DoroUser u, String title, String summary, String content, String thumb,
                                       PostStatus status, UUID seriesId, List<String> tags) {
        return commands.createPost(u, new CreatePostRequest(title, null, summary, content, thumb, status, seriesId, tags));
    }

    private PostSummaryResponse update(UUID id, String title, String summary, String content, String thumb,
                                       PostStatus status, UUID seriesId, List<String> tags) {
        return commands.updatePost(id, new UpdatePostRequest(title, null, summary, content, thumb, status, seriesId, tags));
    }

    private PostSummaryResponse updateRemovingSeries(UUID id, String title) {
        return commands.updatePost(id, new UpdatePostRequest(title, null, null, null, null, null, null, null, true));
    }

    private int tagCount(String tag) {
        return tagRepository.findByName(tag).map(t -> t.getPostCount()).orElse(0);
    }

    private UUID newSeries(DoroUser u) {
        return seriesService.createSeries(u, new CreateSeriesRequest("series " + unique(), null, null, null)).id();
    }

    @Test
    @DisplayName("본문만 수정하고 요약을 보내지 않아도 작성자가 쓴 요약은 유지된다")
    void explicitSummarySurvivesContentEdit() {
        DoroUser author = newUser("sum");
        PostSummaryResponse post = create(author, "제목", "내가 쓴 요약", "첫 본문", null, PostStatus.PUBLISHED, null, null);

        update(post.id(), "제목", null, "완전히 새로운 본문입니다", null, null, null, null);

        assertThat(queries.getPostById(post.id(), author).post().summary()).isEqualTo("내가 쓴 요약");
    }

    @Test
    @DisplayName("시리즈 순서를 바꾼 응답에도 임시저장 글이 빠지지 않는다 (작성자의 응답)")
    void reorderResponseKeepsDraftMembers() {
        DoroUser author = newUser("reorder");
        UUID series = newSeries(author);
        PostSummaryResponse a = create(author, "A", null, "본문 A", null, PostStatus.PUBLISHED, series, null);
        PostSummaryResponse b = create(author, "B", null, "본문 B", null, PostStatus.DRAFT, series, null);
        PostSummaryResponse c = create(author, "C", null, "본문 C", null, PostStatus.PUBLISHED, series, null);

        var response = seriesService.reorderPosts(series, List.of(c.id(), b.id(), a.id()));

        assertThat(response.posts()).extracting(p -> p.id()).containsExactly(c.id(), b.id(), a.id());
        assertThat(response.series().postCount()).isEqualTo(3);
    }

    @Test
    @DisplayName("seriesId 를 보내지 않은 수정은 글을 시리즈에서 빼지 않는다")
    void updateWithoutSeriesIdKeepsSeries() {
        DoroUser author = newUser("keepseries");
        UUID series = newSeries(author);
        PostSummaryResponse post = create(author, "제목", null, "본문", null, PostStatus.PUBLISHED, series, null);

        update(post.id(), "제목 수정", null, "본문 수정", null, null, null, null);

        assertThat(queries.getPostById(post.id(), author).post().seriesId()).isEqualTo(series);
        assertThat(seriesService.getSeriesDetail(series, author).posts()).hasSize(1);
    }

    @Test
    @DisplayName("출간된 글의 본문을 빈 문자열로 바꿀 수 없다")
    void publishedPostCannotBeBlanked() {
        DoroUser author = newUser("blank");
        PostSummaryResponse post = create(author, "제목", null, "본문", null, PostStatus.PUBLISHED, null, null);

        boolean rejected;
        try {
            update(post.id(), "제목", null, "   ", null, null, null, null);
            rejected = false;
        } catch (BlogException e) {
            rejected = true;
        }

        assertThat(rejected || !queries.getPostById(post.id(), author).content().isBlank())
                .as("빈 본문으로 수정이 거부되거나 본문이 유지돼야 한다").isTrue();
    }

    @Test
    @DisplayName("직접 지정한 썸네일은 본문의 첫 이미지로 덮어써지지 않는다")
    void explicitThumbnailIsNotOverwrittenByBodyImage() {
        DoroUser author = newUser("thumb");
        String explicit = "https://example.com/explicit.png";
        PostSummaryResponse post = create(author, "제목", null, "글자만 있는 본문", explicit, PostStatus.PUBLISHED, null, null);

        update(post.id(), "제목", null, "이제 이미지가 있다 ![](https://example.com/body.png)", null, null, null, null);

        assertThat(queries.getPostById(post.id(), author).post().thumbnailUrl()).isEqualTo(explicit);
    }

    @Test
    @DisplayName("임시저장 글만 쓰는 태그는 공개 태그 글 수에 잡히지 않는다")
    void tagCountIgnoresDrafts() {
        DoroUser author = newUser("tagdraft");
        String tag = unique();
        create(author, "초안", null, "본문", null, PostStatus.DRAFT, null, List.of(tag));

        int count = tagRepository.findByName(tag).map(t -> t.getPostCount()).orElse(0);

        assertThat(count).as("공개 피드에는 이 태그의 글이 0개인데 태그 글 수가 다르면 비공개 정보가 새고 숫자가 어긋난다").isZero();
    }

    @Test
    @DisplayName("저장될 때 정규화되는 태그(Node.js)로 피드를 걸러도 같은 정규화가 적용된다")
    void feedFilterUsesSameNormalizationAsStorage() {
        DoroUser author = newUser("norm");
        String suffix = unique();
        // 저장 규칙에 따라 "Node.js" 는 "nodejs" 로 저장된다
        create(author, "노드 글 " + suffix, null, "본문 " + suffix, null, PostStatus.PUBLISHED, null, List.of("Node.js" + suffix));

        long byRaw = queries.getFeed("latest", List.of("Node.js" + suffix), 0, 10).getTotalElements();
        long byStored = queries.getFeed("latest", List.of("nodejs" + suffix), 0, 10).getTotalElements();

        assertThat(byStored).as("저장된 이름으로는 찾아진다").isEqualTo(1);
        assertThat(byRaw).as("입력한 그대로(Node.js)로도 같은 글이 찾아져야 한다").isEqualTo(1);
    }

    @Test
    @DisplayName("태그 필터에서도 인기순 정렬이 적용된다")
    void popularSortAppliesWithTagFilter() {
        DoroUser author = newUser("pop");
        DoroUser fan = newUser("fan");
        String tag = unique();
        PostSummaryResponse older = create(author, "오래된 글", null, "본문 1", null, PostStatus.PUBLISHED, null, List.of(tag));
        create(author, "새 글", null, "본문 2", null, PostStatus.PUBLISHED, null, List.of(tag));
        likes.toggleLike(older.id(), fan);

        var page = queries.getFeed("popular", List.of(tag), 0, 10);

        assertThat(page.getContent()).extracting(p -> p.title()).first().isEqualTo("오래된 글");
    }

    @Test
    @DisplayName("요약을 직접 쓰지 않은 글은 본문을 고치면 요약도 새 본문에서 다시 만든다")
    void generatedSummaryFollowsContent() {
        DoroUser author = newUser("autosum");
        PostSummaryResponse post = create(author, "제목", null, "처음 본문입니다", null, PostStatus.PUBLISHED, null, null);

        update(post.id(), "제목", null, "바뀐 본문입니다", null, null, null, null);

        assertThat(queries.getPostById(post.id(), author).post().summary()).isEqualTo("바뀐 본문입니다");
    }

    @Test
    @DisplayName("본문 첫 이미지에서 자동으로 뽑은 썸네일은 본문이 바뀌면 따라가고, 이미지가 없어지면 비워진다")
    void derivedThumbnailFollowsContent() {
        DoroUser author = newUser("autothumb");
        PostSummaryResponse post = create(author, "제목", null, "![](https://example.com/one.png)", null, PostStatus.PUBLISHED, null, null);
        assertThat(post.thumbnailUrl()).isEqualTo("https://example.com/one.png");

        update(post.id(), "제목", null, "![](https://example.com/two.png)", null, null, null, null);
        assertThat(queries.getPostById(post.id(), author).post().thumbnailUrl()).isEqualTo("https://example.com/two.png");

        update(post.id(), "제목", null, "이미지가 없는 본문", null, null, null, null);
        assertThat(queries.getPostById(post.id(), author).post().thumbnailUrl()).isNull();
    }

    @Test
    @DisplayName("removeFromSeries 로 분명히 요청하면 글이 시리즈에서 빠지고 글 수가 줄어든다")
    void removeFromSeriesIsExplicit() {
        DoroUser author = newUser("detach");
        UUID series = newSeries(author);
        PostSummaryResponse post = create(author, "제목", null, "본문", null, PostStatus.PUBLISHED, series, null);

        updateRemovingSeries(post.id(), "제목");

        assertThat(queries.getPostById(post.id(), author).post().seriesId()).isNull();
        assertThat(seriesService.getSeriesDetail(series, author).series().postCount()).isZero();
    }

    @Test
    @DisplayName("태그 글 수는 공개 여부가 바뀔 때 따라 움직이고, 지울 때는 공개 글일 때만 줄어든다")
    void tagCountFollowsVisibility() {
        DoroUser author = newUser("tagflow");
        String tag = unique();
        PostSummaryResponse post = create(author, "글", null, "본문", null, PostStatus.DRAFT, null, List.of(tag));
        assertThat(tagCount(tag)).isZero();

        update(post.id(), "글", null, null, null, PostStatus.PUBLISHED, null, null);
        assertThat(tagCount(tag)).isEqualTo(1);

        update(post.id(), "글", null, null, null, PostStatus.PRIVATE, null, null);
        assertThat(tagCount(tag)).isZero();

        update(post.id(), "글", null, null, null, PostStatus.PUBLISHED, null, List.of(tag));
        assertThat(tagCount(tag)).isEqualTo(1);

        commands.deletePost(post.id());
        assertThat(tagCount(tag)).isZero();
    }

    @Test
    @DisplayName("비공개 글을 지워도 태그 글 수가 줄어들지 않는다 (처음부터 세지 않았다)")
    void deletingNonPublicPostDoesNotChangeCount() {
        DoroUser author = newUser("deldraft");
        String tag = unique();
        PostSummaryResponse published = create(author, "공개", null, "본문", null, PostStatus.PUBLISHED, null, List.of(tag));
        PostSummaryResponse draft = create(author, "초안", null, "본문", null, PostStatus.DRAFT, null, List.of(tag));
        assertThat(tagCount(tag)).isEqualTo(1);

        commands.deletePost(draft.id());

        assertThat(tagCount(tag)).isEqualTo(1);
        assertThat(published.id()).isNotNull();
    }

    @Test
    @DisplayName("글이 없는 태그는 인기 태그 목록에 오르지 않는다")
    void popularTagsSkipEmptyTags() {
        DoroUser author = newUser("emptytag");
        String tag = unique();
        PostSummaryResponse post = create(author, "글", null, "본문", null, PostStatus.PUBLISHED, null, List.of(tag));
        commands.deletePost(post.id());

        assertThat(tagService.getPopularTags()).extracting(t -> t.name()).doesNotContain(tag);
    }
}

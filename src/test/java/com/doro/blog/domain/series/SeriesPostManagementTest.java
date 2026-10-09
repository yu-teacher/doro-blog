package com.doro.blog.domain.series;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.apikey.dto.ApiKeyDtos.CreateApiKeyRequest;
import com.doro.blog.domain.apikey.service.ApiKeyService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.series.dto.SeriesDtos.CreateSeriesRequest;
import com.doro.blog.domain.series.dto.SeriesDtos.SeriesDetailResponse;
import com.doro.blog.domain.series.dto.SeriesDtos.SeriesResponse;
import com.doro.blog.domain.series.service.SeriesService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 이미 있는 글을 시리즈에 추가하거나 빼는 기능. 번호는 항상 1..n 으로 이어지고 글 수가 맞아야 한다. */
@SpringBootTest
@AutoConfigureMockMvc
class SeriesPostManagementTest {

    private static final String HEADER = "X-API-Key";

    @Autowired private PostCommandService postCommands;
    @Autowired private SeriesService seriesService;
    @Autowired private ApiKeyService apiKeyService;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private MockMvc mockMvc;

    private DoroUser newUser() {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, "sp_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private SeriesResponse newSeries(DoroUser owner, String title) {
        return seriesService.createSeries(owner, new CreateSeriesRequest(title, null, null, null));
    }

    private PostSummaryResponse newPost(DoroUser author, String title, PostStatus status, UUID seriesId) {
        return postCommands.createPost(author, new CreatePostRequest(title, null, null, "본문", null, status, seriesId, null));
    }

    private List<UUID> orderOf(SeriesDetailResponse detail) {
        return detail.posts().stream().map(p -> p.id()).toList();
    }

    private int storedOrder(UUID postId) {
        return jdbc.queryForObject("select series_order from posts where id = ?", Integer.class, postId);
    }

    @Test
    @DisplayName("시리즈에 속하지 않은 글(임시저장 포함)을 추가하면 마지막 회차가 되고 글 수가 늘어난다")
    void addAppendsAtTheEnd() {
        DoroUser owner = newUser();
        SeriesResponse series = newSeries(owner, "추가");
        PostSummaryResponse first = newPost(owner, "1회", PostStatus.PUBLISHED, series.id());
        PostSummaryResponse loose = newPost(owner, "독립 임시저장", PostStatus.DRAFT, null);

        SeriesDetailResponse detail = seriesService.addPost(series.id(), loose.id());

        assertThat(orderOf(detail)).containsExactly(first.id(), loose.id());
        assertThat(detail.series().postCount()).isEqualTo(2);
        assertThat(storedOrder(loose.id())).isEqualTo(2);
    }

    @Test
    @DisplayName("이미 이 시리즈에 있는 글을 다시 추가해도 아무것도 바뀌지 않는다")
    void addingTwiceIsIdempotent() {
        DoroUser owner = newUser();
        SeriesResponse series = newSeries(owner, "멱등");
        PostSummaryResponse p = newPost(owner, "1회", PostStatus.PUBLISHED, series.id());

        SeriesDetailResponse detail = seriesService.addPost(series.id(), p.id());

        assertThat(orderOf(detail)).containsExactly(p.id());
        assertThat(detail.series().postCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("다른 시리즈에 속한 글은 거부한다(먼저 빼야 한다)")
    void postInAnotherSeriesIsRejected() {
        DoroUser owner = newUser();
        SeriesResponse a = newSeries(owner, "A");
        SeriesResponse b = newSeries(owner, "B");
        PostSummaryResponse inA = newPost(owner, "A-1", PostStatus.PUBLISHED, a.id());

        assertThatThrownBy(() -> seriesService.addPost(b.id(), inA.id()))
                .isInstanceOfSatisfying(BlogException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
        assertThat(jdbc.queryForObject("select series_id from posts where id = ?", UUID.class, inA.id())).isEqualTo(a.id());
    }

    @Test
    @DisplayName("남의 글은 내 시리즈에 추가할 수 없고, 없는 글은 404")
    void foreignAndMissingPostsAreRejected() {
        DoroUser owner = newUser();
        DoroUser other = newUser();
        SeriesResponse series = newSeries(owner, "내 시리즈");
        PostSummaryResponse foreign = newPost(other, "남의 글", PostStatus.PUBLISHED, null);

        assertThatThrownBy(() -> seriesService.addPost(series.id(), foreign.id()))
                .isInstanceOfSatisfying(BlogException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.ACCESS_DENIED));
        assertThatThrownBy(() -> seriesService.addPost(series.id(), UUID.randomUUID()))
                .isInstanceOfSatisfying(BlogException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.POST_NOT_FOUND));
    }

    @Test
    @DisplayName("가운데 글을 빼면 남은 글의 회차가 1..n 으로 다시 이어지고 글 수가 줄어든다")
    void removeCompactsTheNumbers() {
        DoroUser owner = newUser();
        SeriesResponse series = newSeries(owner, "빼기");
        PostSummaryResponse p1 = newPost(owner, "1회", PostStatus.PUBLISHED, series.id());
        PostSummaryResponse p2 = newPost(owner, "2회", PostStatus.PUBLISHED, series.id());
        PostSummaryResponse p3 = newPost(owner, "3회", PostStatus.DRAFT, series.id());

        SeriesDetailResponse detail = seriesService.removePost(series.id(), p2.id());

        assertThat(orderOf(detail)).containsExactly(p1.id(), p3.id());
        assertThat(storedOrder(p1.id())).isEqualTo(1);
        assertThat(storedOrder(p3.id())).isEqualTo(2);
        assertThat(detail.series().postCount()).isEqualTo(2);
        assertThat(jdbc.queryForObject("select series_id from posts where id = ?", UUID.class, p2.id())).isNull();
        assertThat(jdbc.queryForObject("select series_order from posts where id = ?", Integer.class, p2.id())).isNull();
    }

    @Test
    @DisplayName("이 시리즈에 속하지 않은 글을 빼려 하면 거부한다")
    void removingAPostFromTheWrongSeriesIsRejected() {
        DoroUser owner = newUser();
        SeriesResponse a = newSeries(owner, "A");
        SeriesResponse b = newSeries(owner, "B");
        PostSummaryResponse inA = newPost(owner, "A-1", PostStatus.PUBLISHED, a.id());

        assertThatThrownBy(() -> seriesService.removePost(b.id(), inA.id()))
                .isInstanceOfSatisfying(BlogException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
        assertThat(jdbc.queryForObject("select series_id from posts where id = ?", UUID.class, inA.id())).isEqualTo(a.id());
    }

    @Test
    @DisplayName("시리즈 주인이 아닌 사람이 HTTP 로 글을 추가하려 하면 403 (제거는 API 키로 DELETE 를 못 쓰므로 같은 @DoroGuard 로 보호되는 정렬·삭제 경로와 같다)")
    void nonOwnerCannotManageThroughHttp() throws Exception {
        DoroUser owner = newUser();
        DoroUser stranger = newUser();
        SeriesResponse series = newSeries(owner, "남의 시리즈");
        PostSummaryResponse strangersPost = newPost(stranger, "내 글", PostStatus.PUBLISHED, null);
        PostSummaryResponse ownersPost = newPost(owner, "주인 글", PostStatus.PUBLISHED, series.id());
        int before = jdbc.queryForObject("select count(*) from posts where series_id = ?", Integer.class, series.id());
        String key = apiKeyService.createApiKey(stranger, new CreateApiKeyRequest("series-mgmt", 1)).apiKey();

        mockMvc.perform(post("/api/v1/series/" + series.id() + "/posts").header(HEADER, key)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"postId\":\"" + strangersPost.id() + "\"}"))
                .andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("select count(*) from posts where series_id = ?", Integer.class, series.id())).isEqualTo(before);
        assertThat(jdbc.queryForObject("select series_id from posts where id = ?", UUID.class, strangersPost.id())).isNull();
        assertThat(jdbc.queryForObject("select series_id from posts where id = ?", UUID.class, ownersPost.id())).isEqualTo(series.id());
    }

    @Test
    @DisplayName("주인은 HTTP 로 글을 추가할 수 있다")
    void ownerCanAddThroughHttp() throws Exception {
        DoroUser owner = newUser();
        SeriesResponse series = newSeries(owner, "HTTP");
        PostSummaryResponse loose = newPost(owner, "독립 글", PostStatus.PUBLISHED, null);
        String key = apiKeyService.createApiKey(owner, new CreateApiKeyRequest("series-mgmt-owner", 1)).apiKey();

        mockMvc.perform(post("/api/v1/series/" + series.id() + "/posts").header(HEADER, key)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"postId\":\"" + loose.id() + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.posts[0].id").value(loose.id().toString()));
    }
}

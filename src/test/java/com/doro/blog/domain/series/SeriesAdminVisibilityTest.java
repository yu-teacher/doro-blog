package com.doro.blog.domain.series;

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

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 시리즈에서 임시저장·비공개 글은 주인만 본다. 관리자도 글 자체는 열 수 없으므로(Guard viewer 에 관리자가 없다)
 * 시리즈 목록에서만 제목·요약이 보이면 눌러도 열리지 않는 항목이 생긴다.
 */
@SpringBootTest
class SeriesAdminVisibilityTest {

    @Autowired private PostCommandService postCommands;
    @Autowired private SeriesService seriesService;

    private DoroUser user(String role) {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, "sav_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, role);
    }

    private PostSummaryResponse post(DoroUser author, String title, PostStatus status, UUID seriesId) {
        return postCommands.createPost(author, new CreatePostRequest(title, null, null, "본문", null, status, seriesId, null));
    }

    @Test
    @DisplayName("관리자가 남의 시리즈를 보면 공개 글만 보이고 글 수도 공개 글 기준이다 (주인은 전부 본다)")
    void adminSeesOnlyPublishedPostsOfSomeoneElsesSeries() {
        DoroUser owner = user("USER");
        DoroUser admin = user("ADMIN");
        SeriesResponse series = seriesService.createSeries(owner, new CreateSeriesRequest("비공개 섞인 시리즈", null, null, null));
        PostSummaryResponse open = post(owner, "공개", PostStatus.PUBLISHED, series.id());
        post(owner, "임시저장", PostStatus.DRAFT, series.id());
        post(owner, "비공개", PostStatus.PRIVATE, series.id());

        SeriesDetailResponse asAdmin = seriesService.getSeriesDetail(series.id(), admin);
        SeriesDetailResponse asOwner = seriesService.getSeriesDetail(series.id(), owner);

        assertThat(asAdmin.posts()).extracting(p -> p.id()).containsExactly(open.id());
        assertThat(asAdmin.series().postCount()).isEqualTo(1);
        assertThat(asOwner.posts()).hasSize(3);
        assertThat(asOwner.series().postCount()).isEqualTo(3);
    }

    @Test
    @DisplayName("관리자가 보는 작성자의 시리즈 목록의 글 수도 공개 글 기준이다")
    void adminSeesPublishedCountInTheSeriesList() {
        DoroUser owner = user("USER");
        DoroUser admin = user("ADMIN");
        SeriesResponse series = seriesService.createSeries(owner, new CreateSeriesRequest("목록", null, null, null));
        post(owner, "공개", PostStatus.PUBLISHED, series.id());
        post(owner, "임시저장", PostStatus.DRAFT, series.id());
        String username = postCommands.createPost(owner, new CreatePostRequest("독립", null, null, "본문", null, PostStatus.PUBLISHED, null, null)).username();

        List<SeriesResponse> asAdmin = seriesService.getSeriesByUsername(username, admin);
        List<SeriesResponse> asOwner = seriesService.getSeriesByUsername(username, owner);

        assertThat(asAdmin).extracting(SeriesResponse::postCount).containsExactly(1);
        assertThat(asOwner).extracting(SeriesResponse::postCount).containsExactly(2);
    }
}

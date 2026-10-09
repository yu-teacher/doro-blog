package com.doro.blog.domain.series;

import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.series.dto.SeriesDtos.CreateSeriesRequest;
import com.doro.blog.domain.series.dto.SeriesDtos.SeriesResponse;
import com.doro.blog.domain.series.dto.SeriesDtos.UpdateSeriesRequest;
import com.doro.blog.domain.series.service.SeriesService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** 시리즈 정보 수정·삭제 화면이 기대는 서버 동작: 주소 유지, 설명 지우기, 삭제해도 글은 남음. */
@SpringBootTest
class SeriesEditTest {

    @Autowired private SeriesService seriesService;
    @Autowired private PostCommandService postCommands;
    @Autowired private JdbcTemplate jdbc;

    private DoroUser newUser() {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, "se_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    @Test
    @DisplayName("제목·설명만 보내 수정하면 주소(슬러그)와 썸네일은 그대로다")
    void updatingTitleAndDescriptionKeepsTheSlugAndThumbnail() {
        DoroUser owner = newUser();
        SeriesResponse created = seriesService.createSeries(owner,
                new CreateSeriesRequest("원래 제목", null, "원래 설명", "/media/thumbnails/2026/10/" + UUID.randomUUID() + ".png"));

        SeriesResponse updated = seriesService.updateSeries(created.id(), new UpdateSeriesRequest("새 제목", null, "새 설명", null));

        assertThat(updated.title()).isEqualTo("새 제목");
        assertThat(updated.description()).isEqualTo("새 설명");
        assertThat(updated.slug()).isEqualTo(created.slug());
        assertThat(updated.thumbnailUrl()).isEqualTo(created.thumbnailUrl());
    }

    @Test
    @DisplayName("설명을 빈 문자열로 보내면 지워지고, 생략(null)하면 그대로 남는다")
    void emptyDescriptionClearsAndNullKeeps() {
        DoroUser owner = newUser();
        SeriesResponse created = seriesService.createSeries(owner, new CreateSeriesRequest("제목", null, "지울 설명", null));

        SeriesResponse kept = seriesService.updateSeries(created.id(), new UpdateSeriesRequest("제목", null, null, null));
        assertThat(kept.description()).isEqualTo("지울 설명");

        SeriesResponse cleared = seriesService.updateSeries(created.id(), new UpdateSeriesRequest("제목", null, "", null));
        assertThat(cleared.description()).isEmpty();
    }

    @Test
    @DisplayName("시리즈를 삭제하면 시리즈만 사라지고 안의 글(임시저장 포함)은 독립된 글로 남는다")
    void deletingASeriesKeepsItsPosts() {
        DoroUser owner = newUser();
        SeriesResponse series = seriesService.createSeries(owner, new CreateSeriesRequest("지울 시리즈", null, null, null));
        PostSummaryResponse published = postCommands.createPost(owner,
                new CreatePostRequest("공개", null, null, "본문", null, PostStatus.PUBLISHED, series.id(), null));
        PostSummaryResponse draft = postCommands.createPost(owner,
                new CreatePostRequest("임시", null, null, "본문", null, PostStatus.DRAFT, series.id(), null));

        seriesService.deleteSeries(series.id());

        assertThat(jdbc.queryForObject("select count(*) from series where id = ?", Integer.class, series.id())).isZero();
        for (UUID postId : new UUID[]{published.id(), draft.id()}) {
            assertThat(jdbc.queryForObject("select count(*) from posts where id = ?", Integer.class, postId)).isEqualTo(1);
            assertThat(jdbc.queryForObject("select series_id from posts where id = ?", UUID.class, postId)).isNull();
            assertThat(jdbc.queryForObject("select series_order from posts where id = ?", Integer.class, postId)).isNull();
        }
    }
}

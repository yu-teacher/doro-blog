package com.doro.blog.domain.series;

import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.series.dto.SeriesDtos.CreateSeriesRequest;
import com.doro.blog.domain.series.dto.SeriesDtos.SeriesResponse;
import com.doro.blog.domain.series.service.SeriesService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 한 시리즈 안에서 같은 회차 번호를 두 글이 가질 수 없다(DB 제약). 정렬(맞바꾸기)은 한 트랜잭션 안이라 계속 가능하다. */
@SpringBootTest
class SeriesOrderUniqueTest {

    @Autowired private PostCommandService postCommands;
    @Autowired private SeriesService seriesService;
    @Autowired private JdbcTemplate jdbc;

    private DoroUser newUser() {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, "so_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private PostSummaryResponse postIn(DoroUser author, UUID seriesId, String title) {
        return postCommands.createPost(author, new CreatePostRequest(title, null, null, "본문", null, PostStatus.PUBLISHED, seriesId, null));
    }

    @Test
    @DisplayName("같은 시리즈의 두 글에 같은 회차 번호를 직접 넣으면 DB 가 거부한다")
    void duplicateOrderInOneSeriesIsRejected() {
        DoroUser author = newUser();
        SeriesResponse series = seriesService.createSeries(author, new CreateSeriesRequest("시리즈", null, null, null));
        PostSummaryResponse first = postIn(author, series.id(), "1회");
        PostSummaryResponse second = postIn(author, series.id(), "2회");

        assertThatThrownBy(() -> jdbc.update("update posts set series_order = 1 where id = ?", second.id()))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("select series_order from posts where id = ?", Integer.class, first.id())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select series_order from posts where id = ?", Integer.class, second.id())).isEqualTo(2);
    }

    @Test
    @DisplayName("다른 시리즈나 시리즈에 속하지 않은 글은 같은 번호를 가져도 된다")
    void sameNumberInOtherSeriesIsFine() {
        DoroUser author = newUser();
        SeriesResponse a = seriesService.createSeries(author, new CreateSeriesRequest("A", null, null, null));
        SeriesResponse b = seriesService.createSeries(author, new CreateSeriesRequest("B", null, null, null));
        postIn(author, a.id(), "A-1");
        PostSummaryResponse b1 = postIn(author, b.id(), "B-1");
        postIn(author, null, "독립 글 1");
        postIn(author, null, "독립 글 2");

        assertThat(jdbc.queryForObject("select series_order from posts where id = ?", Integer.class, b1.id())).isEqualTo(1);
    }

    @Test
    @DisplayName("정렬로 회차 번호를 서로 맞바꿔도(트랜잭션 안에서 잠시 겹침) 커밋은 성공한다")
    void reorderSwapStillWorks() {
        DoroUser author = newUser();
        SeriesResponse series = seriesService.createSeries(author, new CreateSeriesRequest("정렬", null, null, null));
        PostSummaryResponse p1 = postIn(author, series.id(), "1회");
        PostSummaryResponse p2 = postIn(author, series.id(), "2회");
        PostSummaryResponse p3 = postIn(author, series.id(), "3회");

        seriesService.reorderPosts(series.id(), List.of(p3.id(), p1.id(), p2.id()));

        assertThat(jdbc.queryForObject("select series_order from posts where id = ?", Integer.class, p3.id())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select series_order from posts where id = ?", Integer.class, p1.id())).isEqualTo(2);
        assertThat(jdbc.queryForObject("select series_order from posts where id = ?", Integer.class, p2.id())).isEqualTo(3);
    }
}

package com.doro.blog.domain.series;

import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.series.dto.SeriesDtos.CreateSeriesRequest;
import com.doro.blog.domain.series.service.SeriesService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import com.doro.blog.domain.user.service.UsernamePolicy;

/** 시리즈 목록의 쿼리 수가 시리즈 개수와 무관하다(시리즈마다 공개 글 수를 따로 세던 N+1 방지). */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
class SeriesListQueryCountTest {

    @Autowired private SeriesService seriesService;
    @Autowired private PostCommandService commands;
    @Autowired private EntityManagerFactory entityManagerFactory;

    private DoroUser newUser() {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, "slist_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private static String usernameOf(DoroUser user) {
        return UsernamePolicy.generated(user.userId());
    }

    private void addSeries(DoroUser author, int count) {
        for (int i = 0; i < count; i++) {
            UUID series = seriesService.createSeries(author, new CreateSeriesRequest("s" + UUID.randomUUID(), null, null, null)).id();
            commands.createPost(author, new CreatePostRequest("글 " + UUID.randomUUID(), null, null, "본문", null, PostStatus.PUBLISHED, series, null));
        }
    }

    private long statementsForPublicList(DoroUser author) {
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        var list = seriesService.getSeriesByUsername(usernameOf(author), null);
        assertThat(list).allSatisfy(s -> assertThat(s.postCount()).isEqualTo(1));
        return stats.getPrepareStatementCount();
    }

    @Test
    @DisplayName("비로그인으로 시리즈 목록을 볼 때 쿼리 수는 시리즈 개수와 무관하다")
    void publicSeriesListQueryCountIsConstant() {
        DoroUser few = newUser();
        DoroUser many = newUser();
        addSeries(few, 2);
        addSeries(many, 12);

        long fewStatements = statementsForPublicList(few);
        long manyStatements = statementsForPublicList(many);

        assertThat(manyStatements).as("시리즈 2개일 때 %d 쿼리, 12개일 때 %d 쿼리", fewStatements, manyStatements).isEqualTo(fewStatements);
    }
}

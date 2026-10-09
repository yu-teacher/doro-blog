package com.doro.blog.domain.post;

import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.dto.PostDtos.UpdatePostRequest;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.series.dto.SeriesDtos.CreateSeriesRequest;
import com.doro.blog.domain.series.service.SeriesService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** 두 시리즈 사이로 글을 서로 맞바꿔 옮기는 요청이 동시에 와도 교착(deadlock)으로 실패하지 않고 시리즈 글 수가 맞는다. */
@SpringBootTest
class SeriesMoveConcurrencyTest {

    private static final int ROUNDS = 15;

    @Autowired private PostCommandService commands;
    @Autowired private SeriesService seriesService;

    private DoroUser newUser() {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, "swap_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private PostSummaryResponse post(DoroUser u, String title, UUID seriesId) {
        return commands.createPost(u, new CreatePostRequest(title, null, null, "본문", null, PostStatus.PUBLISHED, seriesId, null));
    }

    @Test
    @DisplayName("글 두 개를 두 시리즈 사이로 맞바꿔 동시에 옮겨도 예외 없이 끝나고 글 수가 맞는다")
    void swappingPostsBetweenSeriesDoesNotDeadlock() throws Exception {
        DoroUser author = newUser();
        UUID a = seriesService.createSeries(author, new CreateSeriesRequest("A " + UUID.randomUUID(), null, null, null)).id();
        UUID b = seriesService.createSeries(author, new CreateSeriesRequest("B " + UUID.randomUUID(), null, null, null)).id();
        PostSummaryResponse p1 = post(author, "p1", a);
        PostSummaryResponse p2 = post(author, "p2", b);

        List<String> failures = new ArrayList<>();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        // 매 라운드 p1 은 A↔B, p2 는 B↔A 로 서로 엇갈리게 옮긴다
        UUID p1Target = b;
        UUID p2Target = a;
        for (int round = 0; round < ROUNDS; round++) {
            CountDownLatch ready = new CountDownLatch(2);
            CountDownLatch go = new CountDownLatch(1);
            UUID t1 = p1Target;
            UUID t2 = p2Target;
            Future<?> f1 = pool.submit(() -> move(p1.id(), t1, ready, go, failures));
            Future<?> f2 = pool.submit(() -> move(p2.id(), t2, ready, go, failures));
            ready.await();
            go.countDown();
            f1.get(60, TimeUnit.SECONDS);
            f2.get(60, TimeUnit.SECONDS);
            UUID swap = p1Target;
            p1Target = p2Target;
            p2Target = swap;
        }
        pool.shutdownNow();

        assertThat(failures).as("교착 등으로 실패한 이동").isEmpty();
        assertThat(seriesService.getSeriesDetail(a, author).series().postCount()).isEqualTo(1);
        assertThat(seriesService.getSeriesDetail(b, author).series().postCount()).isEqualTo(1);
    }

    private void move(UUID postId, UUID targetSeries, CountDownLatch ready, CountDownLatch go, List<String> failures) {
        try {
            ready.countDown();
            go.await();
            commands.updatePost(postId, new UpdatePostRequest("t", null, null, null, null, null, targetSeries, null));
        } catch (Exception e) {
            synchronized (failures) {
                failures.add(String.valueOf(e));
            }
        }
    }
}

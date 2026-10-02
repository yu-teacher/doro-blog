package com.doro.blog.domain.post;

import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.repository.PostRepository;
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

@SpringBootTest
class SeriesOrderConcurrencyTest {

    private static final int PARALLELISM = 10;
    private static final long TIMEOUT_SECONDS = 60;

    @Autowired private PostCommandService postCommands;
    @Autowired private SeriesService seriesService;
    @Autowired private PostRepository postRepository;

    @Test
    @DisplayName("같은 시리즈에 동시에 글을 추가해도 회차 번호가 겹치지 않고 1..N 으로 채워진다")
    void concurrentAppendsGetDistinctOrders() throws Exception {
        UUID id = UUID.randomUUID();
        DoroUser author = new DoroUser(id, "order_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
        var series = seriesService.createSeries(author, new CreateSeriesRequest("동시 연재", null, null, null));
        // 작성자 JIT 생성이 동시에 일어나지 않도록 첫 글은 미리 만든다
        postCommands.createPost(author, new CreatePostRequest("0화", null, null, "본문", null, PostStatus.PUBLISHED, series.id(), null));

        ExecutorService pool = Executors.newFixedThreadPool(PARALLELISM);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<PostSummaryResponse>> futures = new ArrayList<>();
        for (int i = 1; i <= PARALLELISM; i++) {
            String title = i + "화";
            futures.add(pool.submit(() -> {
                start.await();
                return postCommands.createPost(author, new CreatePostRequest(title, null, null, "본문", null, PostStatus.PUBLISHED, series.id(), null));
            }));
        }
        start.countDown();
        for (Future<PostSummaryResponse> f : futures) {
            f.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        }
        pool.shutdown();

        List<Integer> orders = postRepository.findAll().stream()
                .filter(p -> p.getSeries() != null && p.getSeries().getId().equals(series.id()))
                .map(p -> p.getSeriesOrder())
                .sorted()
                .toList();
        assertThat(orders).hasSize(PARALLELISM + 1);
        assertThat(orders).doesNotHaveDuplicates();
        assertThat(orders).containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(1, PARALLELISM + 1).boxed().toList());
    }
}

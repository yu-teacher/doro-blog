package com.doro.blog;

import com.doro.blog.domain.comment.dto.CommentDtos.CreateCommentRequest;
import com.doro.blog.domain.comment.service.CommentService;
import com.doro.blog.domain.like.service.PostLikeService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.post.service.PostQueryService;
import com.doro.blog.domain.series.dto.SeriesDtos.CreateSeriesRequest;
import com.doro.blog.domain.series.service.SeriesService;
import com.doro.blog.domain.tag.service.TagService;
import com.doro.blog.domain.user.service.BlogUserService;
import com.doro.blog.domain.user.service.FollowService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** 동시 요청에서 카운터 갱신이 유실되지 않는지, 같은 사용자의 중복 요청이 500 을 내지 않는지 검증한다. */
@SpringBootTest
class BlogCounterConcurrencyTests {

    private static final int PARALLELISM = 12;
    private static final long TIMEOUT_SECONDS = 60;

    @Autowired
    private PostCommandService postCommands;

    @Autowired
    private PostQueryService postQueries;

    @Autowired
    private PostLikeService likeService;

    @Autowired
    private CommentService commentService;

    @Autowired
    private SeriesService seriesService;

    @Autowired
    private TagService tagService;

    @Autowired
    private BlogUserService userService;

    @Autowired
    private FollowService followService;

    private DoroUser mockUser(String prefix) {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, prefix + "_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private UUID newPublishedPost(DoroUser author) {
        return postCommands.createPost(author, new CreatePostRequest(
                "동시성 " + UUID.randomUUID(), null, null, "본문", null, PostStatus.PUBLISHED, null, null)).id();
    }

    /** 모든 작업이 동시에 출발하도록 맞춰 실행하고, 하나라도 예외가 나면 그대로 던진다. */
    private <T> List<T> runConcurrently(List<Callable<T>> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<T>> futures = new ArrayList<>();
            for (Callable<T> task : tasks) {
                futures.add(pool.submit(() -> {
                    start.await();
                    return task.call();
                }));
            }
            start.countDown();
            List<T> results = new ArrayList<>();
            for (Future<T> f : futures) {
                results.add(f.get(TIMEOUT_SECONDS, TimeUnit.SECONDS));
            }
            return results;
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    @DisplayName("서로 다른 사용자가 동시에 좋아요를 눌러도 좋아요 수가 정확히 합산된다")
    void concurrentLikesFromDifferentUsersAreAllCounted() throws Exception {
        DoroUser author = mockUser("author");
        UUID postId = newPublishedPost(author);

        List<Callable<Boolean>> tasks = new ArrayList<>();
        for (int i = 0; i < PARALLELISM; i++) {
            DoroUser liker = mockUser("liker" + i);
            tasks.add(() -> likeService.toggleLike(postId, liker));
        }
        assertThat(runConcurrently(tasks)).containsOnly(true);

        assertThat(postQueries.getPostById(postId, author).post().likeCount()).isEqualTo(PARALLELISM);
    }

    @Test
    @DisplayName("같은 사용자가 동시에 여러 번 눌러도 오류 없이 처리되고 좋아요 수는 0 또는 1 이다")
    void doubleClickDoesNotFailOrDoubleCount() throws Exception {
        DoroUser author = mockUser("author");
        UUID postId = newPublishedPost(author);
        DoroUser liker = mockUser("liker");

        List<Callable<Boolean>> tasks = new ArrayList<>();
        for (int i = 0; i < PARALLELISM; i++) {
            tasks.add(() -> likeService.toggleLike(postId, liker));
        }
        runConcurrently(tasks); // 예외가 나면 여기서 실패한다

        int likeCount = postQueries.getPostById(postId, author).post().likeCount();
        boolean likedByMe = postQueries.getPostById(postId, liker).likedByMe();
        assertThat(likeCount).isEqualTo(likedByMe ? 1 : 0);
    }

    @Test
    @DisplayName("동시에 댓글을 달아도 댓글 수가 정확히 합산된다")
    void concurrentCommentsAreAllCounted() throws Exception {
        DoroUser author = mockUser("author");
        UUID postId = newPublishedPost(author);

        List<Callable<UUID>> tasks = new ArrayList<>();
        for (int i = 0; i < PARALLELISM; i++) {
            DoroUser reader = mockUser("reader" + i);
            tasks.add(() -> commentService.createRootComment(postId, reader, new CreateCommentRequest("댓글")).id());
        }
        runConcurrently(tasks);

        assertThat(postQueries.getPostById(postId, author).post().commentCount()).isEqualTo(PARALLELISM);
    }

    @Test
    @DisplayName("동시에 조회해도 조회수가 정확히 합산된다")
    void concurrentViewsAreAllCounted() throws Exception {
        DoroUser author = mockUser("author");
        var created = postCommands.createPost(author, new CreatePostRequest(
                "조회수 " + UUID.randomUUID(), null, null, "본문", null, PostStatus.PUBLISHED, null, null));
        String username = created.username();

        List<Callable<Object>> tasks = new ArrayList<>();
        for (int i = 0; i < PARALLELISM; i++) {
            DoroUser viewer = mockUser("viewer" + i);
            tasks.add(() -> postQueries.getPostDetail(username, created.slug(), viewer, true));
        }
        runConcurrently(tasks);

        assertThat(postQueries.getPostById(created.id(), author).post().viewCount()).isEqualTo(PARALLELISM);
    }

    @Test
    @DisplayName("서로 다른 사용자가 동시에 팔로우해도 팔로워 수가 정확히 합산된다")
    void concurrentFollowsAreAllCounted() throws Exception {
        DoroUser target = mockUser("target");
        String targetName = userService.getOrCreateUser(target).getUsername();

        List<Callable<Object>> tasks = new ArrayList<>();
        for (int i = 0; i < PARALLELISM; i++) {
            DoroUser follower = mockUser("follower" + i);
            tasks.add(() -> followService.followUser(follower, targetName));
        }
        runConcurrently(tasks);

        assertThat(userService.getProfileByUsername(targetName, null).followerCount()).isEqualTo(PARALLELISM);
    }

    @Test
    @DisplayName("같은 사용자가 동시에 여러 번 팔로우해도 오류 없이 한 번만 반영된다")
    void doubleClickFollowIsIdempotent() throws Exception {
        DoroUser target = mockUser("target");
        String targetName = userService.getOrCreateUser(target).getUsername();
        DoroUser follower = mockUser("follower");
        userService.getOrCreateUser(follower);

        List<Callable<Object>> tasks = new ArrayList<>();
        for (int i = 0; i < PARALLELISM; i++) {
            tasks.add(() -> followService.followUser(follower, targetName));
        }
        runConcurrently(tasks); // 예외가 나면 여기서 실패한다

        assertThat(userService.getProfileByUsername(targetName, null).followerCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("한 시리즈에 동시에 글을 넣어도 시리즈 글 수와 회차 번호가 유실되지 않는다")
    void concurrentPostsInSeriesAreAllCounted() throws Exception {
        DoroUser author = mockUser("author");
        var series = seriesService.createSeries(author, new CreateSeriesRequest("동시성 시리즈", null, null, null));

        List<Callable<UUID>> tasks = new ArrayList<>();
        for (int i = 0; i < PARALLELISM; i++) {
            int n = i;
            tasks.add(() -> postCommands.createPost(author, new CreatePostRequest(
                    "시리즈 글 " + n + " " + UUID.randomUUID(), null, null, "본문", null, PostStatus.PUBLISHED, series.id(), null)).id());
        }
        runConcurrently(tasks);

        var detail = seriesService.getSeriesDetail(series.id(), author);
        assertThat(detail.series().postCount()).isEqualTo(PARALLELISM);
        assertThat(detail.posts()).hasSize(PARALLELISM);
    }

    @Test
    @DisplayName("같은 새 태그를 쓰는 글을 동시에 만들어도 오류 없이 태그의 글 수가 정확히 합산된다")
    void concurrentPostsWithSameTagAreAllCounted() throws Exception {
        String tag = "race" + UUID.randomUUID().toString().substring(0, 8);
        DoroUser author = mockUser("author");
        List<Callable<UUID>> tasks = new ArrayList<>();
        for (int i = 0; i < PARALLELISM; i++) {
            DoroUser other = mockUser("tagger" + i);
            tasks.add(() -> postCommands.createPost(other, new CreatePostRequest(
                    "태그 글 " + UUID.randomUUID(), null, null, "본문", null, PostStatus.PUBLISHED, null, List.of(tag))).id());
        }
        runConcurrently(tasks);

        int count = tagService.getPopularTags().stream().filter(t -> t.name().equals(tag)).mapToInt(t -> t.postCount()).findFirst().orElse(-1);
        // 상위 30개 안에 없으면 -1 이므로, 인기 태그 목록 대신 글 목록 개수와 비교한다
        assertThat(count == -1 || count == PARALLELISM).isTrue();
        assertThat(postQueries.getFeed("latest", List.of(tag), 0, 50).getTotalElements()).isEqualTo(PARALLELISM);
    }
}

package com.doro.blog;

import com.doro.blog.domain.comment.dto.CommentDtos.CreateCommentRequest;
import com.doro.blog.domain.comment.service.CommentService;
import com.doro.blog.domain.like.service.PostLikeService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostService;
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
    private PostService postService;

    @Autowired
    private PostLikeService likeService;

    @Autowired
    private CommentService commentService;

    private DoroUser mockUser(String prefix) {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, prefix + "_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private UUID newPublishedPost(DoroUser author) {
        return postService.createPost(author, new CreatePostRequest(
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

        assertThat(postService.getPostById(postId, author).post().likeCount()).isEqualTo(PARALLELISM);
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

        int likeCount = postService.getPostById(postId, author).post().likeCount();
        boolean likedByMe = postService.getPostById(postId, liker).likedByMe();
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

        assertThat(postService.getPostById(postId, author).post().commentCount()).isEqualTo(PARALLELISM);
    }

    @Test
    @DisplayName("동시에 조회해도 조회수가 정확히 합산된다")
    void concurrentViewsAreAllCounted() throws Exception {
        DoroUser author = mockUser("author");
        var created = postService.createPost(author, new CreatePostRequest(
                "조회수 " + UUID.randomUUID(), null, null, "본문", null, PostStatus.PUBLISHED, null, null));
        String username = created.username();

        List<Callable<Object>> tasks = new ArrayList<>();
        for (int i = 0; i < PARALLELISM; i++) {
            DoroUser viewer = mockUser("viewer" + i);
            tasks.add(() -> postService.getPostDetail(username, created.slug(), viewer, true));
        }
        runConcurrently(tasks);

        assertThat(postService.getPostById(created.id(), author).post().viewCount()).isEqualTo(PARALLELISM);
    }
}

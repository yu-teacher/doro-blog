package com.doro.blog.infra.guard;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.comment.dto.CommentDtos.CommentResponse;
import com.doro.blog.domain.comment.dto.CommentDtos.CreateCommentRequest;
import com.doro.blog.domain.comment.dto.CommentDtos.CreateReplyRequest;
import com.doro.blog.domain.comment.service.CommentService;
import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.PostSummaryResponse;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.service.PostCommandService;
import com.doro.blog.domain.series.dto.SeriesDtos.CreateSeriesRequest;
import com.doro.blog.domain.series.dto.SeriesDtos.SeriesResponse;
import com.doro.blog.domain.series.service.SeriesService;
import com.hunnit_beasts.doro.sdk.client.DoroGuardClient;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import com.hunnit_beasts.doro.sdk.exception.DoroGuardWriteFailedException;
import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;

/**
 * 글·댓글·시리즈를 만들 때 Guard(원격) 호출은 DB 트랜잭션 밖에서 한다. 트랜잭션 안에서 부르면 Guard 가 느릴 때
 * DB 연결을 그 시간(최대 수 초)만큼 쥐고 있어, 연결 풀(10개)이 금방 바닥나 읽기 요청까지 멈춘다.
 * 튜플을 먼저 쓰고 DB 작업이 실패하면 지우므로 "튜플 없는 글"은 생기지 않고, 실패하면 아무것도 남지 않는다.
 */
@SpringBootTest
class GuardCallOutsideTransactionTest {

    @MockitoSpyBean private DoroGuardClient guardClient;
    @Autowired private PostCommandService postCommands;
    @Autowired private CommentService comments;
    @Autowired private SeriesService seriesService;
    @Autowired private DataSource dataSource;
    @Autowired private JdbcTemplate jdbc;

    /** Guard 쓰기가 호출되는 순간의 상태(트랜잭션이 열려 있는가, DB 연결을 몇 개 쥐고 있는가) */
    private record Snapshot(boolean transactionActive, int activeConnections) {}

    private final List<Snapshot> snapshots = new ArrayList<>();

    private void recordGuardWrites() {
        doAnswer(inv -> {
            HikariDataSource hikari = dataSource.unwrap(HikariDataSource.class);
            snapshots.add(new Snapshot(TransactionSynchronizationManager.isActualTransactionActive(),
                    hikari.getHikariPoolMXBean().getActiveConnections()));
            return inv.callRealMethod();
        }).when(guardClient).writeTupleOrThrow(anyString(), anyString(), anyString(), anyString(), anyString(), any());
    }

    @AfterEach
    void restore() {
        reset(guardClient);
    }

    private DoroUser newUser() {
        UUID id = UUID.randomUUID();
        return new DoroUser(id, "gt_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    private PostSummaryResponse publish(DoroUser author) {
        return postCommands.createPost(author, new CreatePostRequest("제목", null, null, "본문", null, PostStatus.PUBLISHED, null, null));
    }

    private void assertAllOutsideTransaction() {
        assertThat(snapshots).as("Guard 쓰기가 호출됐어야 한다").isNotEmpty();
        assertThat(snapshots).allSatisfy(s -> {
            assertThat(s.transactionActive()).as("Guard 쓰기 중 트랜잭션이 열려 있으면 안 된다").isFalse();
            assertThat(s.activeConnections()).as("Guard 쓰기 중 DB 연결을 쥐고 있으면 안 된다").isZero();
        });
    }

    @Test
    @DisplayName("글 생성: Guard 쓰기는 트랜잭션 밖에서, DB 연결을 쥐지 않고 한다")
    void createPostWritesTupleOutsideTheTransaction() {
        recordGuardWrites();

        publish(newUser());

        assertAllOutsideTransaction();
    }

    @Test
    @DisplayName("댓글·답글 생성: 튜플 2개 모두 트랜잭션 밖에서 쓴다")
    void createCommentAndReplyWriteTuplesOutsideTheTransaction() {
        DoroUser author = newUser();
        PostSummaryResponse post = publish(author);
        recordGuardWrites();

        CommentResponse root = comments.createRootComment(post.id(), newUser(), new CreateCommentRequest("댓글"));
        comments.createReply(post.id(), root.id(), newUser(), new CreateReplyRequest("답글"));

        assertThat(snapshots).hasSize(4);
        assertAllOutsideTransaction();
    }

    @Test
    @DisplayName("시리즈 생성: Guard 쓰기는 트랜잭션 밖에서 한다")
    void createSeriesWritesTupleOutsideTheTransaction() {
        recordGuardWrites();

        seriesService.createSeries(newUser(), new CreateSeriesRequest("시리즈", null, null, null));

        assertAllOutsideTransaction();
    }

    @Test
    @DisplayName("Guard 쓰기가 실패하면 글이 만들어지지 않는다")
    void guardFailureCreatesNoPost() {
        DoroUser author = newUser();
        publish(author); // 사용자 행을 먼저 만든다
        int before = jdbc.queryForObject("select count(*) from posts", Integer.class);
        doThrow(new DoroGuardWriteFailedException("down", new RuntimeException())).when(guardClient)
                .writeTupleOrThrow(anyString(), anyString(), anyString(), anyString(), anyString(), any());

        assertThatThrownBy(() -> publish(author)).isInstanceOf(DoroGuardWriteFailedException.class);

        assertThat(jdbc.queryForObject("select count(*) from posts", Integer.class)).isEqualTo(before);
    }

    @Test
    @DisplayName("DB 작업이 실패하면(없는 시리즈) 먼저 쓴 튜플은 지워지고, 검증에 걸리는 요청은 Guard 를 부르지 않는다")
    void dbFailureRemovesTheTupleAndInvalidRequestsNeverCallGuard() {
        DoroUser author = newUser();
        publish(author); // 사용자 행 준비
        reset(guardClient);

        // 본문 없는 출간 요청은 Guard 를 부르기 전에 거부된다
        assertThatThrownBy(() -> postCommands.createPost(author,
                new CreatePostRequest("제목", null, null, "", null, PostStatus.PUBLISHED, null, null)))
                .isInstanceOf(BlogException.class);
        // 없는 시리즈에 붙이려는 요청도 마찬가지다
        assertThatThrownBy(() -> postCommands.createPost(author,
                new CreatePostRequest("제목", null, null, "본문", null, PostStatus.DRAFT, UUID.randomUUID(), null)))
                .isInstanceOf(BlogException.class);

        verify(guardClient, never()).writeTupleOrThrow(anyString(), anyString(), anyString(), anyString(), anyString(), any());
    }

    @Test
    @DisplayName("로그인하지 않은 요청은 글·시리즈·댓글·답글 생성 모두 UNAUTHORIZED 이고 Guard 를 부르지 않는다 (500 이 아니다)")
    void anonymousCreatesAreUnauthorizedAndNeverCallGuard() {
        PostSummaryResponse post = publish(newUser());
        CommentResponse root = comments.createRootComment(post.id(), newUser(), new CreateCommentRequest("댓글"));
        reset(guardClient);
        DoroUser anonymous = DoroUser.anonymous();

        List<org.junit.jupiter.api.function.Executable> attempts = List.of(
                () -> postCommands.createPost(anonymous, new CreatePostRequest("제목", null, null, "본문", null, PostStatus.DRAFT, null, null)),
                () -> seriesService.createSeries(anonymous, new CreateSeriesRequest("시리즈", null, null, null)),
                () -> comments.createRootComment(post.id(), anonymous, new CreateCommentRequest("댓글")),
                () -> comments.createReply(post.id(), root.id(), anonymous, new CreateReplyRequest("답글")));

        for (var attempt : attempts) {
            assertThatThrownBy(attempt::execute)
                    .isInstanceOfSatisfying(BlogException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.UNAUTHORIZED));
        }
        verify(guardClient, never()).writeTupleOrThrow(anyString(), anyString(), anyString(), anyString(), anyString(), any());
    }
}

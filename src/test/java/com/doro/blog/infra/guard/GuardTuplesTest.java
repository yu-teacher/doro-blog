package com.doro.blog.infra.guard;

import com.hunnit_beasts.doro.sdk.client.DoroGuardClient;
import com.hunnit_beasts.doro.sdk.exception.DoroGuardWriteFailedException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GuardTuplesTest {

    private final DoroGuardClient client = mock(DoroGuardClient.class);
    private final GuardTuples tuples = new GuardTuples(client);

    @BeforeEach
    void startTransaction() {
        TransactionSynchronizationManager.initSynchronization();
    }

    @AfterEach
    void endTransaction() {
        TransactionSynchronizationManager.clear();
    }

    /** 트랜잭션 종료를 흉내 낸다: 커밋이면 afterCommit 후 afterCompletion, 롤백이면 afterCompletion 만. */
    private void complete(boolean committed) {
        List<TransactionSynchronization> syncs = TransactionSynchronizationManager.getSynchronizations();
        if (committed) syncs.forEach(TransactionSynchronization::afterCommit);
        syncs.forEach(s -> s.afterCompletion(committed ? TransactionSynchronization.STATUS_COMMITTED : TransactionSynchronization.STATUS_ROLLED_BACK));
    }

    private static final GuardTuples.Tuple AUTHOR = GuardTuples.Tuple.of("blog_post", "p1", "author", "user", "u1");
    private static final GuardTuples.Tuple POST = GuardTuples.Tuple.of("blog_comment", "c1", "post", "blog_post", "p1");

    @Test
    @DisplayName("쓰기는 예외 전파 버전으로 먼저 하고, 그다음에 작업을 실행해 결과를 돌려준다 (튜플이 먼저, 글이 나중)")
    void writesFirstThenRunsTheAction() {
        List<String> order = new ArrayList<>();
        when(client.writeTupleOrThrow(any(), any(), any(), any(), any(), any())).thenAnswer(inv -> {
            order.add("write:" + inv.getArgument(0));
            return 1;
        });

        String result = tuples.writeThen(List.of(AUTHOR, POST), () -> {
            order.add("action");
            return "done";
        });

        assertThat(result).isEqualTo("done");
        assertThat(order).containsExactly("write:blog_post", "write:blog_comment", "action");
        verify(client).writeTupleOrThrow("blog_post", "p1", "author", "user", "u1", null);
        verify(client, never()).deleteTuple(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("작업(DB 트랜잭션)이 실패하면 먼저 쓴 튜플을 모두 지우고 같은 예외를 다시 던진다")
    void actionFailureRemovesAllWrittenTuples() {
        RuntimeException failure = new IllegalStateException("db down");

        assertThatThrownBy(() -> tuples.writeThen(List.of(AUTHOR, POST), () -> { throw failure; })).isSameAs(failure);

        verify(client).deleteTuple("blog_post", "p1", "author", "user", "u1");
        verify(client).deleteTuple("blog_comment", "c1", "post", "blog_post", "p1");
    }

    @Test
    @DisplayName("두 번째 튜플 쓰기가 실패하면 첫 번째는 지우고, 작업은 실행하지 않는다")
    void secondWriteFailureCleansUpTheFirstAndSkipsTheAction() {
        when(client.writeTupleOrThrow(eq("blog_comment"), any(), any(), any(), any(), any()))
                .thenThrow(new DoroGuardWriteFailedException("down", new RuntimeException()));
        boolean[] ran = {false};

        assertThatThrownBy(() -> tuples.writeThen(List.of(AUTHOR, POST), () -> { ran[0] = true; return null; }))
                .isInstanceOf(DoroGuardWriteFailedException.class);

        assertThat(ran[0]).as("튜플이 없으면 글을 만들지 않는다").isFalse();
        verify(client).deleteTuple("blog_post", "p1", "author", "user", "u1");
        verify(client, never()).deleteTuple(eq("blog_comment"), any(), any(), any(), any());
    }

    @Test
    @DisplayName("정리(삭제) 자체가 실패해도 원래 예외를 가리지 않는다")
    void cleanupFailureDoesNotHideTheOriginalException() {
        when(client.deleteTuple(any(), any(), any(), any(), any())).thenThrow(new RuntimeException("guard down"));
        RuntimeException failure = new IllegalStateException("db down");

        assertThatThrownBy(() -> tuples.writeThen(List.of(AUTHOR), () -> { throw failure; })).isSameAs(failure);
    }

    @Test
    @DisplayName("삭제는 커밋 전에는 실행되지 않고 커밋 후에만 실행된다")
    void deleteWaitsForCommit() {
        tuples.deleteAfterCommit("blog_post", "p1", "author", "user", "u1");
        verify(client, never()).deleteTuple(any(), any(), any(), any(), any());
        complete(true);
        verify(client).deleteTuple("blog_post", "p1", "author", "user", "u1");
    }

    @Test
    @DisplayName("삭제 트랜잭션이 롤백되면 튜플을 지우지 않는다 (글은 남아 있으므로 권한도 남아야 한다)")
    void deleteSkippedOnRollback() {
        tuples.deleteAfterCommit("blog_post", "p1", "author", "user", "u1");
        complete(false);
        verify(client, never()).deleteTuple(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("커밋 후 삭제가 실패해도 요청은 성공으로 끝난다 (예외를 던지지 않는다)")
    void deleteFailureAfterCommitIsLoggedNotThrown() {
        when(client.deleteTuple(eq("blog_post"), any(), any(), any(), any())).thenThrow(new RuntimeException("guard down"));
        tuples.deleteAfterCommit("blog_post", "p1", "author", "user", "u1");
        complete(true); // 예외가 나오지 않아야 한다
    }

    @Test
    @DisplayName("트랜잭션 밖에서는 삭제를 바로 실행한다")
    void deleteRunsImmediatelyWithoutTransaction() {
        TransactionSynchronizationManager.clear();
        tuples.deleteAfterCommit("blog_post", "p1", "author", "user", "u1");
        verify(client).deleteTuple("blog_post", "p1", "author", "user", "u1");
    }
}

package com.doro.blog.infra.guard;

import com.hunnit_beasts.doro.sdk.client.DoroGuardClient;
import com.hunnit_beasts.doro.sdk.exception.DoroGuardWriteFailedException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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

    @Test
    @DisplayName("쓰기는 예외 전파 버전을 호출한다 (실패하면 DB 도 롤백되도록)")
    void writeUsesThrowingVariant() {
        tuples.write("blog_post", "p1", "author", "user", "u1");
        verify(client).writeTupleOrThrow("blog_post", "p1", "author", "user", "u1", null);
    }

    @Test
    @DisplayName("Guard 쓰기가 실패하면 예외가 그대로 전파되고 롤백 정리 작업은 등록되지 않는다")
    void writeFailurePropagates() {
        when(client.writeTupleOrThrow(any(), any(), any(), any(), any(), any()))
                .thenThrow(new DoroGuardWriteFailedException("down", new RuntimeException()));

        assertThatThrownBy(() -> tuples.write("blog_post", "p1", "author", "user", "u1"))
                .isInstanceOf(DoroGuardWriteFailedException.class);
        assertThat(TransactionSynchronizationManager.getSynchronizations()).isEmpty();
    }

    @Test
    @DisplayName("DB 가 롤백되면 이미 쓴 튜플을 지운다")
    void rollbackRemovesWrittenTuple() {
        tuples.write("blog_post", "p1", "author", "user", "u1");
        complete(false);
        verify(client).deleteTuple("blog_post", "p1", "author", "user", "u1");
    }

    @Test
    @DisplayName("DB 가 커밋되면 쓴 튜플은 그대로 둔다")
    void commitKeepsWrittenTuple() {
        tuples.write("blog_post", "p1", "author", "user", "u1");
        complete(true);
        verify(client, never()).deleteTuple(any(), any(), any(), any(), any());
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

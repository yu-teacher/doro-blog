package com.doro.blog.infra.guard;

import com.hunnit_beasts.doro.sdk.client.DoroGuardClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

/**
 * DB 트랜잭션과 Guard(원격) 관계 튜플의 일관성을 맞추는 래퍼.
 *
 * <p>Guard 는 같은 트랜잭션에 참여할 수 없으므로 방향별로 안전한 쪽을 택한다.
 * <ul>
 *   <li><b>쓰기</b>: DB 트랜잭션을 열기 <i>전에</i> 먼저 쓰고({@link #writeThen}), 이후 DB 작업이 실패하면 쓴 튜플을 지운다.
 *       Guard 호출을 트랜잭션 안에서 하면 Guard 가 느릴 때 DB 연결을 그 시간만큼 쥐고 있어 연결 풀이 바닥난다.
 *       튜플 없이 글만 생기면 작성자가 자기 글을 수정하지 못하므로, 튜플이 먼저 있고 글이 나중에 생기는 순서가 안전하다
 *       (중간에 죽어도 남는 것은 가리키는 대상이 없는 튜플뿐이라 해가 없다).</li>
 *   <li><b>삭제</b>: 커밋이 확정된 뒤에 지운다. 먼저 지웠는데 DB 삭제가 실패하면 글은 남고 권한만 사라진다.</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GuardTuples {

    /** 쓸 관계 튜플 하나: namespace:objectId#relation@subjectNamespace:subjectId */
    public record Tuple(String namespace, String objectId, String relation, String subjectNamespace, String subjectId) {
        public static Tuple of(String namespace, String objectId, String relation, String subjectNamespace, String subjectId) {
            return new Tuple(namespace, objectId, relation, subjectNamespace, subjectId);
        }
    }

    private final DoroGuardClient guardClient;

    /**
     * 튜플을 먼저 쓴 뒤 action(보통 DB 트랜잭션)을 실행한다. 튜플 쓰기가 하나라도 실패하면 이미 쓴 것을 지우고 예외를 전파하며
     * action 은 실행하지 않는다. action 이 실패하면 쓴 튜플을 모두 지우고 같은 예외를 다시 던진다.
     * 호출하는 쪽에 열린 트랜잭션이 없어야 Guard 호출이 DB 연결을 쥐지 않는다.
     */
    public <T> T writeThen(List<Tuple> tuples, Supplier<T> action) {
        List<Tuple> written = new ArrayList<>();
        try {
            for (Tuple t : tuples) {
                guardClient.writeTupleOrThrow(t.namespace(), t.objectId(), t.relation(), t.subjectNamespace(), t.subjectId(), null);
                written.add(t);
            }
            return action.get();
        } catch (RuntimeException | Error e) {
            written.forEach(t -> cleanUpOrphan(t.namespace(), t.objectId(), t.relation(), t.subjectNamespace(), t.subjectId()));
            throw e;
        }
    }

    /** 현재 트랜잭션이 커밋된 뒤에 튜플을 지운다. 트랜잭션이 없으면 바로 지운다. */
    public void deleteAfterCommit(String namespace, String objectId, String relation, String subjectNamespace, String subjectId) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            deleteQuietly(namespace, objectId, relation, subjectNamespace, subjectId);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deleteQuietly(namespace, objectId, relation, subjectNamespace, subjectId);
            }
        });
    }

    private void cleanUpOrphan(String namespace, String objectId, String relation, String subjectNamespace, String subjectId) {
        try {
            guardClient.deleteTuple(namespace, objectId, relation, subjectNamespace, subjectId);
            log.warn("Rolled back: removed Guard tuple written ahead of a failed operation {}:{}#{}", namespace, objectId, relation);
        } catch (RuntimeException e) {
            log.error("Rolled back but could not remove Guard tuple {}:{}#{} - needs manual cleanup", namespace, objectId, relation, e);
        }
    }

    private void deleteQuietly(String namespace, String objectId, String relation, String subjectNamespace, String subjectId) {
        try {
            guardClient.deleteTuple(namespace, objectId, relation, subjectNamespace, subjectId);
        } catch (RuntimeException e) {
            // 글/댓글은 이미 지워졌으므로 사용자 요청은 성공시키고, 남은 튜플은 추적할 수 있게 ERROR 로 남긴다.
            log.error("Committed but could not delete Guard tuple {}:{}#{} - stale permission remains", namespace, objectId, relation, e);
        }
    }
}

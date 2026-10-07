package com.doro.blog.domain.user.sync;

import com.doro.blog.domain.user.sync.DoroIamClient.DeletedUser;
import com.doro.blog.domain.user.sync.DoroIamClient.DeletedUsersPage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * Doro 가 알려 주는 '영구 탈퇴한 사용자 ID' 를 주기적으로 가져와 이 블로그의 데이터를 익명화한다.
 * IAM 이 잠시 죽어 있어도 다음 주기에 이어서 처리하고, 같은 ID 를 다시 받아도 결과가 같다(멱등).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeletedAccountSync {

    static final String STATE_NAME = "iam-deleted-users";

    private final DoroIamClient iam;
    private final DeletedAccountAnonymizer anonymizer;
    private final IamSyncStateRepository states;

    @Value("${blog.deleted-sync.page-size:200}")
    private int pageSize;

    /** 서로 다른 트랜잭션이 거의 동시에 커밋돼 순서가 뒤바뀌어도 놓치지 않도록, 저장하는 기준 시각을 이만큼 앞당긴다. */
    @Value("${blog.deleted-sync.overlap:PT10M}")
    private Duration overlap;

    @Value("${blog.deleted-sync.enabled:true}")
    private boolean enabled;

    @Scheduled(fixedDelayString = "${blog.deleted-sync.interval:PT1H}",
            initialDelayString = "${blog.deleted-sync.initial-delay:PT2M}")
    public void scheduledRun() {
        if (!enabled) {
            return;
        }
        try {
            int processed = sync();
            if (processed > 0) {
                log.info("Deleted-account sync finished: anonymized={}", processed);
            }
        } catch (Exception e) {
            // IAM 장애나 일시 오류는 다음 주기에 이어서 처리한다. 기준 시각은 성공한 페이지까지만 저장돼 있다.
            log.warn("Deleted-account sync failed, will retry on the next run: {}", e.toString());
        }
    }

    /** @return 이번 실행에서 새로 익명화한 사용자 수. 실패하면 예외를 던지고, 이미 처리한 페이지의 진행 상황은 유지된다. */
    public int sync() {
        Instant stored = states.findById(STATE_NAME).map(IamSyncState::getCursorAt).orElse(Instant.EPOCH);
        Instant since = stored;
        int anonymized = 0;
        while (true) {
            DeletedUsersPage page = iam.fetchDeletedUsers(since, pageSize);
            for (DeletedUser item : page.items()) {
                if (anonymizer.anonymize(item.userId(), Instant.now())) {
                    anonymized++;
                }
            }
            Instant next = page.nextSince();
            saveCursor(next.minus(overlap), stored);
            boolean lastPage = page.items().size() < pageSize;
            if (lastPage) {
                return anonymized;
            }
            if (!next.isAfter(since)) {
                // 한 페이지가 전부 같은 시각이면 더 나아갈 수 없다. 무한 반복하지 않고 멈춘다.
                log.warn("Deleted-account sync cannot advance past {} (page full of identical timestamps)", since);
                return anonymized;
            }
            since = next;
        }
    }

    private void saveCursor(Instant candidate, Instant stored) {
        Instant value = candidate.isAfter(stored) ? candidate : stored;
        IamSyncState state = states.findById(STATE_NAME).orElseGet(() -> new IamSyncState(STATE_NAME, value));
        if (value.isAfter(state.getCursorAt())) {
            state.advanceTo(value);
        }
        states.save(state);
    }
}

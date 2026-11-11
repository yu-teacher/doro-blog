package com.doro.blog.config;

import com.doro.blog.domain.user.sync.DeletedAccountAnonymizer;
import com.doro.blog.domain.user.sync.DeletedAccountGuardCleaner;
import com.hunnit_beasts.doro.sdk.sync.DeletedUserHandler;
import com.hunnit_beasts.doro.sdk.sync.DeletedUsersProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 로그인 관련 설정. 로그인·세션·토큰 갱신은 별도 서비스(doro-bff)가 맡는다. 게이트웨이가 쿠키를 토큰으로 바꿔 요청마다
 * {@code Authorization: Bearer} 로 붙여 주므로, 이 서비스는 Bearer 만 검증하고 세션 저장소를 갖지 않는다.
 * 블로그 사용자 행은 로그인 후 첫 화면이 부르는 {@code GET /api/v1/bff/session} 이 만든다({@link com.doro.blog.domain.auth.BffSessionController}).
 * 여기에는 Doro 에서 영구 탈퇴한 사용자를 정리하는 동기화 설정만 있다.
 */
@Configuration
@EnableScheduling
public class BffConfig {

    /** 탈퇴 동기화 설정({@code blog.deleted-sync.*}: enabled, page-size, overlap, interval, initial-delay, 타임아웃). 로직은 SDK 가 맡는다. */
    @Bean
    @ConfigurationProperties(prefix = "blog.deleted-sync")
    public DeletedUsersProperties deletedUsersProperties() {
        return new DeletedUsersProperties();
    }

    /**
     * Doro 에서 영구 탈퇴한 사용자의 블로그 데이터를 익명화한다(멱등). 익명화 전에 Guard 튜플을 먼저 지운다.
     * Guard 삭제가 실패하면 예외가 동기화로 전파돼 기준 시각이 나아가지 않고 다음 주기에 같은 사용자를 다시 처리한다
     * (익명화를 먼저 하면 '처리 완료'로 보여 남은 튜플을 다시 찾지 못한다).
     */
    @Bean
    public DeletedUserHandler deletedUserHandler(DeletedAccountAnonymizer anonymizer, DeletedAccountGuardCleaner guardCleaner) {
        return (userId, now) -> {
            if (!anonymizer.needsAnonymization(userId)) {
                return false;
            }
            guardCleaner.removeTuplesOrThrow(userId);
            return anonymizer.anonymize(userId, now);
        };
    }
}

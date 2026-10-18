package com.doro.blog.config;

import com.doro.blog.domain.user.service.BlogUserService;
import com.doro.blog.domain.user.sync.DeletedAccountAnonymizer;
import com.hunnit_beasts.doro.sdk.bff.BffProperties;
import com.hunnit_beasts.doro.sdk.bff.BffUserHook;
import com.doro.blog.domain.user.sync.DeletedAccountGuardCleaner;
import com.hunnit_beasts.doro.sdk.sync.DeletedUserHandler;
import com.hunnit_beasts.doro.sdk.sync.DeletedUsersProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * BFF 로그인 설정. 두 가지 모드가 있다({@code blog.auth.mode}).
 * <ul>
 *   <li>{@code embedded}(기본): 로그인 로직(세션·로그인 CSRF·토큰 갱신·로그아웃)은 SDK(doro-sdk 의 bff 패키지)가 이 서비스 안에서 돌고,
 *       블로그는 설정 값과 저장소({@link com.doro.blog.domain.auth.BlogBffStores}), 로그인 직후의 사용자 생성만 제공한다.
 *       설정 키는 {@code blog.auth.*}, 환경변수 이름도 그대로다.</li>
 *   <li>{@code gateway}: 로그인·세션·토큰 갱신은 별도 서비스(doro-bff)가 맡는다. 게이트웨이가 쿠키를 토큰으로 바꿔 요청마다
 *       {@code Authorization: Bearer} 로 붙여 주므로, 이 서비스에는 BFF 빈·세션 저장소가 없고 Bearer 만 검증한다.</li>
 * </ul>
 */
@Configuration
@EnableScheduling
public class BffConfig {

    /** 블로그의 기본값을 깔고 {@code blog.auth.*} 설정이 그 위에 덮어쓴다. */
    @Bean
    @ConditionalOnEmbeddedBff
    @ConfigurationProperties(prefix = "blog.auth")
    public BffProperties bffProperties() {
        return defaults();
    }

    /** 이 블로그의 기본값(SDK 의 일반 기본값과 다른 부분). 시험도 같은 기본값을 쓴다. */
    public static BffProperties defaults() {
        BffProperties props = new BffProperties();
        props.setClientId("doro-blog");
        props.setCookieName("doro_blog_session");
        props.setLoginCookieName("doro_blog_login");
        props.setCsrfHeader("X-Blog-Csrf");
        return props;
    }

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

    /** 로그인에 성공하면 블로그 사용자 행을 만든다. (gateway 모드에서는 첫 인증 요청이 {@code /api/v1/bff/session} 에서 만든다) */
    @Bean
    @ConditionalOnEmbeddedBff
    public BffUserHook bffUserHook(BlogUserService userService) {
        return user -> userService.getOrCreateUser(user);
    }
}

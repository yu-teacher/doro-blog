package com.doro.blog.config;

import com.doro.blog.domain.user.service.BlogUserService;
import com.doro.blog.domain.user.sync.DeletedAccountAnonymizer;
import com.hunnit_beasts.doro.sdk.bff.BffProperties;
import com.hunnit_beasts.doro.sdk.bff.BffUserHook;
import com.hunnit_beasts.doro.sdk.sync.DeletedUserHandler;
import com.hunnit_beasts.doro.sdk.sync.DeletedUsersProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * BFF 로그인 설정. 로그인 로직(세션·로그인 CSRF·토큰 갱신·로그아웃)은 SDK(doro-sdk 의 bff 패키지)가 맡고, 블로그는 설정 값과
 * 저장소({@link com.doro.blog.domain.auth.BlogBffStores}), 로그인 직후의 사용자 생성만 제공한다.
 * 설정 키는 그대로 {@code blog.auth.*}, 환경변수 이름도 그대로다.
 */
@Configuration
@EnableScheduling
public class BffConfig {

    /** 블로그의 기본값을 깔고 {@code blog.auth.*} 설정이 그 위에 덮어쓴다. */
    @Bean
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

    /** Doro 에서 영구 탈퇴한 사용자의 블로그 데이터를 익명화한다(멱등). */
    @Bean
    public DeletedUserHandler deletedUserHandler(DeletedAccountAnonymizer anonymizer) {
        return anonymizer::anonymize;
    }

    /** 로그인에 성공하면 블로그 사용자 행을 만들거나 갱신한다. */
    @Bean
    public BffUserHook bffUserHook(BlogUserService userService) {
        return user -> userService.getOrCreateUser(user);
    }
}

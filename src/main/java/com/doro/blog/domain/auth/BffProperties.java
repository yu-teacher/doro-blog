package com.doro.blog.domain.auth;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;
import java.time.Duration;

/** 블로그 BFF 로그인 설정(blog.auth.*). URL 과 비밀은 환경변수로만 바꾼다. */
@Getter
@Setter
@ConfigurationProperties(prefix = "blog.auth")
public class BffProperties {

    /** Doro 에 등록한 이 블로그의 OAuth 클라이언트 ID */
    private String clientId = "doro-blog";
    /** 브라우저가 이동하는 인가 엔드포인트(공개 주소) */
    private String authorizeUrl = "http://localhost:28080/oauth2/authorize";
    /** 서버가 직접 호출하는 토큰 엔드포인트(내부 주소 가능) */
    private String tokenUrl = "http://localhost:28080/oauth2/token";
    /** 서버가 직접 호출하는 토큰 폐기 엔드포인트(로그아웃 시 IAM 세션 종료) */
    private String revokeUrl = "http://localhost:28080/oauth2/revoke";
    /** Doro 에 등록한 redirect_uri. 이 블로그의 콜백 주소(공개 주소)와 정확히 같아야 한다. */
    private String redirectUri = "http://localhost:5173/api/v1/bff/callback";
    private String scope = "openid profile email";
    private String cookieName = "doro_blog_session";

    /** 로그인을 시작한 브라우저를 콜백에서 다시 알아보기 위한 짧은 수명의 쿠키 이름. */
    private String loginCookieName = "doro_blog_login";
    /** HTTPS 에서만 쿠키를 보낸다. 로컬 HTTP 개발에서만 false. */
    private boolean cookieSecure = true;
    /** 로그인 후 세션의 절대 수명 */
    private Duration sessionTtl = Duration.ofDays(30);
    /** 인가 요청을 보낸 뒤 콜백이 돌아와야 하는 시간 */
    private Duration loginAttemptTtl = Duration.ofMinutes(10);
    /** 액세스 토큰 만료 이 시간 전부터 미리 갱신한다 */
    private Duration refreshMargin = Duration.ofSeconds(60);
    /** 쿠키 인증으로 상태를 바꾸는 요청에 반드시 붙어야 하는 헤더(CSRF 방어: 다른 사이트는 커스텀 헤더를 붙일 수 없다) */
    private String csrfHeader = "X-Blog-Csrf";
    private Duration httpConnectTimeout = Duration.ofSeconds(3);
    private Duration httpReadTimeout = Duration.ofSeconds(5);

    /** redirect_uri 의 origin(scheme://host[:port]). Origin 헤더 검증에 쓴다. */
    public String publicOrigin() {
        URI uri = URI.create(redirectUri);
        return uri.getScheme() + "://" + uri.getAuthority();
    }
}

package com.doro.blog.domain.auth;

import com.doro.blog.domain.auth.repository.AuthSessionRepository;
import com.hunnit_beasts.doro.sdk.security.jwks.JwksKeyProvider;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

/**
 * BFF 의 회복력과 로그인 CSRF 방어: IAM 장애가 사용자를 로그아웃시키지 않고, 콜백은 로그인을 시작한 바로 그 브라우저에서만 끝낼 수 있다.
 * 가짜 IAM 서버와 실제 DB 를 쓴다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class BffHardeningTest {

    private static final String SITE = "https://blog.test";
    private static final String SESSION_COOKIE = "doro_blog_session";
    private static final String LOGIN_COOKIE = "doro_blog_login";

    private static final FakeIam IAM = startIam();

    private static FakeIam startIam() {
        try {
            return new FakeIam();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("blog.auth.authorize-url", () -> "https://doro.test/oauth2/authorize");
        registry.add("blog.auth.token-url", () -> IAM.baseUrl() + "/oauth2/token");
        registry.add("blog.auth.revoke-url", () -> IAM.baseUrl() + "/oauth2/revoke");
        registry.add("blog.auth.redirect-uri", () -> SITE + "/api/v1/bff/callback");
        registry.add("blog.auth.cookie-secure", () -> "true");
        registry.add("doro.iam.revocation-check", () -> "OFF");
        // 만료를 짧은 대기로 확인하려고 검증기의 시계 오차 허용(기본 5초)을 이 테스트에서만 끈다
        registry.add("doro.iam.clock-skew-seconds", () -> "0");
    }

    @AfterAll
    static void stopIam() {
        IAM.close();
    }

    @Autowired private MockMvc mockMvc;
    @Autowired private JwksKeyProvider jwks;
    @Autowired private AuthSessionRepository sessions;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private org.springframework.transaction.PlatformTransactionManager transactionManager;

    @BeforeEach
    void resetIam() {
        jwks.registerKey(FakeIam.KID, IAM.publicKey());
        IAM.rejectRefresh = false;
        IAM.unavailable = false;
        IAM.accessTtlSeconds = 900;
    }

    private record Started(String state, String challenge, MockHttpServletResponse response) {
        /** 로그인 시작 때 브라우저가 받은 "로그인 진행 중" 쿠키의 값(없으면 null). */
        String loginCookieValue() {
            for (String header : response.getHeaders("Set-Cookie")) {
                if (header.startsWith(LOGIN_COOKIE + "=")) {
                    return header.substring((LOGIN_COOKIE + "=").length(), header.indexOf(';'));
                }
            }
            return null;
        }
    }

    private Started startLogin() throws Exception {
        MockHttpServletResponse response = mockMvc.perform(get("/api/v1/bff/login")).andReturn().getResponse();
        var params = UriComponentsBuilder.fromUriString(response.getHeader("Location")).build().getQueryParams();
        return new Started(params.getFirst("state"), params.getFirst("code_challenge"), response);
    }

    private MockHttpServletResponse callback(String code, String state, Cookie... cookies) throws Exception {
        var request = get("/api/v1/bff/callback").param("code", code).param("state", state);
        if (cookies.length > 0) {
            request.cookie(cookies);
        }
        return mockMvc.perform(request).andReturn().getResponse();
    }

    private String sessionCookieOf(MockHttpServletResponse response) {
        for (String header : response.getHeaders("Set-Cookie")) {
            if (header.startsWith(SESSION_COOKIE + "=") && !header.startsWith(SESSION_COOKIE + "=;")) {
                return header.substring((SESSION_COOKIE + "=").length(), header.indexOf(';'));
            }
        }
        return null;
    }

    private static String newEmail() {
        return "bffh-" + UUID.randomUUID().toString().substring(0, 8) + "@doro.local";
    }

    private int sessionCountOf(UUID userId) {
        return jdbc.queryForObject("select count(*) from auth_sessions where user_id = ?", Integer.class, userId);
    }

    @Test
    @DisplayName("IAM 장애 중 액세스 토큰이 만료돼도 세션은 지워지지 않고, IAM 이 돌아오면 다시 쓸 수 있다")
    void sessionSurvivesAnIamOutageWithAnExpiredAccessToken() throws Exception {
        IAM.accessTtlSeconds = 1;
        UUID userId = UUID.randomUUID();
        Started started = startLogin();
        String code = IAM.issueCode(userId, newEmail(), started.challenge(), "doro-blog");
        String cookie = sessionCookieOf(callback(code, started.state(), loginCookie(started)));
        assertThat(cookie).as("로그인 성공").isNotNull();
        Thread.sleep(2_500);
        IAM.unavailable = true;

        // 만료된 토큰은 갱신해야 하는데 IAM 이 응답하지 않는다: 이번 요청은 익명이지만 세션은 남아야 한다
        mockMvc.perform(get("/api/v1/bff/session").cookie(new Cookie(SESSION_COOKIE, cookie)))
                .andExpect(jsonPath("$.data.authenticated").value(false));
        assertThat(sessions.findBySessionHash(BffAuthService.sha256Hex(cookie)))
                .as("IAM 이 잠깐 죽었다고 모든 사용자의 세션을 지우면 안 된다").isPresent();

        // IAM 이 돌아오면 같은 쿠키로 다시 로그인된 상태가 된다
        IAM.unavailable = false;
        IAM.accessTtlSeconds = 900;
        mockMvc.perform(get("/api/v1/bff/session").cookie(new Cookie(SESSION_COOKIE, cookie)))
                .andExpect(jsonPath("$.data.authenticated").value(true));
    }

    @Test
    @DisplayName("로그인을 시작하면 그 브라우저에 '로그인 진행 중' 쿠키(HttpOnly, Secure, SameSite=Lax)가 발급된다")
    void loginStartBindsTheBrowser() throws Exception {
        Started started = startLogin();

        String header = started.response().getHeaders("Set-Cookie").stream()
                .filter(h -> h.startsWith(LOGIN_COOKIE + "=")).findFirst().orElse(null);
        assertThat(header).as("로그인 진행 중 쿠키").isNotNull();
        assertThat(header).contains("HttpOnly").contains("Secure").contains("SameSite=Lax");
    }

    @Test
    @DisplayName("로그인을 시작한 브라우저가 콜백을 끝내면 성공한다")
    void callbackFromTheSameBrowserSucceeds() throws Exception {
        UUID userId = UUID.randomUUID();
        Started started = startLogin();
        String code = IAM.issueCode(userId, newEmail(), started.challenge(), "doro-blog");

        MockHttpServletResponse response = callback(code, started.state(), loginCookie(started));

        assertThat(response.getHeader("Location")).isEqualTo("/");
        assertThat(sessionCookieOf(response)).isNotNull();
        assertThat(sessionCountOf(userId)).isEqualTo(1);
    }

    @Test
    @DisplayName("공격자가 시작한 로그인의 콜백 주소를 피해자 브라우저가 열어도 세션이 만들어지지 않는다 (로그인 CSRF)")
    void callbackFromAnotherBrowserIsRejected() throws Exception {
        UUID attackerId = UUID.randomUUID();
        Started attackerFlow = startLogin();                       // 공격자 브라우저가 로그인을 시작하고
        String code = IAM.issueCode(attackerId, newEmail(), attackerFlow.challenge(), "doro-blog"); // IAM 에서 자기 계정으로 인증한 뒤

        // 콜백 주소를 피해자에게 열게 한다: 피해자 브라우저는 공격자의 '로그인 진행 중' 쿠키가 없다
        MockHttpServletResponse victim = callback(code, attackerFlow.state());

        assertThat(victim.getHeader("Location")).isEqualTo("/?login_error=failed");
        assertThat(sessionCookieOf(victim)).as("피해자에게 공격자의 세션을 심으면 안 된다").isNull();
        assertThat(sessionCountOf(attackerId)).isZero();
    }

    @Test
    @DisplayName("자기가 시작한 다른 로그인의 쿠키로는 남이 시작한 로그인을 끝낼 수 없다")
    void anotherLoginsCookieDoesNotMatch() throws Exception {
        UUID attackerId = UUID.randomUUID();
        Started attackerFlow = startLogin();
        Started victimOwnFlow = startLogin();                      // 피해자 브라우저도 자기 로그인을 시작해 쿠키를 갖고 있다
        String code = IAM.issueCode(attackerId, newEmail(), attackerFlow.challenge(), "doro-blog");

        MockHttpServletResponse response = callback(code, attackerFlow.state(), loginCookie(victimOwnFlow));

        assertThat(response.getHeader("Location")).isEqualTo("/?login_error=failed");
        assertThat(sessionCountOf(attackerId)).isZero();
    }

    @Test
    @DisplayName("가짜 콜백 링크가 이미 로그인한 사용자의 세션 쿠키를 지우지 않는다 (강제 로그아웃 방지)")
    void failedCallbackKeepsAnExistingSessionCookie() throws Exception {
        UUID userId = UUID.randomUUID();
        Started started = startLogin();
        String code = IAM.issueCode(userId, newEmail(), started.challenge(), "doro-blog");
        String cookie = sessionCookieOf(callback(code, started.state(), loginCookie(started)));
        assertThat(cookie).isNotNull();

        MockHttpServletResponse forged = callback("x", "unknown-state", new Cookie(SESSION_COOKIE, cookie));

        assertThat(forged.getHeader("Location")).isEqualTo("/?login_error=failed");
        for (String header : forged.getHeaders("Set-Cookie")) {
            assertThat(header).as("세션 쿠키를 비우는 응답이 없어야 한다").doesNotStartWith(SESSION_COOKIE + "=;");
        }
    }

    @Test
    @DisplayName("마지막 사용 시각 갱신은 그 컬럼만 바꾸고, 그사이 회전된 토큰을 옛 값으로 되돌리지 않는다")
    void touchDoesNotOverwriteRotatedTokens() throws Exception {
        UUID userId = UUID.randomUUID();
        Started started = startLogin();
        String code = IAM.issueCode(userId, newEmail(), started.challenge(), "doro-blog");
        String cookie = sessionCookieOf(callback(code, started.state(), loginCookie(started)));
        String hash = BffAuthService.sha256Hex(cookie);
        // 요청 초반에 읽어 둔 (곧 낡아질) 세션
        var stale = sessions.findBySessionHash(hash).orElseThrow();
        String staleRefresh = stale.getRefreshTokenEnc();
        // 그사이 다른 요청이 리프레시 토큰을 회전시켰다
        jdbc.update("update auth_sessions set refresh_token_enc = 'v1:rotated-by-other-request', last_used_at = now() - interval '10 minutes' where session_hash = ?", hash);

        int updated = new org.springframework.transaction.support.TransactionTemplate(transactionManager)
                .execute(status -> sessions.touchLastUsed(hash, java.time.Instant.now()));

        assertThat(updated).isEqualTo(1);
        assertThat(jdbc.queryForObject("select refresh_token_enc from auth_sessions where session_hash = ?", String.class, hash))
                .as("회전된 토큰이 유지돼야 한다").isEqualTo("v1:rotated-by-other-request").isNotEqualTo(staleRefresh);
        assertThat(jdbc.queryForObject("select last_used_at > now() - interval '1 minute' from auth_sessions where session_hash = ?", Boolean.class, hash))
                .isTrue();
    }

    private static Cookie loginCookie(Started started) {
        String value = started.loginCookieValue();
        return new Cookie(LOGIN_COOKIE, value == null ? "" : value);
    }
}

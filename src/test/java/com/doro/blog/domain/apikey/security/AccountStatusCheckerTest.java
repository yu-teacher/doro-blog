package com.doro.blog.domain.apikey.security;

import com.doro.blog.domain.apikey.security.AccountStatusChecker.Status;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/** API 키 소유자의 계정 상태 확인: 상태 매핑, 캐시(정상은 길게·비정상은 짧게), IAM 장애 때의 동작(이전 판정 재사용, 없으면 거부). */
class AccountStatusCheckerTest {

    private HttpServer server;
    private final AtomicInteger calls = new AtomicInteger();
    private final CopyOnWriteArrayList<String> tokens = new CopyOnWriteArrayList<>();
    private volatile int httpStatus = 200;
    private volatile String state = "ACTIVE";
    private volatile String rawBody;
    private volatile Instant now = Instant.parse("2026-10-15T00:00:00Z");
    private final UUID user = UUID.randomUUID();
    private final Clock clock = new Clock() {
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    };

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/users/", ex -> {
            calls.incrementAndGet();
            tokens.add(String.valueOf(ex.getRequestHeaders().getFirst(AccountStatusChecker.TOKEN_HEADER)));
            String body = rawBody != null ? rawBody : "{\"data\":{\"userId\":\"" + user + "\",\"status\":\"" + state + "\"}}";
            byte[] bytes = (httpStatus == 200 ? body : "{}").getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(httpStatus, bytes.length);
            ex.getResponseBody().write(bytes);
            ex.close();
        });
        server.start();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private AccountStatusChecker checker(boolean enabled) {
        return new AccountStatusChecker(enabled, "http://127.0.0.1:" + server.getAddress().getPort(), "svc-token",
                Duration.ofSeconds(60), Duration.ofSeconds(10), Duration.ofMinutes(10), Duration.ofSeconds(1), Duration.ofSeconds(2), clock);
    }

    @Test
    @DisplayName("ACTIVE 만 쓸 수 있고, 정지·탈퇴 유예·영구 탈퇴는 쓸 수 없다. 서비스 토큰을 헤더로 보낸다")
    void mapsAccountStates() {
        assertThat(checker(true).check(user)).isEqualTo(Status.ACTIVE);
        assertThat(tokens).containsOnly("svc-token");
        for (String s : new String[]{"SUSPENDED", "PENDING_DELETION", "DELETED", "LOCKED"}) {
            state = s;
            assertThat(checker(true).check(UUID.randomUUID())).as(s).isEqualTo(Status.INACTIVE);
        }
    }

    @Test
    @DisplayName("IAM 이 모르는 사용자(404)는 쓸 수 없는 계정이다")
    void unknownUserIsInactive() {
        httpStatus = 404;

        assertThat(checker(true).check(user)).isEqualTo(Status.INACTIVE);
    }

    @Test
    @DisplayName("정상 판정은 60초 동안 캐시돼 IAM 을 다시 부르지 않고, 지나면 다시 확인한다")
    void activeIsCachedForTheTtl() {
        AccountStatusChecker c = checker(true);
        c.check(user);
        c.check(user);
        assertThat(calls.get()).as("두 번째는 캐시").isEqualTo(1);

        now = now.plusSeconds(61);
        c.check(user);
        assertThat(calls.get()).isEqualTo(2);
    }

    @Test
    @DisplayName("쓸 수 없는 판정은 10초만 캐시돼, 정지가 풀리면 곧 다시 쓸 수 있다")
    void inactiveIsCachedBriefly() {
        AccountStatusChecker c = checker(true);
        state = "SUSPENDED";
        assertThat(c.check(user)).isEqualTo(Status.INACTIVE);

        state = "ACTIVE";                                 // 관리자가 정지를 풀었다
        assertThat(c.check(user)).as("10초 안에는 아직 캐시").isEqualTo(Status.INACTIVE);
        now = now.plusSeconds(11);
        assertThat(c.check(user)).as("10초가 지나면 다시 쓸 수 있다").isEqualTo(Status.ACTIVE);
    }

    @Test
    @DisplayName("계정이 정지되면 정상 캐시가 끝나는 즉시(최대 60초) 키가 막힌다")
    void suspensionTakesEffectAfterTheCacheExpires() {
        AccountStatusChecker c = checker(true);
        assertThat(c.check(user)).isEqualTo(Status.ACTIVE);

        state = "SUSPENDED";
        now = now.plusSeconds(61);
        assertThat(c.check(user)).isEqualTo(Status.INACTIVE);
    }

    @Test
    @DisplayName("IAM 에 닿지 못하면 10분 안의 이전 판정을 쓰고, 10분이 지나면 거부(UNAVAILABLE)한다")
    void staleVerdictIsUsedWhenIamIsDown() {
        AccountStatusChecker c = checker(true);
        assertThat(c.check(user)).isEqualTo(Status.ACTIVE);

        server.stop(0);                                    // IAM 장애
        now = now.plusSeconds(120);
        assertThat(c.check(user)).as("2분 전 판정을 재사용").isEqualTo(Status.ACTIVE);
        now = now.plusSeconds(600);
        assertThat(c.check(user)).as("12분 전 판정은 너무 낡았다").isEqualTo(Status.UNAVAILABLE);
    }

    @Test
    @DisplayName("이전 판정이 없는데 IAM 에 닿지 못하면 거부한다(fail-closed)")
    void failsClosedWithoutAnyVerdict() {
        server.stop(0);

        assertThat(checker(true).check(user)).isEqualTo(Status.UNAVAILABLE);
    }

    @Test
    @DisplayName("IAM 이 서비스 토큰을 거부(401)하거나 이상한 응답을 줘도 '쓸 수 없는 계정'이 아니라 '확인 불가'다")
    void tokenRejectionAndBadBodiesAreUnavailableNotInactive() {
        httpStatus = 401;
        assertThat(checker(true).check(user)).isEqualTo(Status.UNAVAILABLE);

        httpStatus = 200;
        rawBody = "{\"data\":null}";
        assertThat(checker(true).check(UUID.randomUUID())).isEqualTo(Status.UNAVAILABLE);
    }

    @Test
    @DisplayName("enabled=false 면 IAM 을 부르지 않고 항상 통과한다(개발·시험용)")
    void disabledAlwaysPasses() {
        server.stop(0);

        assertThat(checker(false).check(user)).isEqualTo(Status.ACTIVE);
    }
}

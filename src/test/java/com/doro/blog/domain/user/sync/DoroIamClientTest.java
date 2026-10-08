package com.doro.blog.domain.user.sync;

import com.doro.blog.domain.user.sync.DoroIamClient.DeletedUsersPage;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.HttpClientErrorException;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** IAM 내부 API 클라이언트가 호출자 서비스 토큰을 올바르게 보내는지, 가짜 IAM 서버(JDK HttpServer)로 검증한다. */
class DoroIamClientTest {

    private static final String TOKEN = "blog-internal-token-0123456789abcdef0123456789abcdef";
    private static final String BODY = "{\"success\":true,\"data\":{\"items\":[{\"userId\":\"3f2b6c1e-8a40-4f5e-9c11-1a2b3c4d5e6f\","
            + "\"deletedAt\":\"2026-10-01T00:00:00Z\"}],\"nextSince\":\"2026-10-01T00:00:00Z\"}}";

    private HttpServer server;
    private final AtomicReference<String> receivedToken = new AtomicReference<>();
    private final AtomicReference<String> receivedPathAndQuery = new AtomicReference<>();
    private volatile int status = 200;

    @BeforeEach
    void startFakeIam() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/deleted-users", exchange -> {
            receivedToken.set(exchange.getRequestHeaders().getFirst("X-Doro-Service-Token"));
            receivedPathAndQuery.set(exchange.getRequestURI().toString());
            byte[] payload = (status == 200 ? BODY : "{\"success\":false}").getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, payload.length);
            exchange.getResponseBody().write(payload);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stopFakeIam() {
        server.stop(0);
    }

    private DoroIamClient client(String token) {
        return new DoroIamClient("http://127.0.0.1:" + server.getAddress().getPort(), token, Duration.ofSeconds(2), Duration.ofSeconds(2));
    }

    @Test
    @DisplayName("설정된 호출자 토큰을 X-Doro-Service-Token 헤더로 보내고, 응답을 읽는다")
    void sendsTheConfiguredToken() {
        DeletedUsersPage page = client(TOKEN).fetchDeletedUsers(Instant.parse("2026-09-30T00:00:00Z"), 200);

        assertThat(receivedToken.get()).isEqualTo(TOKEN);
        assertThat(receivedPathAndQuery.get()).contains("since=2026-09-30T00:00:00Z").contains("limit=200");
        assertThat(page.items()).hasSize(1);
        assertThat(page.nextSince()).isEqualTo(Instant.parse("2026-10-01T00:00:00Z"));
    }

    @Test
    @DisplayName("토큰 앞뒤 공백은 제거하고, 토큰이 비어 있으면 헤더를 보내지 않는다")
    void trimsAndOmitsBlankToken() {
        client("  " + TOKEN + "  ").fetchDeletedUsers(Instant.EPOCH, 10);
        assertThat(receivedToken.get()).isEqualTo(TOKEN);

        for (String blank : new String[]{"", "   ", null}) {
            receivedToken.set("unset");
            client(blank).fetchDeletedUsers(Instant.EPOCH, 10);
            assertThat(receivedToken.get()).as("blank=%s", blank).isNull();
        }
    }

    @Test
    @DisplayName("IAM 이 거절(401)하면 예외로 알리고, 예외 메시지에 토큰 값이 들어가지 않는다")
    void rejectionPropagatesWithoutLeakingToken() {
        status = 401;
        assertThatThrownBy(() -> client(TOKEN).fetchDeletedUsers(Instant.EPOCH, 10))
                .isInstanceOf(HttpClientErrorException.Unauthorized.class)
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain(TOKEN));
    }

    @Test
    @DisplayName("요청마다 같은 토큰을 보낸다(첫 호출에만 붙지 않는다)")
    void sendsTokenOnEveryCall() {
        DoroIamClient client = client(TOKEN);
        for (int i = 0; i < 3; i++) {
            receivedToken.set(null);
            client.fetchDeletedUsers(Instant.EPOCH, 10);
            assertThat(receivedToken.get()).as("call %d", i).isEqualTo(TOKEN);
        }
    }
}

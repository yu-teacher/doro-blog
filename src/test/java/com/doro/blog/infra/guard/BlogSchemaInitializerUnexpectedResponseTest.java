package com.doro.blog.infra.guard;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.test.util.ReflectionTestUtils;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guard 의 스키마 등록은 "전체 교체"다. 활성 스키마 조회가 200 이지만 예상한 모양이 아니면(data 누락·null·객체, 프록시의 HTML 오류 페이지)
 * 빈 스키마로 착각해 블로그 타입만 등록하면 플랫폼의 다른 타입이 지워진다. 그럴 때는 등록하지 않고 나중에 다시 시도해야 한다.
 */
class BlogSchemaInitializerUnexpectedResponseTest {

    private HttpServer guard;
    private final AtomicReference<String> getBody = new AtomicReference<>("{}");
    private final AtomicInteger posts = new AtomicInteger();
    private final AtomicReference<String> lastPostBody = new AtomicReference<>();

    @BeforeEach
    void startFakeGuard() throws Exception {
        guard = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        guard.createContext("/api/v1/guard/schema", exchange -> {
            byte[] body;
            if ("GET".equals(exchange.getRequestMethod())) {
                body = getBody.get().getBytes(StandardCharsets.UTF_8);
            } else {
                posts.incrementAndGet();
                lastPostBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                body = "{}".getBytes(StandardCharsets.UTF_8);
            }
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        guard.start();
    }

    @AfterEach
    void stopFakeGuard() {
        guard.stop(0);
    }

    private BlogSchemaInitializer initializer() {
        BlogSchemaInitializer initializer = new BlogSchemaInitializer(new DefaultResourceLoader());
        ReflectionTestUtils.setField(initializer, "guardHttpUrl", "http://127.0.0.1:" + guard.getAddress().getPort());
        ReflectionTestUtils.setField(initializer, "guardHttpTimeoutMs", 2000);
        ReflectionTestUtils.setField(initializer, "guardServiceToken", "");
        ReflectionTestUtils.setField(initializer, "retryDelaySeconds", 0L);
        ReflectionTestUtils.setField(initializer, "maxRetries", 1);
        return initializer;
    }

    @Test
    @DisplayName("활성 스키마 응답의 data 가 문자열이 아니면(없음·null·객체) 등록하지 않고 나중에 다시 시도한다")
    void unexpectedShapeIsNeverRegistered() {
        for (String body : new String[]{"{}", "{\"data\":null}", "{\"data\":{\"dsl\":\"type user {}\"}}", "{\"success\":true}"}) {
            getBody.set(body);

            boolean done = initializer().syncOnce();

            assertThat(done).as("다시 시도해야 하는 응답: %s", body).isFalse();
            assertThat(posts.get()).as("전체 교체 요청을 보내면 안 된다: %s", body).isZero();
        }
    }

    @Test
    @DisplayName("JSON 이 아닌 본문(프록시의 HTML 오류 페이지)도 등록하지 않는다")
    void nonJsonBodyIsNeverRegistered() {
        getBody.set("<html><body>Bad gateway</body></html>");

        boolean done = initializer().syncOnce();

        assertThat(done).isFalse();
        assertThat(posts.get()).isZero();
    }

    @Test
    @DisplayName("기존 스키마가 있으면 그 내용을 보존한 채 블로그 타입만 덧붙여 등록한다")
    void existingSchemaIsPreservedWhenMerging() {
        getBody.set("{\"data\":\"type user {}\\n\\ntype system {\\n  relation admin: user\\n}\"}");

        boolean done = initializer().syncOnce();

        assertThat(done).isTrue();
        assertThat(posts.get()).isEqualTo(1);
        assertThat(lastPostBody.get()).contains("type user").contains("type system").contains("blog_post");
    }
}

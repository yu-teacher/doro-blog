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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/** Guard 가 기동 때 아직 응답하지 않아도, 서비스는 뜨고 스키마는 나중에 자동으로 등록되는지 검증한다. */
class BlogSchemaInitializerRetryTest {

    private HttpServer guard;
    private final AtomicInteger getCalls = new AtomicInteger();
    private final CountDownLatch registered = new CountDownLatch(1);

    @BeforeEach
    void startFakeGuard() throws Exception {
        guard = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        guard.createContext("/api/v1/guard/schema", exchange -> {
            byte[] body;
            int status;
            if ("GET".equals(exchange.getRequestMethod())) {
                // 처음 두 번은 아직 부팅 중이라 503, 이후 빈 스키마를 돌려준다
                boolean up = getCalls.incrementAndGet() > 2;
                status = up ? 200 : 503;
                body = (up ? "{\"data\":\"\"}" : "{}").getBytes(StandardCharsets.UTF_8);
            } else {
                status = 200;
                body = "{}".getBytes(StandardCharsets.UTF_8);
                registered.countDown();
            }
            exchange.sendResponseHeaders(status, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        guard.start();
    }

    @AfterEach
    void stopFakeGuard() {
        guard.stop(0);
    }

    private BlogSchemaInitializer initializer(int maxRetries) {
        BlogSchemaInitializer initializer = new BlogSchemaInitializer(new DefaultResourceLoader());
        ReflectionTestUtils.setField(initializer, "guardHttpUrl", "http://127.0.0.1:" + guard.getAddress().getPort());
        ReflectionTestUtils.setField(initializer, "guardHttpTimeoutMs", 2000);
        ReflectionTestUtils.setField(initializer, "guardServiceToken", "");
        ReflectionTestUtils.setField(initializer, "retryDelaySeconds", 0L);
        ReflectionTestUtils.setField(initializer, "maxRetries", maxRetries);
        return initializer;
    }

    @Test
    @DisplayName("첫 시도가 실패해도 기동은 계속되고, Guard 가 올라오면 백그라운드 재시도로 스키마가 등록된다")
    void retriesInBackgroundUntilGuardIsUp() throws Exception {
        initializer(10).run(null); // 첫 시도(503)에서 예외 없이 반환해야 한다

        assertThat(registered.await(10, TimeUnit.SECONDS)).as("재시도 끝에 스키마 등록(POST)이 일어난다").isTrue();
        assertThat(getCalls.get()).isGreaterThanOrEqualTo(3);
    }

    @Test
    @DisplayName("재시도 횟수를 다 쓰면 포기한다 (무한 반복하지 않는다)")
    void givesUpAfterMaxRetries() {
        BlogSchemaInitializer initializer = initializer(2);
        ReflectionTestUtils.setField(initializer, "guardHttpUrl", "http://127.0.0.1:1"); // 아무도 듣지 않는 포트

        initializer.retryUntilSynced();

        assertThat(registered.getCount()).isEqualTo(1);
    }
}

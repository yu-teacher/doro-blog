package com.doro.blog.domain.apikey.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * API 키 소유자의 Doro 계정이 지금 쓸 수 있는 상태인지 확인한다. API 키는 IAM 세션 없이 오래 쓰는 자격 증명이라, 계정이 정지되거나
 * 탈퇴 유예에 들어가도(로그아웃·비밀번호 변경도) 키가 계속 통하던 것을 막는다. 정지가 풀리면 키는 다시 쓸 수 있다.
 *
 * <p>IAM 내부 API(게이트웨이를 거치지 않는 Docker 내부 주소, 서비스 토큰 필요)를 부르고 결과를 짧게 캐시한다.
 * 정상(ACTIVE)은 {@code ttl}, 그 밖의 상태는 {@code inactiveTtl} 동안만 캐시해 정지 해제가 빨리 반영된다.
 * IAM 에 닿지 못하면 {@code staleTtl} 안의 이전 판정을 그대로 쓰고, 그것도 없으면 {@link Status#UNAVAILABLE}(호출자가 거부)이다.
 */
@Slf4j
@Component
public class AccountStatusChecker {

    public enum Status {
        /** 정상 계정 */
        ACTIVE,
        /** 정지·탈퇴 유예·영구 탈퇴·알 수 없는 계정: 키를 쓸 수 없다 */
        INACTIVE,
        /** IAM 에 확인하지 못했다(그리고 쓸 수 있는 이전 판정도 없다) */
        UNAVAILABLE
    }

    static final String TOKEN_HEADER = "X-Doro-Service-Token";
    private static final int MAX_ENTRIES = 10_000;

    private record Data(UUID userId, String status) {}

    private record Envelope(Data data) {}

    private record Entry(Status status, Instant fetchedAt) {}

    private final boolean enabled;
    private final String baseUrl;
    private final String token;
    private final Duration ttl;
    private final Duration inactiveTtl;
    private final Duration staleTtl;
    private final RestClient http;
    private final Clock clock;
    private final ConcurrentHashMap<UUID, Entry> cache = new ConcurrentHashMap<>();

    /** 스프링이 쓰는 생성자(시험용 생성자는 시계를 주입하려고 따로 있다). */
    @Autowired
    public AccountStatusChecker(
            @Value("${blog.api-key.account-status.enabled:true}") boolean enabled,
            @Value("${doro.iam.internal-url:http://localhost:28080}") String baseUrl,
            @Value("${doro.iam.internal-token:}") String token,
            @Value("${blog.api-key.account-status.cache-ttl:PT60S}") Duration ttl,
            @Value("${blog.api-key.account-status.inactive-cache-ttl:PT10S}") Duration inactiveTtl,
            @Value("${blog.api-key.account-status.stale-ttl:PT10M}") Duration staleTtl,
            @Value("${blog.api-key.account-status.connect-timeout:PT2S}") Duration connectTimeout,
            @Value("${blog.api-key.account-status.read-timeout:PT3S}") Duration readTimeout) {
        this(enabled, baseUrl, token, ttl, inactiveTtl, staleTtl, connectTimeout, readTimeout, Clock.systemUTC());
    }

    AccountStatusChecker(boolean enabled, String baseUrl, String token, Duration ttl, Duration inactiveTtl, Duration staleTtl,
                         Duration connectTimeout, Duration readTimeout, Clock clock) {
        this.enabled = enabled;
        this.baseUrl = baseUrl;
        this.token = token == null ? "" : token.trim();
        this.ttl = ttl;
        this.inactiveTtl = inactiveTtl;
        this.staleTtl = staleTtl;
        this.clock = clock;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) connectTimeout.toMillis());
        factory.setReadTimeout((int) readTimeout.toMillis());
        this.http = RestClient.builder().requestFactory(factory).build();
    }

    public Status check(UUID userId) {
        if (!enabled) {
            return Status.ACTIVE;
        }
        Instant now = clock.instant();
        Entry cached = cache.get(userId);
        if (cached != null && Duration.between(cached.fetchedAt(), now).compareTo(ttlFor(cached.status())) < 0) {
            return cached.status();
        }
        try {
            Status fresh = fetch(userId);
            remember(userId, fresh, now);
            return fresh;
        } catch (UnknownUser e) {
            remember(userId, Status.INACTIVE, now);
            return Status.INACTIVE;
        } catch (RestClientResponseException e) {
            // 401/403 은 서비스 토큰 설정 오류라 계정 문제가 아니다. 모든 API 키 요청이 거부되므로 눈에 띄게 남긴다.
            log.error("Doro IAM rejected the account status call (HTTP {}). Check doro.iam.internal-token: userId={}", e.getStatusCode().value(), userId);
        } catch (RestClientException | IllegalStateException e) {
            log.warn("Could not reach Doro IAM to check the account status: {}", e.toString());
        }
        // 확인하지 못했다: 최근 판정이 있으면 그것을 쓴다(IAM 이 잠깐 죽었다고 자동화가 멈추지 않게). 없으면 거부한다(fail-closed).
        if (cached != null && Duration.between(cached.fetchedAt(), now).compareTo(staleTtl) < 0) {
            return cached.status();
        }
        return Status.UNAVAILABLE;
    }

    private Duration ttlFor(Status status) {
        return status == Status.ACTIVE ? ttl : inactiveTtl;
    }

    private void remember(UUID userId, Status status, Instant now) {
        if (cache.size() >= MAX_ENTRIES) {
            cache.entrySet().removeIf(e -> Duration.between(e.getValue().fetchedAt(), now).compareTo(staleTtl) >= 0);
            if (cache.size() >= MAX_ENTRIES) {
                cache.clear();
            }
        }
        cache.put(userId, new Entry(status, now));
    }

    private static final class UnknownUser extends RuntimeException {
        UnknownUser() {
            super(null, null, false, false);
        }
    }

    private Status fetch(UUID userId) {
        Envelope body;
        try {
            body = http.get().uri(baseUrl + "/internal/v1/users/{id}/status", userId)
                    .headers(h -> {
                        if (!token.isEmpty()) {
                            h.set(TOKEN_HEADER, token);
                        }
                    })
                    .retrieve().body(new ParameterizedTypeReference<Envelope>() {});
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 404) {
                throw new UnknownUser();
            }
            throw e;
        }
        if (body == null || body.data() == null || body.data().status() == null) {
            throw new IllegalStateException("Doro IAM returned an unexpected account status response");
        }
        return "ACTIVE".equals(body.data().status()) ? Status.ACTIVE : Status.INACTIVE;
    }
}

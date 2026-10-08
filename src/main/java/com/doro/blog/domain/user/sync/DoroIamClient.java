package com.doro.blog.domain.user.sync;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Doro IAM 의 내부 API(게이트웨이를 거치지 않는 Docker 내부 주소)를 호출하는 서버 간 클라이언트.
 * IAM 이 호출자를 확인하도록 서비스 토큰(헤더 {@value #TOKEN_HEADER})을 함께 보낸다. 토큰은 환경변수로만 주고 로그에 남기지 않는다.
 */
@Slf4j
@Component
public class DoroIamClient {

    static final String TOKEN_HEADER = "X-Doro-Service-Token";

    public record DeletedUser(UUID userId, Instant deletedAt) {}

    public record DeletedUsersPage(List<DeletedUser> items, Instant nextSince) {}

    private record Envelope(DeletedUsersPage data) {}

    private final String baseUrl;
    private final String internalToken;
    private final RestClient http;

    public DoroIamClient(
            @Value("${doro.iam.internal-url:http://localhost:28080}") String baseUrl,
            @Value("${doro.iam.internal-token:}") String internalToken,
            @Value("${blog.deleted-sync.connect-timeout:PT3S}") Duration connectTimeout,
            @Value("${blog.deleted-sync.read-timeout:PT10S}") Duration readTimeout) {
        this.baseUrl = baseUrl;
        this.internalToken = internalToken == null ? "" : internalToken.trim();
        if (this.internalToken.isEmpty()) {
            log.warn("DORO_IAM_INTERNAL_TOKEN is not set: Doro IAM rejects internal API calls unless its internal auth mode is WARN/OFF");
        }
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) connectTimeout.toMillis());
        factory.setReadTimeout((int) readTimeout.toMillis());
        this.http = RestClient.builder().requestFactory(factory).build();
    }

    /** since 이후(포함)에 영구 탈퇴한 사용자를 오래된 순으로 가져온다. IAM 에 닿지 못하면 예외를 던진다. */
    public DeletedUsersPage fetchDeletedUsers(Instant since, int limit) {
        String uri = UriComponentsBuilder.fromUriString(baseUrl)
                .path("/internal/v1/deleted-users")
                .queryParam("since", since)
                .queryParam("limit", limit)
                .build()
                .toUriString();
        Envelope body = http.get().uri(uri)
                .headers(headers -> {
                    if (!internalToken.isEmpty()) {
                        headers.set(TOKEN_HEADER, internalToken);
                    }
                })
                .retrieve().body(new ParameterizedTypeReference<Envelope>() {});
        if (body == null || body.data() == null || body.data().items() == null || body.data().nextSince() == null) {
            throw new IllegalStateException("Doro IAM returned an unexpected deleted-users response");
        }
        return body.data();
    }
}

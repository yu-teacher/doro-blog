package com.doro.blog.infra.guard;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class BlogSchemaInitializer implements ApplicationRunner {

    private final ResourceLoader resourceLoader;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // 기본값은 application.yaml 의 doro.guard.http-url (환경변수 GUARD_HTTP_HOST/PORT) 한 곳에서만 정한다.
    @Value("${doro.guard.http-url}")
    private String guardHttpUrl;

    @Value("${doro.guard.http-timeout-ms}")
    private int guardHttpTimeoutMs;

    @Value("${doro.guard.service-token:}")
    private String guardServiceToken;

    /** Guard 가 응답하지 않아도 애플리케이션 기동이 무한정 멈추지 않도록 연결/읽기 타임아웃을 건다. */
    private RestTemplate newRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(guardHttpTimeoutMs);
        factory.setReadTimeout(guardHttpTimeoutMs);
        return new RestTemplate(factory);
    }

    @Override
    public void run(ApplicationArguments args) {
        RestTemplate restTemplate = newRestTemplate();
        log.info("Checking DORO Guard Zanzibar schema synchronization...");
        try {
            String schemaUrl = guardHttpUrl + "/api/v1/guard/schema";
            ResponseEntity<String> response = restTemplate.exchange(
                    schemaUrl, HttpMethod.GET, new HttpEntity<>(guardHeaders()), String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.warn("Could not retrieve active schema from Guard: status={}", response.getStatusCode());
                return;
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            String activeDsl = root.path("data").asText("");

            // blog-schema.doro 읽기
            Resource blogSchemaRes = resourceLoader.getResource("classpath:blog-schema.doro");
            if (!blogSchemaRes.exists()) {
                log.warn("blog-schema.doro not found in classpath.");
                return;
            }

            String blogDsl;
            try (InputStream is = blogSchemaRes.getInputStream()) {
                blogDsl = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            }

            // Guard 스키마 등록은 전체 교체다. 활성 스키마는 그대로 두고, Guard 에 없는 블로그 타입만 뒤에 덧붙인다.
            // (예전에는 blog_post/blog_series 가 있으면 끝냈기 때문에 나중에 추가한 타입이 운영에 등록되지 않았다.)
            BlogSchemaMerger.Result merge = BlogSchemaMerger.merge(activeDsl, blogDsl);
            if (!merge.differingTypes().isEmpty()) {
                log.warn("Guard already has blog types whose content differs from blog-schema.doro: {}. "
                        + "They are NOT changed automatically; review them in Guard.", merge.differingTypes());
            }
            if (!merge.changed()) {
                log.info("DORO Guard already contains every blog schema type. Sync complete.");
                return;
            }
            log.info("Registering missing blog schema types in DORO Guard: {}", merge.addedTypes());
            String combinedDsl = merge.mergedDsl();

            HttpHeaders headers = guardHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> request = new HttpEntity<>(Map.of("dsl", combinedDsl), headers);

            ResponseEntity<String> postRes = restTemplate.postForEntity(schemaUrl, request, String.class);
            if (postRes.getStatusCode().is2xxSuccessful()) {
                log.info("Successfully registered Blog ReBAC schema to DORO Guard dynamically.");
            } else {
                log.warn("Failed to register blog schema: status={}", postRes.getStatusCode());
            }

        } catch (Exception e) {
            log.warn("Guard schema dynamic sync skipped (Guard may be offline or unreachable): {}", e.getMessage());
        }
    }

    private HttpHeaders guardHeaders() {
        HttpHeaders headers = new HttpHeaders();
        if (guardServiceToken != null && !guardServiceToken.isBlank()) {
            headers.set("X-Doro-Service-Token", guardServiceToken);
        }
        return headers;
    }
}

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
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${doro.guard.http-url:http://192.168.0.101:8081}")
    private String guardHttpUrl;

    @Override
    public void run(ApplicationArguments args) {
        log.info("Checking DORO Guard Zanzibar schema synchronization...");
        try {
            String schemaUrl = guardHttpUrl + "/api/v1/guard/schema";
            ResponseEntity<String> response = restTemplate.getForEntity(schemaUrl, String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.warn("Could not retrieve active schema from Guard: status={}", response.getStatusCode());
                return;
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            String activeDsl = root.path("data").asText("");

            if (activeDsl.contains("type blog_post") && activeDsl.contains("type blog_series")) {
                log.info("DORO Guard already contains blog schema types. Sync complete.");
                return;
            }

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

            String combinedDsl = activeDsl + "\n\n" + blogDsl;

            HttpHeaders headers = new HttpHeaders();
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
}

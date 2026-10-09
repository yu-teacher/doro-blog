package com.doro.blog.domain.apikey.security;

import com.doro.blog.common.response.ApiResponse;
import com.doro.blog.domain.apikey.entity.ApiKey;
import com.doro.blog.domain.apikey.service.ApiKeyService;
import com.doro.blog.domain.user.entity.BlogUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import com.hunnit_beasts.doro.sdk.domain.DoroUserContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
@RequiredArgsConstructor
public class ApiKeyAuthFilter extends OncePerRequestFilter {

    private final ApiKeyService apiKeyService;
    // 필터는 Spring MVC 의 메시지 컨버터를 거치지 않으므로, Instant(timestamp)를 직렬화할 수 있는 매퍼를 직접 구성한다
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    public static final String API_KEY_HEADER = "X-API-Key";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String rawApiKey = extractApiKey(request);

        // If no API Key header, continue chain (regular JWT auth / public endpoint)
        if (rawApiKey == null) {
            filterChain.doFilter(request, response);
            return;
        }

        long startTime = System.currentTimeMillis();
        String clientIp = extractClientIp(request);
        String userAgent = request.getHeader("User-Agent");
        String uri = request.getRequestURI();
        String method = request.getMethod();

        Optional<ApiKey> optKey = apiKeyService.validateAndUseApiKey(rawApiKey);

        if (optKey.isEmpty()) {
            long duration = System.currentTimeMillis() - startTime;
            log.warn("Invalid or expired API Key attempt: ip={}, uri={}, keyPrefix={}",
                    clientIp, uri, rawApiKey.substring(0, Math.min(10, rawApiKey.length())));

            // Write 401 Unauthorized JSON error
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");

            ApiResponse<Void> errBody = ApiResponse.error(HttpStatus.UNAUTHORIZED, "AUTH-401-02", "유효하지 않거나 만료된 API 키입니다.");
            response.getWriter().write(objectMapper.writeValueAsString(errBody));
            return;
        }

        ApiKey apiKey = optKey.get();
        BlogUser owner = apiKey.getUser();

        // API 키는 글 자동 발행용 범위로 제한한다 (키 발급/폐기, 계정 변경 등 관리 API 는 JWT 로만)
        if (!ApiKeyScope.allows(uri)) {
            log.warn("API Key used outside its scope: keyId={}, ip={}, method={}, uri={}", apiKey.getId(), clientIp, method, uri);
            response.setStatus(HttpStatus.FORBIDDEN.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(objectMapper.writeValueAsString(
                    ApiResponse.error(HttpStatus.FORBIDDEN, "AUTH-403-02", "API 키로는 사용할 수 없는 기능입니다. 로그인 후 이용해 주세요.")));
            return;
        }

        // 키는 조회·작성·수정만 한다. 삭제는 로그인(JWT)으로만 가능하다 — 유출된 키로 글·시리즈를 지울 수 없게 한다.
        if (!ApiKeyScope.allowsMethod(method)) {
            log.warn("API Key used with a disallowed method: keyId={}, ip={}, method={}, uri={}", apiKey.getId(), clientIp, method, uri);
            response.setStatus(HttpStatus.FORBIDDEN.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(objectMapper.writeValueAsString(
                    ApiResponse.error(HttpStatus.FORBIDDEN, "AUTH-403-03", "API 키로는 삭제할 수 없습니다. 삭제는 로그인 후 이용해 주세요.")));
            return;
        }

        // Inject DoroUser into DoroUserContext so @CurrentDoroUser and @DoroGuard resolve seamlessly!
        DoroUser doroUser = new DoroUser(
                owner.getId(),
                owner.getEmail(),
                UUID.randomUUID(),
                0,
                "USER"
        );
        DoroUserContext.setCurrentUser(doroUser);

        try {
            filterChain.doFilter(request, response);
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            int status = response.getStatus();
            String errorMsg = status >= 400 ? "HTTP " + status : null;

            // 사용 기록 저장이 실패해도(DB 일시 장애, 소유자 행이 막 삭제됨 등) 요청 결과는 그대로 두고, 신원은 반드시 비운다.
            // 비우지 못하면 같은 스레드가 처리하는 다음 요청에 키 소유자로 인증된 채 남을 수 있다.
            try {
                apiKeyService.recordLog(
                        apiKey.getId(),
                        owner,
                        method,
                        uri,
                        status,
                        clientIp,
                        userAgent,
                        duration,
                        errorMsg
                );
            } catch (RuntimeException e) {
                log.warn("Failed to record API key usage log: keyId={}, method={}, uri={}", apiKey.getId(), method, uri, e);
            } finally {
                DoroUserContext.clear();
            }
        }
    }

    private String extractApiKey(HttpServletRequest request) {
        String key = request.getHeader(API_KEY_HEADER);
        if (key != null && !key.isBlank()) {
            return key.trim();
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer doro_live_")) {
            return authHeader.substring(7).trim();
        }

        return null;
    }

    private String extractClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "UNKNOWN";
    }
}

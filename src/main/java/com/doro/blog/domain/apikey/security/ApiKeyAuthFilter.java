package com.doro.blog.domain.apikey.security;

import com.doro.blog.domain.apikey.entity.ApiKey;
import com.doro.blog.domain.apikey.service.ApiKeyService;
import com.doro.blog.domain.user.entity.BlogUser;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
@RequiredArgsConstructor
public class ApiKeyAuthFilter extends OncePerRequestFilter {

    private final ApiKeyService apiKeyService;
    private final ObjectMapper objectMapper = new ObjectMapper();

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

            Map<String, Object> errBody = Map.of(
                    "success", false,
                    "error", Map.of(
                            "code", "AUTH-401-02",
                            "message", "유효하지 않거나 만료된 API 키입니다."
                    )
            );
            response.getWriter().write(objectMapper.writeValueAsString(errBody));
            return;
        }

        ApiKey apiKey = optKey.get();
        BlogUser owner = apiKey.getUser();

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

            // Record request log for this API key
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

            DoroUserContext.clear();
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

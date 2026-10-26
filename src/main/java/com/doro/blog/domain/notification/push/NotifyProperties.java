package com.doro.blog.domain.notification.push;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * 플랫폼 알림 서비스(doro-notify) 연결 설정(blog.notify.*). 설계: Doro 저장소 docs/NOTIFICATION_SERVICE_DESIGN.md.
 *
 * <p>스위치는 {@code serviceToken} 하나다. 비어 있으면(기본) 아무것도 하지 않는다: 아웃박스에 쌓지 않고 알림 서비스를 부르지 않으며,
 * 푸시 설정 API 는 "사용할 수 없음"으로 답한다. 토큰이 있으면 켜진다. 되돌리기는 토큰을 비우는 것이다.
 *
 * @param baseUrl      알림 서비스 내부 주소(게이트웨이를 거치지 않는 Docker 내부 주소)
 * @param serviceToken 알림 서비스 내부 API 호출자 토큰(알림 서비스의 NOTIFY_INTERNAL_TOKENS 에 'blog:<토큰>' 으로 등록한 값). 로그에 남기지 않는다
 * @param basePath     블로그 웹이 마운트된 공개 하위 경로. 알림 주소를 알림 서비스가 받는 절대 경로(앱 범위 안)로 만들 때 쓴다
 */
@ConfigurationProperties(prefix = "blog.notify")
public record NotifyProperties(
        String baseUrl,
        String serviceToken,
        String basePath,
        Duration connectTimeout,
        Duration readTimeout,
        Duration outboxInterval
) {
    public NotifyProperties {
        baseUrl = baseUrl == null || baseUrl.isBlank() ? "http://notify-api:8089" : baseUrl.strip().replaceAll("/+$", "");
        serviceToken = serviceToken == null ? "" : serviceToken.strip();
        basePath = normalizeBasePath(basePath);
        connectTimeout = connectTimeout == null ? Duration.ofSeconds(2) : connectTimeout;
        readTimeout = readTimeout == null ? Duration.ofSeconds(3) : readTimeout;
        outboxInterval = outboxInterval == null ? Duration.ofSeconds(5) : outboxInterval;
    }

    /** 알림 서비스를 쓸 준비가 됐는가(토큰이 있다). 아니면 어떤 호출도, 아웃박스 기록도 하지 않는다. */
    public boolean enabled() {
        return !serviceToken.isEmpty();
    }

    /** 블로그 앱 범위 경로의 접두(항상 '/' 로 시작해 '/' 로 끝난다. 예: /blog/). 알림 서비스의 앱 등록 scope_path 와 같아야 한다. */
    public String scopePath() {
        return basePath + "/";
    }

    /** 블로그 안의 경로(예: {@code /@name/slug})를 알림 서비스가 받는 앱 범위 절대 경로로 바꾼다. */
    public String toNotifyUrl(String pathInBlog) {
        return basePath + (pathInBlog.startsWith("/") ? pathInBlog : "/" + pathInBlog);
    }

    private static String normalizeBasePath(String value) {
        // 비어 있으면 앱 범위 기본값(/blog). 알림 서비스의 scope_path 는 항상 하위 경로라서 루트('')는 쓰지 않는다
        String path = value == null || value.isBlank() ? "/blog" : value.strip();
        path = path.replaceAll("/+$", "");
        if (path.isEmpty()) {
            return "/blog";
        }
        return path.startsWith("/") ? path : "/" + path;
    }
}

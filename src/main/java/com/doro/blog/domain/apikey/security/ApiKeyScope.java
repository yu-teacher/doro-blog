package com.doro.blog.domain.apikey.security;

import java.util.List;

/**
 * API 키로 호출할 수 있는 경로 범위. API 키는 글 자동 발행용이므로 글/시리즈/태그/업로드 API 에만 쓸 수 있다.
 * API 키 발급·폐기, 프로필/계정 변경, 알림 같은 관리 API 는 거부한다. 유출된 키로 새 키를 만들어 두면
 * 원래 키를 폐기해도 접근이 유지되기 때문이다.
 */
public final class ApiKeyScope {

    private static final List<String> ALLOWED_PREFIXES = List.of(
            "/api/v1/posts",
            "/api/v1/series",
            "/api/v1/tags",
            "/api/v1/uploads"
    );

    private ApiKeyScope() {
    }

    public static boolean allows(String requestUri) {
        if (requestUri == null) return false;
        return ALLOWED_PREFIXES.stream().anyMatch(prefix -> requestUri.equals(prefix) || requestUri.startsWith(prefix + "/"));
    }
}

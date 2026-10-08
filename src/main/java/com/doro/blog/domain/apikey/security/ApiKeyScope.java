package com.doro.blog.domain.apikey.security;

import java.util.List;
import java.util.Locale;
import java.util.Set;

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

    /**
     * API 키로 보낼 수 있는 HTTP 메서드. 조회·작성·수정(CRU)만 허용하고 삭제는 JWT 로그인으로만 할 수 있다.
     * 자동화용 키가 유출돼도 글·시리즈를 지울 수 없게 하려는 것이다.
     */
    private static final Set<String> ALLOWED_METHODS = Set.of("GET", "HEAD", "POST", "PUT", "PATCH");

    private ApiKeyScope() {
    }

    public static boolean allowsMethod(String method) {
        return method != null && ALLOWED_METHODS.contains(method.toUpperCase(Locale.ROOT));
    }

    public static boolean allows(String requestUri) {
        if (requestUri == null) return false;
        return ALLOWED_PREFIXES.stream().anyMatch(prefix -> requestUri.equals(prefix) || requestUri.startsWith(prefix + "/"));
    }
}

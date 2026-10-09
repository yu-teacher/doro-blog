package com.doro.blog.domain.user.service;

import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/** 블로그 사용자명(@username) 생성·검증 규칙. 라우트와 충돌하는 이름과 이메일 노출을 막는다. */
public final class UsernamePolicy {

    public static final int MIN_LENGTH = 3;
    public static final int MAX_LENGTH = 50;
    /** 프런트 라우트·게이트웨이 경로와 겹치거나 운영자로 오인될 수 있는 이름. */
    private static final Set<String> RESERVED = Set.of(
            "admin", "administrator", "root", "system", "support", "staff", "moderator", "official",
            "api", "me", "write", "edit", "search", "tags", "tag", "series", "settings", "login", "logout",
            "signup", "signin", "register", "auth", "iam", "oauth2", "portal", "logs", "loki", "media",
            "assets", "static", "public", "health", "actuator", "swagger", "docs", "feed", "trending",
            "notifications", "developers", "null", "undefined");

    private UsernamePolicy() {
    }

    public static boolean isReserved(String username) {
        return username != null && RESERVED.contains(username.toLowerCase(Locale.ROOT));
    }

    /**
     * 처음 로그인한 사용자의 사용자명. 사용자 ID 의 앞 8자리로 만든다(예: user-8f3a1c2d).
     * 사용자명은 공개 주소(/@사용자명)에 그대로 드러나므로 이메일의 어떤 부분도 쓰지 않는다. 이름은 프로필에서 바꿀 수 있다.
     * 접두사 "user-" 때문에 예약어와 겹치지 않고, 중복 꼬리표를 붙여도 최대 길이를 넘지 않는다.
     */
    public static String generated(UUID userId) {
        return "user-" + userId.toString().substring(0, 8);
    }
}

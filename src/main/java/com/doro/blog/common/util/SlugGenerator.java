package com.doro.blog.common.util;

import java.util.UUID;
import java.util.function.Predicate;

/** 글/시리즈 URL 슬러그 생성. 소문자 영문, 숫자, 한글, '_', '-' 만 남긴다. */
public final class SlugGenerator {

    private static final String DISALLOWED = "[^a-z0-9가-힣_-]";
    private static final int SUFFIX_LENGTH = 6;
    private static final int MAX_ATTEMPTS = 5;
    /** DB 컬럼 길이(posts.slug VARCHAR(255), series.slug VARCHAR(120)) 중 작은 값에서 접미사 여유를 뺀 값. */
    private static final int MAX_BASE_LENGTH = 100;

    private SlugGenerator() {
    }

    /** 문자열을 슬러그 형태로 바꾼다. 쓸 수 있는 글자가 하나도 없으면 빈 문자열이다. */
    public static String sanitize(String raw) {
        String slug = raw.toLowerCase().trim().replaceAll(DISALLOWED, "-");
        if (slug.length() > MAX_BASE_LENGTH) {
            slug = slug.substring(0, MAX_BASE_LENGTH);
        }
        return slug.replace("-", "").isEmpty() ? "" : slug;
    }

    /**
     * 요청한 슬러그(없으면 제목)로 슬러그를 만들고, 이미 쓰는 중이면 무작위 접미사를 붙여 겹치지 않는 값을 찾는다.
     * 제목이 기호뿐이라 쓸 글자가 없으면 접두어 + 접미사로 대체한다.
     */
    public static String unique(String requestedSlug, String title, String fallbackPrefix, Predicate<String> exists) {
        String base = requestedSlug != null && !requestedSlug.isBlank() ? sanitize(requestedSlug) : "";
        if (base.isEmpty()) {
            base = sanitize(title);
        }
        if (base.isEmpty()) {
            base = fallbackPrefix;
        }
        if (!exists.test(base)) {
            return base;
        }
        for (int i = 0; i < MAX_ATTEMPTS; i++) {
            String candidate = base + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, SUFFIX_LENGTH);
            if (!exists.test(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not find a free slug for base: " + base);
    }
}

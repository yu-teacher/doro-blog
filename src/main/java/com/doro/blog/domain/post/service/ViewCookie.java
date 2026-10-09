package com.doro.blog.domain.post.service;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 조회수 중복 방지 쿠키(post_view)의 값 규칙. 값은 "[사용자명/슬러그]" 항목을 "_" 로 이은 문자열이다.
 * 항목은 최근 것만 MAX_ENTRIES 개까지 남겨 값이 무한히 늘어 헤더 한도(4KB)를 넘지 않게 하고,
 * 쿠키 값에 쓸 수 없는 글자(한글 슬러그 등)는 퍼센트 인코딩한다.
 */
public final class ViewCookie {

    public static final String NAME = "post_view";
    /** 한 쿠키에 기억하는 글 수. 항목 하나가 길어야 수백 바이트라 이 정도면 4KB 안에 들어간다. */
    public static final int MAX_ENTRIES = 30;

    private static final Pattern ENTRY = Pattern.compile("\\[([^\\]]+)\\]");

    private ViewCookie() {
    }

    /** 쿠키 값에서 본 글 목록(오래된 것부터)을 꺼낸다. */
    public static List<String> entries(String cookieValue) {
        List<String> result = new ArrayList<>();
        if (cookieValue == null || cookieValue.isEmpty()) {
            return result;
        }
        Matcher matcher = ENTRY.matcher(cookieValue);
        while (matcher.find()) {
            result.add(decode(matcher.group(1)));
        }
        return result;
    }

    public static boolean hasViewed(String cookieValue, String key) {
        return entries(cookieValue).contains(key);
    }

    /** key 를 맨 뒤에 추가한 새 쿠키 값. 이미 있으면 맨 뒤로 옮기고, 오래된 항목은 MAX_ENTRIES 를 넘으면 버린다. */
    public static String withViewed(String cookieValue, String key) {
        List<String> list = entries(cookieValue);
        list.remove(key);
        list.add(key);
        int from = Math.max(0, list.size() - MAX_ENTRIES);
        StringBuilder value = new StringBuilder();
        for (String entry : list.subList(from, list.size())) {
            if (value.length() > 0) {
                value.append('_');
            }
            value.append('[').append(encode(entry)).append(']');
        }
        return value.toString();
    }

    /** 쿠키 값에 쓸 수 있는 글자(ASCII 영숫자, - . _ ~ /)만 남기고 나머지는 %XX 로 바꾼다. "[", "]", "_" 구분자와 겹치지 않게 "_" 도 인코딩한다. */
    private static String encode(String raw) {
        StringBuilder out = new StringBuilder();
        for (byte b : raw.getBytes(StandardCharsets.UTF_8)) {
            char c = (char) (b & 0xFF);
            boolean safe = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '.' || c == '~' || c == '/';
            if (safe) {
                out.append(c);
            } else {
                out.append('%').append(String.format("%02X", b & 0xFF));
            }
        }
        return out.toString();
    }

    private static String decode(String encoded) {
        try {
            return URLDecoder.decode(encoded.replace("+", "%2B"), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return encoded; // 형식이 깨진 값은 그대로 둔다(다른 항목과 일치하지 않을 뿐이다)
        }
    }
}

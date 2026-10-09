package com.doro.blog.domain.tag.service;

/**
 * 태그 이름 정규화의 단일 지점. 저장할 때와 피드·검색에서 거를 때 같은 규칙을 써야
 * 입력한 그대로(Node.js 등)로도 같은 태그가 찾아진다.
 */
public final class TagNames {

    /** tags.name 컬럼 길이. 요청 검증을 우회한 경로(API 키 등)에서도 INSERT 가 실패하지 않게 한 번 더 자른다. */
    public static final int MAX_LENGTH = 50;

    private TagNames() {
    }

    /** 정규화한 태그 이름. 남는 문자가 없으면 빈 문자열이다. */
    public static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        String name = raw.trim().toLowerCase().replaceAll("[^a-z0-9가-힣_-]", "");
        return name.length() > MAX_LENGTH ? name.substring(0, MAX_LENGTH) : name;
    }
}

package com.doro.blog.common.util;

/**
 * LIKE 패턴에 넣을 사용자 입력에서 와일드카드를 무력화한다. 쿼리는 ESCAPE '!' 를 쓴다.
 * 이스케이프하지 않으면 검색어 "%" 가 모든 글에 일치해 전체 테이블을 훑게 된다.
 */
public final class LikeEscape {

    public static final char ESCAPE_CHAR = '!';

    private LikeEscape() {
    }

    public static String escape(String keyword) {
        return keyword
                .replace("!", "!!")
                .replace("%", "!%")
                .replace("_", "!_");
    }
}

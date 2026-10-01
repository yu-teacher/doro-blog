package com.doro.blog.common.util;

/**
 * LIKE 패턴에 넣을 사용자 입력에서 와일드카드를 무력화한다. 쿼리는 ESCAPE '!' 를 쓴다.
 * 이스케이프하지 않으면 검색어 "%" 가 모든 글에 일치해 전체 테이블을 훑게 된다.
 */
public final class LikeEscape {

    public static final char ESCAPE_CHAR = '!';

    private LikeEscape() {
    }

    /**
     * "키워드를 포함" 검색용 LIKE 패턴(소문자, 와일드카드 이스케이프 완료)을 만든다. 쿼리는 LOWER(col) LIKE :pattern ESCAPE '!'.
     * 패턴을 DB 에서 CONCAT 으로 조립하면 플래너가 상수로 접지 못해 trigram 인덱스를 쓰지 못하므로 자바에서 완성해서 넘긴다.
     */
    public static String containsPattern(String keyword) {
        return "%" + escape(keyword.toLowerCase(java.util.Locale.ROOT)) + "%";
    }

    public static String escape(String keyword) {
        return keyword
                .replace("!", "!!")
                .replace("%", "!%")
                .replace("_", "!_");
    }
}

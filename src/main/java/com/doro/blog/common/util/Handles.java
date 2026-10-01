package com.doro.blog.common.util;

/** URL 에서 쓰는 채널 핸들(@username) 처리. */
public final class Handles {

    private Handles() {
    }

    /** 앞의 '@' 한 글자를 떼어 낸다. 대소문자/공백 정규화는 호출자가 필요에 따라 한다. */
    public static String stripAt(String handle) {
        return handle.startsWith("@") ? handle.substring(1) : handle;
    }
}

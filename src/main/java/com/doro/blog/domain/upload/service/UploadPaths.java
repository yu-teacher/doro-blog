package com.doro.blog.domain.upload.service;

import java.util.Set;

/** 업로드 대상 폴더와 표시용 파일명 정리. */
public final class UploadPaths {

    /** 업로드를 허용하는 하위 폴더. 클라이언트가 보낸 값을 그대로 오브젝트 키에 넣지 않는다. */
    public static final Set<String> ALLOWED_DIRECTORIES = Set.of("posts", "thumbnails");
    public static final String DEFAULT_DIRECTORY = "posts";

    private static final int MAX_DISPLAY_NAME_LENGTH = 100;

    private UploadPaths() {
    }

    /** 허용된 폴더면 그대로, 아니면 기본 폴더. */
    public static String directory(String requested) {
        String clean = requested == null ? "" : requested.trim().toLowerCase();
        return ALLOWED_DIRECTORIES.contains(clean) ? clean : DEFAULT_DIRECTORY;
    }

    /**
     * 응답으로 돌려줄 원본 파일명. 마크다운 이미지 문법(![이름](주소))에 그대로 들어가므로
     * 대괄호/소괄호/줄바꿈 같은 문법 문자를 제거하고 길이를 제한한다.
     */
    public static String displayName(String originalFilename) {
        String name = originalFilename == null ? "" : originalFilename;
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        name = name.substring(slash + 1).replaceAll("[\\[\\]()<>\\r\\n\\t]", "").trim();
        if (name.isEmpty()) return "image";
        return name.length() > MAX_DISPLAY_NAME_LENGTH ? name.substring(0, MAX_DISPLAY_NAME_LENGTH) : name;
    }
}

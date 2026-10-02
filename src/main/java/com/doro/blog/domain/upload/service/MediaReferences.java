package com.doro.blog.domain.upload.service;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 글 본문·썸네일 같은 텍스트에서 이 서비스가 업로드한 파일의 오브젝트 키를 찾는다.
 * 업로드가 만드는 키 모양(폴더/연/월/UUID.확장자)과 정확히 일치하는 것만 돌려주므로, 임의의 경로를 지우는 데 쓰일 수 없다.
 */
public final class MediaReferences {

    private static final Pattern KEY = Pattern.compile(
            "/((?:posts|thumbnails)/\\d{4}/\\d{2}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.[a-z0-9]{2,5})(?![A-Za-z0-9])");

    private MediaReferences() {
    }

    public static Set<String> keysIn(String... texts) {
        Set<String> keys = new LinkedHashSet<>();
        for (String text : texts) {
            if (text == null || text.isEmpty()) {
                continue;
            }
            Matcher matcher = KEY.matcher(text);
            while (matcher.find()) {
                keys.add(matcher.group(1));
            }
        }
        return keys;
    }
}

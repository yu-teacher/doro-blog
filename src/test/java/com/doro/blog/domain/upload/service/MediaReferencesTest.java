package com.doro.blog.domain.upload.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MediaReferencesTest {

    private static final String KEY = "posts/2026/09/27e4bb22-dd76-495c-9709-ae3f75ba5e90.png";
    private static final String THUMB = "thumbnails/2026/10/0a1b2c3d-1111-2222-3333-444455556666.webp";

    @Test
    @DisplayName("상대 경로와 절대 URL, 마크다운 이미지 문법에서 업로드 키를 찾는다")
    void findsKeysInDifferentForms() {
        String content = "본문 ![a](/media/" + KEY + ") 와 <img src=\"https://blog.example.com/media/" + THUMB + "\">";

        assertThat(MediaReferences.keysIn(content)).containsExactlyInAnyOrder(KEY, THUMB);
    }

    @Test
    @DisplayName("같은 키는 한 번만, null 과 빈 문자열은 무시")
    void deduplicatesAndIgnoresEmpty() {
        assertThat(MediaReferences.keysIn(null, "", "/media/" + KEY, "![x](/media/" + KEY + ")")).containsExactly(KEY);
    }

    @Test
    @DisplayName("업로드 키 모양이 아닌 것은 찾지 않는다 (임의 경로를 지우는 데 쓰일 수 없다)")
    void ignoresNonUploadShapes() {
        assertThat(MediaReferences.keysIn(
                "/media/../etc/passwd",
                "/media/posts/2026/09/not-a-uuid.png",
                "/media/other/2026/09/27e4bb22-dd76-495c-9709-ae3f75ba5e90.png",
                "https://example.com/avatar.png"
        )).isEmpty();
    }
}

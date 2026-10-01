package com.doro.blog.domain.upload.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UploadPathsTest {

    @Test
    @DisplayName("허용된 폴더만 쓰고, 그 밖의 값(경로 조작 포함)은 기본 폴더로 바꾼다")
    void directoryAllowlist() {
        assertThat(UploadPaths.directory("thumbnails")).isEqualTo("thumbnails");
        assertThat(UploadPaths.directory("  Posts ")).isEqualTo("posts");
        assertThat(UploadPaths.directory("../../etc")).isEqualTo("posts");
        assertThat(UploadPaths.directory("avatars/../../x")).isEqualTo("posts");
        assertThat(UploadPaths.directory(null)).isEqualTo("posts");
        assertThat(UploadPaths.directory("")).isEqualTo("posts");
    }

    @Test
    @DisplayName("표시용 파일명에서 마크다운/HTML 문법 문자와 경로를 제거한다")
    void displayNameIsSanitized() {
        assertThat(UploadPaths.displayName("C:\\Users\\me\\photo.png")).isEqualTo("photo.png");
        assertThat(UploadPaths.displayName("a](http://evil)[b.png")).isEqualTo("evilb.png");
        assertThat(UploadPaths.displayName("<img src=x>.png")).isEqualTo("img src=x.png");
        assertThat(UploadPaths.displayName("line\nbreak.png")).isEqualTo("linebreak.png");
        assertThat(UploadPaths.displayName(null)).isEqualTo("image");
        assertThat(UploadPaths.displayName("()")).isEqualTo("image");
        assertThat(UploadPaths.displayName("x".repeat(300)).length()).isEqualTo(100);
    }
}

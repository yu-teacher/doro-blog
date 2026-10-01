package com.doro.blog.domain.upload.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImageValidatorTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0, 0, 0, 0, 0, 0, 0};
    private static final byte[] GIF = {'G', 'I', 'F', '8', '9', 'a', 0, 0, 0, 0, 0, 0};
    private static final byte[] WEBP = {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'};

    private ImageValidator.DetectedImage validate(byte[] bytes, String filename) {
        return ImageValidator.validate(new ByteArrayInputStream(bytes), filename);
    }

    @Test
    @DisplayName("PNG/JPEG/GIF/WebP 는 첫 바이트로 판별하고 표준 확장자를 돌려준다")
    void detectsSupportedFormats() {
        assertThat(validate(PNG, "a.png")).isEqualTo(new ImageValidator.DetectedImage("image/png", "png"));
        assertThat(validate(JPEG, "a.jpg")).isEqualTo(new ImageValidator.DetectedImage("image/jpeg", "jpg"));
        assertThat(validate(JPEG, "a.jpeg").extension()).isEqualTo("jpg");
        assertThat(validate(GIF, "a.gif").contentType()).isEqualTo("image/gif");
        assertThat(validate(WEBP, "A.WEBP").contentType()).isEqualTo("image/webp");
    }

    @Test
    @DisplayName("확장자가 없으면 내용만으로 판별한다")
    void extensionIsOptional() {
        assertThat(validate(PNG, "screenshot").contentType()).isEqualTo("image/png");
        assertThat(validate(PNG, null).contentType()).isEqualTo("image/png");
    }

    @Test
    @DisplayName("이미지인 척하는 HTML/스크립트는 확장자와 Content-Type 이 이미지여도 거부한다")
    void rejectsDisguisedContent() {
        byte[] html = "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8);
        assertThatThrownBy(() -> validate(html, "evil.png"))
                .isInstanceOf(BlogException.class).hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_FILE_TYPE);
    }

    @Test
    @DisplayName("SVG 는 스크립트를 담을 수 있어 허용하지 않는다")
    void rejectsSvg() {
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes(StandardCharsets.UTF_8);
        assertThatThrownBy(() -> validate(svg, "x.svg")).isInstanceOf(BlogException.class);
    }

    @Test
    @DisplayName("확장자와 실제 형식이 다르면 거부한다 (PNG 내용을 .gif 로 올리는 경우 등)")
    void rejectsMismatchedExtension() {
        assertThatThrownBy(() -> validate(PNG, "x.gif")).isInstanceOf(BlogException.class);
        assertThatThrownBy(() -> validate(JPEG, "x.png")).isInstanceOf(BlogException.class);
    }

    @Test
    @DisplayName("너무 짧거나 비어 있는 파일은 거부한다")
    void rejectsTruncated() {
        assertThatThrownBy(() -> validate(new byte[0], "x.png")).isInstanceOf(BlogException.class);
        assertThatThrownBy(() -> validate(new byte[]{(byte) 0x89, 'P'}, "x.png")).isInstanceOf(BlogException.class);
    }
}

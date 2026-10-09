package com.doro.blog.domain.upload.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/** SVG 표현 속성에 CSS 이스케이프(\72 = r)로 숨긴 외부 url() 이 정제기를 통과하지 못한다. */
class SvgCssEscapeTest {

    private String sanitize(String svg) {
        return new String(SvgSanitizer.sanitize(svg.getBytes(StandardCharsets.UTF_8)), StandardCharsets.UTF_8);
    }

    @Test
    @DisplayName("fill 속성의 u\\72l(https://...) 같은 이스케이프된 외부 주소는 제거된다")
    void escapedExternalUrlInPresentationAttributeIsDropped() {
        String out = sanitize("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\">"
                + "<rect width=\"5\" height=\"5\" fill=\"u\\72l(https://evil.test/beacon)\"/></svg>");

        assertThat(out).doesNotContain("evil.test");
    }

    @Test
    @DisplayName("기준: 이스케이프 없는 외부 url() 은 이미 제거된다")
    void plainExternalUrlIsDropped() {
        String out = sanitize("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\">"
                + "<rect width=\"5\" height=\"5\" fill=\"url(https://evil.test/beacon)\"/></svg>");

        assertThat(out).doesNotContain("evil.test");
    }
}

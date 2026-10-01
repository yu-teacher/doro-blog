package com.doro.blog.domain.user.dto;

import com.doro.blog.domain.post.dto.PostDtos;
import com.doro.blog.domain.post.entity.PostStatus;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class ProfileUrlValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private BlogUserDtos.UpdateProfileRequest profile(String website, String image, String email) {
        return new BlogUserDtos.UpdateProfileRequest(null, null, null, image, null, null, null, website, email, null, null);
    }

    private boolean invalid(BlogUserDtos.UpdateProfileRequest request, String field) {
        return validator.validate(request).stream().anyMatch(v -> v.getPropertyPath().toString().equals(field));
    }

    @ParameterizedTest(name = "허용: {0}")
    @ValueSource(strings = {"", "https://example.com", "http://example.com/a?b=c#d", "HTTPS://EXAMPLE.COM"})
    @DisplayName("웹사이트 URL: 빈 값과 http(s) 주소는 허용")
    void websiteAcceptsHttpUrls(String url) {
        assertThat(invalid(profile(url, null, null), "websiteUrl")).isFalse();
    }

    @ParameterizedTest(name = "거부: {0}")
    @ValueSource(strings = {
            "javascript:alert(document.cookie)", "JaVaScRiPt:alert(1)", "data:text/html,<script>alert(1)</script>",
            "vbscript:msgbox(1)", "//evil.example/x", "ftp://example.com", "example.com", "https://exa mple.com", "file:///etc/passwd"
    })
    @DisplayName("웹사이트 URL: javascript:/data: 등 http(s) 가 아닌 주소는 거부")
    void websiteRejectsDangerousSchemes(String url) {
        assertThat(invalid(profile(url, null, null), "websiteUrl")).isTrue();
    }

    @ParameterizedTest(name = "허용: {0}")
    @ValueSource(strings = {"", "https://cdn.example.com/a.png", "/media/doro-blog-media/avatar.png"})
    @DisplayName("프로필 이미지: http(s) 주소와 자체 /media 경로는 허용")
    void imageAcceptsHttpAndLocalMedia(String url) {
        assertThat(invalid(profile(null, url, null), "profileImageUrl")).isFalse();
    }

    @ParameterizedTest(name = "거부: {0}")
    @ValueSource(strings = {"javascript:alert(1)", "data:image/svg+xml,<svg onload=alert(1)>", "//evil.example/a.png", "media/a.png"})
    @DisplayName("프로필 이미지: 위험하거나 모호한 주소는 거부")
    void imageRejectsDangerousValues(String url) {
        assertThat(invalid(profile(null, url, null), "profileImageUrl")).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"not-an-email", "a@b.com?cc=x@y.com&subject=z ", "javascript:alert(1)"})
    @DisplayName("공개 이메일 형식이 아니면 거부")
    void publicEmailMustBeAnEmail(String email) {
        assertThat(invalid(profile(null, null, email), "publicEmail")).isTrue();
    }

    @Test
    @DisplayName("URL 길이는 2048자를 넘을 수 없다")
    void urlLengthIsLimited() {
        String tooLong = "https://example.com/" + "a".repeat(BlogUserDtos.MAX_URL_LENGTH);
        assertThat(invalid(profile(tooLong, null, null), "websiteUrl")).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"javascript:alert(1)", "data:image/png;base64,AAAA"})
    @DisplayName("글 썸네일도 javascript:/data: 주소는 거부")
    void postThumbnailRejectsDangerousSchemes(String url) {
        var request = new PostDtos.CreatePostRequest("제목", null, null, "본문", url, PostStatus.PUBLISHED, null, null);
        assertThat(validator.validate(request).stream().anyMatch(v -> v.getPropertyPath().toString().equals("thumbnailUrl"))).isTrue();
    }
}

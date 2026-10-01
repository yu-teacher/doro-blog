package com.doro.blog.common.web;

import com.doro.blog.domain.post.dto.PostDtos.CreatePostRequest;
import com.doro.blog.domain.post.dto.PostDtos.UpdatePostRequest;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.series.dto.SeriesDtos.CreateSeriesRequest;
import com.doro.blog.domain.user.dto.BlogUserDtos.UpdateProfileRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** 요청 검증 한도가 DB 컬럼 길이와 맞는지(넘으면 500 이 아니라 400 이 되는지) 확인한다. */
class DtoLimitsTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private CreatePostRequest post(List<String> tags) {
        return new CreatePostRequest("제목", null, null, "본문", null, PostStatus.PUBLISHED, null, tags);
    }

    @Test
    @DisplayName("태그는 개수(20)와 이름 길이(50)를 넘으면 검증에서 거부된다 (tags.name 은 VARCHAR(50))")
    void tagLimits() {
        assertThat(validator.validate(post(List.of("spring", "a".repeat(50))))).isEmpty();
        assertThat(validator.validate(post(List.of("a".repeat(51))))).hasSize(1);

        List<String> many = new ArrayList<>();
        for (int i = 0; i < 21; i++) many.add("t" + i);
        assertThat(validator.validate(post(many))).hasSize(1);

        assertThat(validator.validate(new UpdatePostRequest("제목", null, null, null, null, null, null, List.of("b".repeat(60))))).hasSize(1);
    }

    @Test
    @DisplayName("공개 이메일은 컬럼 길이(100)를 넘으면 거부된다")
    void publicEmailFitsColumn() {
        String ok = "a".repeat(60) + "@" + "b".repeat(30) + ".test";        // 96자
        String tooLong = "a".repeat(60) + "@" + "b".repeat(40) + ".test";    // 106자
        assertThat(validator.validate(profileWithEmail(ok))).isEmpty();
        assertThat(validator.validate(profileWithEmail(tooLong))).isNotEmpty();
    }

    @Test
    @DisplayName("시리즈 썸네일 주소는 길이와 허용 형식을 검사한다")
    void seriesThumbnail() {
        assertThat(validator.validate(new CreateSeriesRequest("시리즈", null, null, "/media/a.png"))).isEmpty();
        assertThat(validator.validate(new CreateSeriesRequest("시리즈", null, null, "javascript:alert(1)"))).isNotEmpty();
        assertThat(validator.validate(new CreateSeriesRequest("시리즈", null, null, "https://x.test/" + "a".repeat(600)))).isNotEmpty();
    }

    @Test
    @DisplayName("이미지/링크 주소 길이는 컬럼 길이(이미지 500, 링크 255)를 넘으면 거부된다")
    void urlLengthsFitColumns() {
        String image501 = "https://x.test/" + "a".repeat(486);   // 501자
        String image500 = "https://x.test/" + "a".repeat(485);   // 500자
        assertThat(image501).hasSize(501);
        assertThat(validator.validate(new CreatePostRequest("제목", null, null, "본문", image500, PostStatus.PUBLISHED, null, null))).isEmpty();
        assertThat(validator.validate(new CreatePostRequest("제목", null, null, "본문", image501, PostStatus.PUBLISHED, null, null))).isNotEmpty();

        String link256 = "https://github.com/" + "a".repeat(237);  // 256자
        assertThat(link256).hasSize(256);
        UpdateProfileRequest tooLongGithub = new UpdateProfileRequest("닉", null, null, null, null, link256, null, null, null, null, null);
        assertThat(validator.validate(tooLongGithub)).isNotEmpty();
    }

    private UpdateProfileRequest profileWithEmail(String email) {
        return new UpdateProfileRequest("닉", null, null, null, null, null, null, null, email, null, null);
    }
}

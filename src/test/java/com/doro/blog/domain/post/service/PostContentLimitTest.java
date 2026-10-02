package com.doro.blog.domain.post.service;

import com.doro.blog.domain.post.dto.PostDtos;
import jakarta.validation.Validation;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

class PostContentLimitTest {

    @Test
    @DisplayName("본문이 최대 길이를 넘으면 검증에서 거부된다")
    void oversizedContentIsRejected() {
        var request = new PostDtos.CreatePostRequest("제목", null, null,
                "a".repeat(PostDtos.MAX_CONTENT_LENGTH + 1), null, null, null, null);
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var violations = factory.getValidator().validate(request);

            assertThat(violations).anyMatch(v -> v.getPropertyPath().toString().equals("content"));
        }
    }

    @Test
    @DisplayName("최대 길이의 본문이 정규식에 불리한 모양이어도 요약·썸네일 추출이 짧은 시간에 끝난다")
    void hostileMaxSizeContentIsProcessedQuickly() {
        String hostile = "![".repeat(PostDtos.MAX_CONTENT_LENGTH / 2);

        assertTimeoutPreemptively(Duration.ofSeconds(5), () -> {
            PostContent.resolveThumbnail(null, hostile);
            PostContent.generateSummary(null, hostile);
        });
    }
}

package com.doro.blog.domain.post.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PostContentTest {

    @Test
    @DisplayName("직접 쓴 요약이 있으면 마크다운을 벗기고 200자로 자른다")
    void explicitSummaryIsStrippedAndCapped() {
        assertThat(PostContent.generateSummary("**굵게** 요약", "본문")).isEqualTo("굵게 요약");
        String capped = PostContent.generateSummary("가".repeat(300), null);
        assertThat(capped).endsWith("...").hasSize(203);
    }

    @Test
    @DisplayName("요약이 없으면 본문에서 만들고 150자로 자른다. 본문도 없으면 빈 문자열")
    void summaryFallsBackToContent() {
        assertThat(PostContent.generateSummary(null, "# 제목\n\n본문 내용")).contains("본문 내용");
        assertThat(PostContent.generateSummary(" ", "나".repeat(400))).endsWith("...").hasSize(153);
        assertThat(PostContent.generateSummary(null, null)).isEmpty();
        assertThat(PostContent.generateSummary(null, "   ")).isEmpty();
    }

    @Test
    @DisplayName("썸네일은 명시한 값을 우선하고, 없으면 본문의 첫 이미지를 쓴다")
    void thumbnailPrefersExplicitThenFirstImage() {
        String content = "앞글\n![a](https://img.example/a.png)\n![b](https://img.example/b.png)";
        assertThat(PostContent.resolveThumbnail("  /media/x.png  ", content)).isEqualTo("/media/x.png");
        assertThat(PostContent.resolveThumbnail(null, content)).isEqualTo("https://img.example/a.png");
        assertThat(PostContent.resolveThumbnail(" ", content)).isEqualTo("https://img.example/a.png");
        assertThat(PostContent.resolveThumbnail(null, "이미지 없음")).isNull();
        assertThat(PostContent.resolveThumbnail(null, null)).isNull();
    }

    @Test
    @DisplayName("stripMarkdown 은 코드 펜스, 링크, 강조 표기를 걷어낸다")
    void stripMarkdownRemovesSyntax() {
        String plain = PostContent.stripMarkdown("## 제목\n[링크](https://x.y) `code` **bold** _it_");
        assertThat(plain).contains("제목").contains("링크").contains("bold")
                .doesNotContain("##").doesNotContain("](").doesNotContain("**");
    }
}

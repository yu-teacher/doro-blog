package com.doro.blog.domain.post.service;

import com.doro.blog.domain.post.dto.PostDtos.*;

/** 글 본문에서 요약과 썸네일을 뽑아내는 순수 함수 모음. */
public final class PostContent {

    private PostContent() {
    }

    private static final java.util.regex.Pattern FIRST_IMAGE_PATTERN =
            java.util.regex.Pattern.compile("!\\[.*?\\]\\((https?://[^\\s)]+|/[^\\s)]+)\\)");

    public static String resolveThumbnail(String explicitThumbnailUrl, String content) {
        if (explicitThumbnailUrl != null && !explicitThumbnailUrl.isBlank()) {
            return explicitThumbnailUrl.trim();
        }
        return extractFirstImageUrl(content);
    }

    private static String extractFirstImageUrl(String content) {
        if (content == null || content.isBlank()) {
            return null;
        }
        java.util.regex.Matcher matcher = FIRST_IMAGE_PATTERN.matcher(content);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        return null;
    }

    public static String generateSummary(String explicitSummary, String content) {
        if (explicitSummary != null && !explicitSummary.isBlank()) {
            String stripped = stripMarkdown(explicitSummary);
            return stripped.length() > 200 ? stripped.substring(0, 200).trim() + "..." : stripped;
        }
        if (content == null || content.isBlank()) {
            return "";
        }
        String plain = stripMarkdown(content);
        return plain.length() > 150 ? plain.substring(0, 150).trim() + "..." : plain;
    }

    public static String stripMarkdown(String markdown) {
        if (markdown == null || markdown.isBlank()) {
            return "";
        }
        String text = markdown;
        // 1. Remove markdown image syntax ![alt](url)
        text = text.replaceAll("!\\[[^\\]]*\\]\\([^)]*\\)", "");
        // 2. Convert markdown links [text](url) to text
        text = text.replaceAll("\\[([^\\]]+)\\]\\([^)]*\\)", "$1");
        // 3. Remove fenced code blocks ```...```
        text = text.replaceAll("(?s)```.*?```", " ");
        // 4. Remove inline code `...`
        text = text.replaceAll("`[^`]*`", " ");
        // 5. Remove HTML tags <...>
        text = text.replaceAll("<[^>]*>", " ");
        // 6. Remove headings, blockquotes, list markers
        text = text.replaceAll("(?m)^[\\s]*[#>-]+[\\s]+", "");
        text = text.replaceAll("(?m)^[\\s]*\\d+\\.[\\s]+", "");
        // 7. Remove bold, italic, strikethrough characters
        text = text.replaceAll("[*_~#]", "");
        // 8. Normalize whitespace and newlines
        text = text.replaceAll("[\\r\\n\\t]+", " ");
        text = text.replaceAll("\\s{2,}", " ");
        return text.trim();
    }
}

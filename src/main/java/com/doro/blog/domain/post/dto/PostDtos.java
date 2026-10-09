package com.doro.blog.domain.post.dto;

import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.user.dto.BlogUserDtos;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class PostDtos {

    /** 글 하나에 붙일 수 있는 태그 수와 태그 이름 길이 (tags.name 은 VARCHAR(50)). */
    public static final int MAX_TAGS = 20;
    public static final int MAX_TAG_LENGTH = 50;
    /** 본문 최대 길이(문자). 무제한이면 요약·썸네일 추출과 저장이 요청 하나로 서버를 오래 붙잡을 수 있다. */
    public static final int MAX_CONTENT_LENGTH = 1_000_000;


    public record CreatePostRequest(
            @NotBlank(message = "글 제목은 필수입니다.")
            @Size(max = 255, message = "글 제목은 최대 255자입니다.")
            String title,

            String slug,

            @Size(max = 500, message = "요약문은 최대 500자입니다.")
            String summary,

            @Size(max = MAX_CONTENT_LENGTH, message = "본문은 최대 1,000,000자입니다.")
            String content,

            @Size(max = BlogUserDtos.MAX_IMAGE_URL_LENGTH, message = "썸네일 주소는 최대 500자입니다.")
            @Pattern(regexp = BlogUserDtos.IMAGE_URL_OR_EMPTY, flags = Pattern.Flag.CASE_INSENSITIVE,
                    message = "썸네일 주소는 http(s) 또는 /media 경로만 허용됩니다.")
            String thumbnailUrl,

            PostStatus status,

            UUID seriesId,

            @Size(max = MAX_TAGS, message = "태그는 최대 20개까지 붙일 수 있습니다.")
            List<@Size(max = MAX_TAG_LENGTH, message = "태그는 최대 50자입니다.") String> tags
    ) {}

    public record UpdatePostRequest(
            @NotBlank(message = "글 제목은 필수입니다.")
            @Size(max = 255, message = "글 제목은 최대 255자입니다.")
            String title,

            String slug,

            @Size(max = 500, message = "요약문은 최대 500자입니다.")
            String summary,

            @Size(max = MAX_CONTENT_LENGTH, message = "본문은 최대 1,000,000자입니다.")
            String content,

            @Size(max = BlogUserDtos.MAX_IMAGE_URL_LENGTH, message = "썸네일 주소는 최대 500자입니다.")
            @Pattern(regexp = BlogUserDtos.IMAGE_URL_OR_EMPTY, flags = Pattern.Flag.CASE_INSENSITIVE,
                    message = "썸네일 주소는 http(s) 또는 /media 경로만 허용됩니다.")
            String thumbnailUrl,

            PostStatus status,

            UUID seriesId,

            @Size(max = MAX_TAGS, message = "태그는 최대 20개까지 붙일 수 있습니다.")
            List<@Size(max = MAX_TAG_LENGTH, message = "태그는 최대 50자입니다.") String> tags,

            /** true 면 글을 시리즈에서 뺀다. seriesId 를 보내지 않은 것만으로는 시리즈가 바뀌지 않는다(다른 필드의 생략=유지와 같은 규칙). */
            Boolean removeFromSeries
    ) {
        /** removeFromSeries 를 쓰지 않는 호출(기존 클라이언트, 테스트)용. */
        public UpdatePostRequest(String title, String slug, String summary, String content, String thumbnailUrl,
                                 PostStatus status, UUID seriesId, List<String> tags) {
            this(title, slug, summary, content, thumbnailUrl, status, seriesId, tags, null);
        }
    }

    public record PostSummaryResponse(
            UUID id,
            UUID userId,
            String username,
            String nickname,
            String profileImageUrl,
            UUID seriesId,
            String seriesTitle,
            Integer seriesOrder,
            String title,
            String slug,
            String summary,
            String thumbnailUrl,
            PostStatus status,
            long viewCount,
            int likeCount,
            int commentCount,
            Instant publishedAt,
            Instant createdAt,
            List<String> tags
    ) {
        public static PostSummaryResponse from(Post post, List<String> tags) {
            return new PostSummaryResponse(
                    post.getId(),
                    post.getUser().getId(),
                    post.getUser().getUsername(),
                    post.getUser().getNickname(),
                    post.getUser().getProfileImageUrl(),
                    post.getSeries() != null ? post.getSeries().getId() : null,
                    post.getSeries() != null ? post.getSeries().getTitle() : null,
                    post.getSeriesOrder(),
                    post.getTitle(),
                    post.getSlug(),
                    post.getSummary(),
                    post.getThumbnailUrl(),
                    post.getStatus(),
                    post.getViewCount(),
                    post.getLikeCount(),
                    post.getCommentCount(),
                    post.getPublishedAt(),
                    post.getCreatedAt(),
                    tags
            );
        }
    }

    public record AuthorBioResponse(
            UUID id,
            String username,
            String nickname,
            String profileImageUrl,
            String bio,
            String blogTitle,
            String githubUrl,
            String twitterUrl,
            String websiteUrl,
            String publicEmail,
            String linkedinUrl,
            int followerCount,
            boolean isFollowing
    ) {
        public static AuthorBioResponse from(com.doro.blog.domain.user.entity.BlogUser user, boolean isFollowing) {
            return new AuthorBioResponse(
                    user.getId(),
                    user.getUsername(),
                    user.getNickname(),
                    user.getProfileImageUrl(),
                    user.getBio(),
                    user.getBlogTitle(),
                    user.getGithubUrl(),
                    user.getTwitterUrl(),
                    user.getWebsiteUrl(),
                    user.getPublicEmail(),
                    user.getLinkedinUrl(),
                    user.getFollowerCount(),
                    isFollowing
            );
        }
    }

    public record PostDetailResponse(
            PostSummaryResponse post,
            String content,
            boolean likedByMe,
            AuthorBioResponse author
    ) {}
}

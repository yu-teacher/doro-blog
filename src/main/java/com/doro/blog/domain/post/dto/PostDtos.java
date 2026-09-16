package com.doro.blog.domain.post.dto;

import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.entity.PostStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class PostDtos {

    public record CreatePostRequest(
            @NotBlank(message = "글 제목은 필수입니다.")
            @Size(max = 255, message = "글 제목은 최대 255자입니다.")
            String title,

            String slug,

            @Size(max = 500, message = "요약문은 최대 500자입니다.")
            String summary,

            @NotBlank(message = "본문 내용은 필수입니다.")
            String content,

            String thumbnailUrl,

            PostStatus status,

            UUID seriesId,

            List<String> tags
    ) {}

    public record UpdatePostRequest(
            @NotBlank(message = "글 제목은 필수입니다.")
            @Size(max = 255, message = "글 제목은 최대 255자입니다.")
            String title,

            String slug,

            @Size(max = 500, message = "요약문은 최대 500자입니다.")
            String summary,

            @NotBlank(message = "본문 내용은 필수입니다.")
            String content,

            String thumbnailUrl,

            PostStatus status,

            UUID seriesId,

            List<String> tags
    ) {}

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

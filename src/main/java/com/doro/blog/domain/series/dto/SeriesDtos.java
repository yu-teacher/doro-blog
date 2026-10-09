package com.doro.blog.domain.series.dto;

import com.doro.blog.domain.series.entity.Series;
import com.doro.blog.domain.user.dto.BlogUserDtos;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class SeriesDtos {

    public record CreateSeriesRequest(
            @NotBlank(message = "시리즈 제목은 필수입니다.")
            @Size(max = 100, message = "시리즈 제목은 최대 100자입니다.")
            String title,

            String slug,

            @Size(max = 2000, message = "시리즈 설명은 최대 2000자입니다.")
            String description,

            @Size(max = BlogUserDtos.MAX_IMAGE_URL_LENGTH, message = "썸네일 주소는 최대 500자입니다.")
            @Pattern(regexp = BlogUserDtos.IMAGE_URL_OR_EMPTY, flags = Pattern.Flag.CASE_INSENSITIVE,
                    message = "썸네일 주소는 http(s) 또는 /media 경로만 허용됩니다.")
            String thumbnailUrl
    ) {}

    public record UpdateSeriesRequest(
            @NotBlank(message = "시리즈 제목은 필수입니다.")
            @Size(max = 100, message = "시리즈 제목은 최대 100자입니다.")
            String title,

            String slug,

            @Size(max = 2000, message = "시리즈 설명은 최대 2000자입니다.")
            String description,

            @Size(max = BlogUserDtos.MAX_IMAGE_URL_LENGTH, message = "썸네일 주소는 최대 500자입니다.")
            @Pattern(regexp = BlogUserDtos.IMAGE_URL_OR_EMPTY, flags = Pattern.Flag.CASE_INSENSITIVE,
                    message = "썸네일 주소는 http(s) 또는 /media 경로만 허용됩니다.")
            String thumbnailUrl
    ) {}

    public record AddSeriesPostRequest(
            @NotNull(message = "추가할 포스트 ID 는 필수입니다.")
            UUID postId
    ) {}

    public record ReorderPostsRequest(
            @NotEmpty(message = "재배치할 포스트 ID 목록이 비어있을 수 없습니다.")
            List<UUID> postIds
    ) {}

    public record SeriesResponse(
            UUID id,
            UUID userId,
            String username,
            String title,
            String slug,
            String description,
            String thumbnailUrl,
            int postCount,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static SeriesResponse from(Series series) {
            return from(series, series.getPostCount());
        }

        public static SeriesResponse from(Series series, int postCount) {
            return new SeriesResponse(
                    series.getId(),
                    series.getUser().getId(),
                    series.getUser().getUsername(),
                    series.getTitle(),
                    series.getSlug(),
                    series.getDescription(),
                    series.getThumbnailUrl(),
                    postCount,
                    series.getCreatedAt(),
                    series.getUpdatedAt()
            );
        }
    }

    public record SeriesItemPostResponse(
            UUID id,
            int seriesOrder,
            String title,
            String slug,
            String summary,
            String thumbnailUrl,
            com.doro.blog.domain.post.entity.PostStatus status,
            Instant publishedAt
    ) {
        public SeriesItemPostResponse(UUID id, int seriesOrder, String title, String slug, String summary, String thumbnailUrl, Instant publishedAt) {
            this(id, seriesOrder, title, slug, summary, thumbnailUrl, com.doro.blog.domain.post.entity.PostStatus.PUBLISHED, publishedAt);
        }
    }

    public record SeriesDetailResponse(
            SeriesResponse series,
            List<SeriesItemPostResponse> posts
    ) {}
}

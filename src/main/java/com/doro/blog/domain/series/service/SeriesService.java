package com.doro.blog.domain.series.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.series.dto.SeriesDtos.*;
import com.doro.blog.domain.series.entity.Series;
import com.doro.blog.domain.series.repository.SeriesRepository;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.repository.BlogUserRepository;
import com.doro.blog.domain.user.service.BlogUserService;
import com.hunnit_beasts.doro.sdk.client.DoroGuardClient;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SeriesService {

    private final SeriesRepository seriesRepository;
    private final PostRepository postRepository;
    private final BlogUserRepository userRepository;
    private final BlogUserService userService;
    private final DoroGuardClient guardClient;

    @Transactional
    public SeriesResponse createSeries(DoroUser doroUser, CreateSeriesRequest request) {
        BlogUser user = userService.getOrCreateUser(doroUser);

        String slug = (request.slug() != null && !request.slug().isBlank())
                ? request.slug().toLowerCase().trim().replaceAll("[^a-z0-9_-]", "-")
                : request.title().toLowerCase().trim().replaceAll("[^a-z0-9_-]", "-");

        if (seriesRepository.existsByUserIdAndSlug(user.getId(), slug)) {
            slug = slug + "-" + System.currentTimeMillis() % 10000;
        }

        Series series = Series.builder()
                .user(user)
                .title(request.title())
                .slug(slug)
                .description(request.description())
                .thumbnailUrl(request.thumbnailUrl())
                .build();

        Series saved = seriesRepository.save(series);

        // Zanzibar ReBAC 관계 튜플 등록: blog_series:<id>#owner@user:<userId>
        guardClient.writeTuple("blog_series", saved.getId().toString(), "owner", "user", user.getId().toString());

        return SeriesResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<SeriesResponse> getSeriesByUsername(String username) {
        String cleanUsername = username.startsWith("@") ? username.substring(1) : username;
        BlogUser user = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        return seriesRepository.findAllByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(SeriesResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public SeriesDetailResponse getSeriesDetail(UUID seriesId) {
        Series series = seriesRepository.findById(seriesId)
                .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));

        List<Post> posts = postRepository.findAllBySeriesIdOrderBySeriesOrderAsc(seriesId);
        List<SeriesItemPostResponse> postItems = posts.stream()
                .map(p -> new SeriesItemPostResponse(
                        p.getId(),
                        p.getSeriesOrder() != null ? p.getSeriesOrder() : 0,
                        p.getTitle(),
                        p.getSlug(),
                        p.getSummary(),
                        p.getThumbnailUrl(),
                        p.getPublishedAt()
                ))
                .toList();

        return new SeriesDetailResponse(SeriesResponse.from(series), postItems);
    }

    @Transactional
    public SeriesResponse updateSeries(UUID seriesId, UpdateSeriesRequest request) {
        Series series = seriesRepository.findById(seriesId)
                .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));

        String slug = (request.slug() != null && !request.slug().isBlank())
                ? request.slug().toLowerCase().trim()
                : series.getSlug();

        series.update(request.title(), slug, request.description(), request.thumbnailUrl());
        return SeriesResponse.from(series);
    }

    @Transactional
    public void deleteSeries(UUID seriesId) {
        Series series = seriesRepository.findById(seriesId)
                .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));

        // 소속된 글들의 시리즈 연결 해제
        List<Post> posts = postRepository.findAllBySeriesIdOrderBySeriesOrderAsc(seriesId);
        for (Post post : posts) {
            post.removeSeries();
        }

        // Zanzibar ReBAC 관계 튜플 삭제
        guardClient.deleteTuple("blog_series", seriesId.toString(), "owner", "user", series.getUser().getId().toString());

        seriesRepository.delete(series);
    }

    @Transactional
    public SeriesDetailResponse reorderPosts(UUID seriesId, List<UUID> postIds) {
        Series series = seriesRepository.findById(seriesId)
                .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));

        List<Post> posts = postRepository.findAllBySeriesIdOrderBySeriesOrderAsc(seriesId);
        int order = 1;
        for (UUID postId : postIds) {
            for (Post post : posts) {
                if (post.getId().equals(postId)) {
                    post.updateSeriesOrder(order++);
                    break;
                }
            }
        }

        return getSeriesDetail(seriesId);
    }
}

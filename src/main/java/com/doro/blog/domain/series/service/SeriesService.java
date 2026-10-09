package com.doro.blog.domain.series.service;

import com.doro.blog.common.util.Handles;
import com.doro.blog.common.util.SlugGenerator;
import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.series.dto.SeriesDtos.*;
import com.doro.blog.domain.series.entity.Series;
import com.doro.blog.domain.series.repository.SeriesRepository;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.repository.BlogUserRepository;
import com.doro.blog.domain.user.service.BlogUserService;
import com.doro.blog.infra.guard.GuardTuples;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.stream.Collectors;
import java.util.Map;
import java.util.HashSet;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SeriesService {

    private final SeriesRepository seriesRepository;
    private final PostRepository postRepository;
    private final BlogUserRepository userRepository;
    private final BlogUserService userService;
    private final GuardTuples guardTuples;

    @Transactional
    public SeriesResponse createSeries(DoroUser doroUser, CreateSeriesRequest request) {
        BlogUser user = userService.getOrCreateUser(doroUser);

        String slug = SlugGenerator.unique(request.slug(), request.title(), "series",
                candidate -> seriesRepository.existsByUserIdAndSlug(user.getId(), candidate));

        Series series = Series.builder()
                .user(user)
                .title(request.title())
                .slug(slug)
                .description(request.description())
                .thumbnailUrl(request.thumbnailUrl())
                .build();

        Series saved = seriesRepository.save(series);

        // Zanzibar ReBAC 관계 튜플 등록: blog_series:<id>#owner@user:<userId>
        guardTuples.write("blog_series", saved.getId().toString(), "owner", "user", user.getId().toString());

        return SeriesResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<SeriesResponse> getSeriesByUsername(String username, DoroUser doroUser) {
        String cleanUsername = Handles.stripAt(username);
        BlogUser user = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        boolean canViewPrivate = doroUser != null && doroUser.isAuthenticated() &&
                (doroUser.userId().equals(user.getId()) || doroUser.isAdmin());

        List<Series> seriesList = seriesRepository.findAllByUserIdOrderByCreatedAtDescIdDesc(user.getId());

        // 공개 글 수는 시리즈마다 따로 세지 않고 한 번의 그룹 쿼리로 가져온다 (시리즈가 많아져도 쿼리 수가 늘지 않게)
        Map<UUID, Integer> publishedCounts = new HashMap<>();
        if (!canViewPrivate && !seriesList.isEmpty()) {
            for (Object[] row : postRepository.countPublishedBySeriesIds(seriesList.stream().map(Series::getId).toList())) {
                publishedCounts.put((UUID) row[0], ((Number) row[1]).intValue());
            }
        }

        return seriesList.stream()
                .map(series -> SeriesResponse.from(series,
                        canViewPrivate ? series.getPostCount() : publishedCounts.getOrDefault(series.getId(), 0)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SeriesResponse> getSeriesByUsername(String username) {
        return getSeriesByUsername(username, null);
    }

    @Transactional(readOnly = true)
    public SeriesDetailResponse getSeriesByUsernameAndSlug(String username, String slug, DoroUser doroUser) {
        String cleanUsername = Handles.stripAt(username);
        BlogUser user = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        Series series = seriesRepository.findByUserIdAndSlug(user.getId(), slug.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));

        return getSeriesDetail(series.getId(), doroUser);
    }

    @Transactional(readOnly = true)
    public SeriesDetailResponse getSeriesByUsernameAndSlug(String username, String slug) {
        return getSeriesByUsernameAndSlug(username, slug, null);
    }

    @Transactional(readOnly = true)
    public SeriesDetailResponse getSeriesDetail(UUID seriesId, DoroUser doroUser) {
        Series series = seriesRepository.findById(seriesId)
                .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));

        boolean canViewPrivate = doroUser != null && doroUser.isAuthenticated() &&
                (doroUser.userId().equals(series.getUser().getId()) || doroUser.isAdmin());

        return buildDetail(series, canViewPrivate);
    }

    private SeriesDetailResponse buildDetail(Series series, boolean canViewPrivate) {
        UUID seriesId = series.getId();
        List<Post> posts;
        if (canViewPrivate) {
            posts = postRepository.findAllBySeriesIdOrderBySeriesOrderAsc(seriesId);
        } else {
            posts = postRepository.findAllBySeriesIdAndStatusOrderBySeriesOrderAsc(seriesId, PostStatus.PUBLISHED);
        }

        List<SeriesItemPostResponse> postItems = posts.stream()
                .map(p -> new SeriesItemPostResponse(
                        p.getId(),
                        p.getSeriesOrder() != null ? p.getSeriesOrder() : 0,
                        p.getTitle(),
                        p.getSlug(),
                        p.getSummary(),
                        p.getThumbnailUrl(),
                        p.getStatus(),
                        p.getPublishedAt()
                ))
                .toList();

        int displayPostCount = canViewPrivate ? series.getPostCount() : (int) postRepository.countBySeriesIdAndStatus(seriesId, PostStatus.PUBLISHED);
        SeriesResponse seriesRes = SeriesResponse.from(series, displayPostCount);

        return new SeriesDetailResponse(seriesRes, postItems);
    }

    @Transactional(readOnly = true)
    public SeriesDetailResponse getSeriesDetail(UUID seriesId) {
        return getSeriesDetail(seriesId, null);
    }

    @Transactional
    public SeriesResponse updateSeries(UUID seriesId, UpdateSeriesRequest request) {
        Series series = seriesRepository.findById(seriesId)
                .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));

        String slug = series.getSlug();
        if (request.slug() != null && !request.slug().isBlank()) {
            String requested = SlugGenerator.sanitize(request.slug());
            if (requested.isEmpty()) {
                throw new BlogException(ErrorCode.INVALID_INPUT, "슬러그에 사용할 수 있는 문자가 없습니다.");
            }
            if (!requested.equals(series.getSlug())
                    && seriesRepository.existsByUserIdAndSlugAndIdNot(series.getUser().getId(), requested, series.getId())) {
                throw new BlogException(ErrorCode.SLUG_ALREADY_EXISTS);
            }
            slug = requested;
        }

        series.update(request.title(), slug, request.description(), request.thumbnailUrl());
        return SeriesResponse.from(series);
    }

    @Transactional
    public void deleteSeries(UUID seriesId) {
        Series series = seriesRepository.findById(seriesId)
                .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));

        // 소속된 글들의 시리즈 연결 해제
        postRepository.detachFromSeries(seriesId);

        // Zanzibar ReBAC 관계 튜플 삭제
        guardTuples.deleteAfterCommit("blog_series", seriesId.toString(), "owner", "user", series.getUser().getId().toString());

        seriesRepository.delete(series);
    }

    @Transactional
    public SeriesDetailResponse reorderPosts(UUID seriesId, List<UUID> postIds) {
        Series series = seriesRepository.findById(seriesId)
                .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));

        List<Post> posts = postRepository.findAllBySeriesIdOrderBySeriesOrderAsc(seriesId);
        Map<UUID, Post> byId = posts.stream().collect(Collectors.toMap(Post::getId, p -> p));

        // 목록이 시리즈의 글과 정확히 일치해야 한다. 빠지거나 중복되거나 남의 글이 섞이면 회차 번호가 꼬이므로 거부한다.
        if (postIds == null || postIds.size() != byId.size() || !byId.keySet().equals(new HashSet<>(postIds))) {
            throw new BlogException(ErrorCode.INVALID_INPUT, "정렬 목록은 시리즈에 속한 모든 글을 중복 없이 한 번씩 포함해야 합니다.");
        }

        int order = 1;
        for (UUID postId : postIds) {
            byId.get(postId).updateSeriesOrder(order++);
        }

        // 정렬은 시리즈를 편집할 수 있는 사람만 호출하므로, 응답도 임시저장·비공개 글을 포함한 편집자 시점으로 돌려준다
        // (공개 시점으로 돌려주면 작성자 화면에서 비공개 글이 사라지고 글 수가 줄어 보인다)
        return buildDetail(series, true);
    }
}

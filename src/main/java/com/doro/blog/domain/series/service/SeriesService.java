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
import com.doro.blog.common.tx.Transactions;
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
    private final Transactions transactions;

    /**
     * 시리즈를 만든다. 소유 튜플(blog_series:<id>#owner@user:<userId>)을 Guard 에 먼저 쓴 뒤(트랜잭션 밖) DB 에 저장한다.
     * Guard 호출을 트랜잭션 안에서 하면 Guard 가 느릴 때 DB 연결을 그만큼 쥐고 있게 된다(GuardTuples 설명 참고).
     */
    public SeriesResponse createSeries(DoroUser doroUser, CreateSeriesRequest request) {
        BlogUserService.requireAuthenticated(doroUser);
        UUID seriesId = UUID.randomUUID();
        return guardTuples.writeThen(
                List.of(GuardTuples.Tuple.of("blog_series", seriesId.toString(), "owner", "user", doroUser.userId().toString())),
                () -> transactions.write(() -> saveSeries(doroUser, request, seriesId)));
    }

    private SeriesResponse saveSeries(DoroUser doroUser, CreateSeriesRequest request, UUID seriesId) {
        BlogUser user = userService.getOrCreateUser(doroUser);

        String slug = SlugGenerator.unique(request.slug(), request.title(), "series",
                candidate -> seriesRepository.existsByUserIdAndSlug(user.getId(), candidate));

        Series series = Series.builder()
                .id(seriesId)
                .user(user)
                .title(request.title())
                .slug(slug)
                .description(request.description())
                .thumbnailUrl(request.thumbnailUrl())
                .build();

        Series saved = seriesRepository.save(series);
        return SeriesResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<SeriesResponse> getSeriesByUsername(String username, DoroUser doroUser) {
        String cleanUsername = Handles.stripAt(username);
        BlogUser user = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        boolean canViewPrivate = doroUser != null && doroUser.isAuthenticated() &&
                doroUser.userId().equals(user.getId());

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
                doroUser.userId().equals(series.getUser().getId());

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

        // 목록을 이미 읽었으므로 그 개수를 쓴다(같은 트랜잭션에서 글 수를 바꾼 직후에도 정확하다. series.postCount 는 DB 갱신 전 값일 수 있다)
        SeriesResponse seriesRes = SeriesResponse.from(series, posts.size());

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

    /** 시리즈 편집자 시점의 상세(임시저장·비공개 글 포함)를 돌려준다. 글을 추가·제거·정렬한 직후 화면에 그대로 쓴다. */
    private SeriesDetailResponse editorView(Series series) {
        return buildDetail(series, true);
    }

    /**
     * 이미 있는 글을 시리즈의 마지막 회차로 추가한다. 시리즈 주인의 글만, 시리즈에 속하지 않은 글만 추가할 수 있다
     * (다른 시리즈에 있는 글은 먼저 빼야 한다). 이미 이 시리즈에 있으면 아무것도 바꾸지 않는다.
     */
    @Transactional
    public SeriesDetailResponse addPost(UUID seriesId, UUID postId) {
        Series series = seriesRepository.findByIdForUpdate(seriesId)
                .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new BlogException(ErrorCode.POST_NOT_FOUND));
        if (!post.getUser().getId().equals(series.getUser().getId())) {
            throw new BlogException(ErrorCode.ACCESS_DENIED, "본인의 글만 시리즈에 추가할 수 있습니다.");
        }
        if (post.getSeries() != null) {
            if (post.getSeries().getId().equals(seriesId)) {
                return editorView(series);
            }
            throw new BlogException(ErrorCode.INVALID_INPUT, "이미 다른 시리즈에 속한 글입니다. 먼저 그 시리즈에서 빼 주세요.");
        }
        post.assignSeries(series, postRepository.nextSeriesOrder(seriesId));
        seriesRepository.adjustPostCount(seriesId, 1);
        return editorView(series);
    }

    /** 글을 시리즈에서 뺀다(글은 지워지지 않는다). 남은 글의 회차는 1..n 으로 다시 이어 붙인다. */
    @Transactional
    public SeriesDetailResponse removePost(UUID seriesId, UUID postId) {
        Series series = seriesRepository.findByIdForUpdate(seriesId)
                .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new BlogException(ErrorCode.POST_NOT_FOUND));
        if (post.getSeries() == null || !post.getSeries().getId().equals(seriesId)) {
            throw new BlogException(ErrorCode.INVALID_INPUT, "이 시리즈에 속한 글이 아닙니다.");
        }
        post.removeSeries();
        seriesRepository.adjustPostCount(seriesId, -1);

        // 남은 글을 1..n 으로 다시 매긴다. 번호 유니크 제약은 커밋 시점에 검사하므로 중간에 겹쳐도 된다.
        int order = 1;
        for (Post remaining : postRepository.findAllBySeriesIdOrderBySeriesOrderAsc(seriesId)) {
            remaining.updateSeriesOrder(order++);
        }
        return editorView(series);
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

package com.doro.blog.domain.post.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.domain.like.repository.PostLikeRepository;
import com.doro.blog.domain.post.dto.PostDtos.*;
import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.series.entity.Series;
import com.doro.blog.domain.series.repository.SeriesRepository;
import com.doro.blog.domain.tag.service.TagService;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.repository.BlogUserRepository;
import com.doro.blog.domain.user.service.BlogUserService;
import com.hunnit_beasts.doro.sdk.client.DoroGuardClient;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;
    private final BlogUserRepository userRepository;
    private final SeriesRepository seriesRepository;
    private final PostLikeRepository likeRepository;
    private final com.doro.blog.domain.user.repository.UserFollowRepository followRepository;
    private final BlogUserService userService;
    private final TagService tagService;
    private final DoroGuardClient guardClient;

    @Transactional
    public PostSummaryResponse createPost(DoroUser doroUser, CreatePostRequest request) {
        BlogUser user = userService.getOrCreateUser(doroUser);

        String slug = (request.slug() != null && !request.slug().isBlank())
                ? request.slug().toLowerCase().trim().replaceAll("[^a-z0-9가-힣_-]", "-")
                : request.title().toLowerCase().trim().replaceAll("[^a-z0-9가-힣_-]", "-");

        if (postRepository.existsByUserIdAndSlug(user.getId(), slug)) {
            slug = slug + "-" + (System.currentTimeMillis() % 10000);
        }

        String summary = request.summary();
        if (summary == null || summary.isBlank()) {
            summary = request.content().length() > 150
                    ? request.content().substring(0, 150).replaceAll("[#*`\\n]", " ").trim() + "..."
                    : request.content().replaceAll("[#*`\\n]", " ").trim();
        }

        PostStatus status = request.status() != null ? request.status() : PostStatus.DRAFT;

        Series series = null;
        Integer seriesOrder = null;
        if (request.seriesId() != null) {
            series = seriesRepository.findById(request.seriesId())
                    .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));
            seriesOrder = series.getPostCount() + 1;
            series.incrementPostCount();
        }

        String resolvedThumbnail = resolveThumbnail(request.thumbnailUrl(), request.content());

        Post post = Post.builder()
                .user(user)
                .series(series)
                .seriesOrder(seriesOrder)
                .title(request.title())
                .slug(slug)
                .summary(summary)
                .content(request.content())
                .thumbnailUrl(resolvedThumbnail)
                .status(status)
                .publishedAt(status == PostStatus.PUBLISHED ? Instant.now() : null)
                .build();

        Post saved = postRepository.save(post);

        // 태그 동기화
        tagService.syncPostTags(saved, request.tags());

        // Zanzibar ReBAC 관계 튜플 등록: blog_post:<id>#author@user:<userId>
        guardClient.writeTuple("blog_post", saved.getId().toString(), "author", "user", user.getId().toString());

        List<String> tags = tagService.getPostTagNames(saved.getId());
        return PostSummaryResponse.from(saved, tags);
    }

    @Transactional(readOnly = true)
    public Page<PostSummaryResponse> getFeed(String sort, String tag, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Post> posts;

        if (tag != null && !tag.isBlank()) {
            posts = postRepository.findAllByTagName(tag.trim().toLowerCase(), pageable);
        } else if ("popular".equalsIgnoreCase(sort)) {
            posts = postRepository.findAllByStatusOrderByLikeCountDesc(PostStatus.PUBLISHED, pageable);
        } else {
            posts = postRepository.findAllByStatusOrderByPublishedAtDesc(PostStatus.PUBLISHED, pageable);
        }

        return posts.map(p -> PostSummaryResponse.from(p, tagService.getPostTagNames(p.getId())));
    }

    @Transactional(readOnly = true)
    public Page<PostSummaryResponse> getUserPosts(String username, String query, String tag, int page, int size) {
        String cleanUsername = username.startsWith("@") ? username.substring(1) : username;
        BlogUser user = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        Pageable pageable = PageRequest.of(page, size);
        String keyword = (query != null && !query.trim().isEmpty()) ? query.trim() : null;
        String normalizedTag = (tag != null && !tag.trim().isEmpty()) ? tag.trim().toLowerCase() : null;

        Page<Post> posts;
        if (keyword != null && normalizedTag != null) {
            posts = postRepository.searchUserPostsByKeywordAndTag(user.getId(), keyword, normalizedTag, pageable);
        } else if (keyword != null) {
            posts = postRepository.searchUserPostsByKeyword(user.getId(), keyword, pageable);
        } else if (normalizedTag != null) {
            posts = postRepository.findUserPostsByTag(user.getId(), normalizedTag, pageable);
        } else {
            posts = postRepository.findAllByUserIdAndStatusOrderByPublishedAtDesc(user.getId(), PostStatus.PUBLISHED, pageable);
        }

        return posts.map(p -> PostSummaryResponse.from(p, tagService.getPostTagNames(p.getId())));
    }



    @Transactional
    public PostDetailResponse getPostDetail(String username, String slug, DoroUser doroUser) {
        return getPostDetail(username, slug, doroUser, true);
    }

    @Transactional
    public PostDetailResponse getPostDetail(
            String username,
            String slug,
            DoroUser doroUser,
            boolean countView
    ) {
        String cleanUsername = username.startsWith("@") ? username.substring(1) : username;
        BlogUser user = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        Post post = postRepository.findByUserIdAndSlug(user.getId(), slug.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.POST_NOT_FOUND));

        // 비공개/임시저장 글 열람 인가 검증
        if (post.getStatus() != PostStatus.PUBLISHED) {
            boolean isAuthor = doroUser.isAuthenticated() && doroUser.userId().equals(user.getId());
            if (!isAuthor) {
                boolean hasAccess = doroUser.isAuthenticated() && guardClient.check(
                        "blog_post", post.getId().toString(), "viewer", doroUser.userId().toString()
                );
                if (!hasAccess) {
                    throw new BlogException(ErrorCode.ACCESS_DENIED, "비공개 또는 임시저장된 글에 접근할 수 없습니다.");
                }
            }
        }

        if (countView) {
            post.incrementViewCount();
        }

        boolean likedByMe = doroUser.isAuthenticated() && likeRepository.existsByPostIdAndUserId(post.getId(), doroUser.userId());
        boolean isFollowing = doroUser.isAuthenticated() && followRepository.existsByFollowerIdAndFollowingId(doroUser.userId(), user.getId());
        List<String> tags = tagService.getPostTagNames(post.getId());

        return new PostDetailResponse(
                PostSummaryResponse.from(post, tags),
                post.getContent(),
                likedByMe,
                AuthorBioResponse.from(user, isFollowing)
        );
    }

    @Transactional
    public PostDetailResponse getPostById(UUID postId, DoroUser doroUser) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new BlogException(ErrorCode.POST_NOT_FOUND));

        if (post.getStatus() != PostStatus.PUBLISHED) {
            boolean isAuthor = doroUser.isAuthenticated() && doroUser.userId().equals(post.getUser().getId());
            if (!isAuthor) {
                boolean hasAccess = doroUser.isAuthenticated() && guardClient.check(
                        "blog_post", post.getId().toString(), "viewer", doroUser.userId().toString()
                );
                if (!hasAccess) {
                    throw new BlogException(ErrorCode.ACCESS_DENIED, "비공개 또는 임시저장된 글에 접근할 수 없습니다.");
                }
            }
        }

        boolean likedByMe = doroUser.isAuthenticated() && likeRepository.existsByPostIdAndUserId(post.getId(), doroUser.userId());
        boolean isFollowing = doroUser.isAuthenticated() && followRepository.existsByFollowerIdAndFollowingId(doroUser.userId(), post.getUser().getId());
        List<String> tags = tagService.getPostTagNames(post.getId());

        return new PostDetailResponse(
                PostSummaryResponse.from(post, tags),
                post.getContent(),
                likedByMe,
                AuthorBioResponse.from(post.getUser(), isFollowing)
        );
    }


    @Transactional
    public PostSummaryResponse updatePost(UUID postId, UpdatePostRequest request) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new BlogException(ErrorCode.POST_NOT_FOUND));

        String slug = (request.slug() != null && !request.slug().isBlank())
                ? request.slug().toLowerCase().trim()
                : post.getSlug();

        String summary = request.summary();
        if (summary == null || summary.isBlank()) {
            summary = request.content().length() > 150
                    ? request.content().substring(0, 150).replaceAll("[#*`\\n]", " ").trim() + "..."
                    : request.content().replaceAll("[#*`\\n]", " ").trim();
        }

        // 시리즈 변경 처리
        if (request.seriesId() != null && (post.getSeries() == null || !post.getSeries().getId().equals(request.seriesId()))) {
            if (post.getSeries() != null) {
                post.getSeries().decrementPostCount();
            }
            Series newSeries = seriesRepository.findById(request.seriesId())
                    .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));
            post.assignSeries(newSeries, newSeries.getPostCount() + 1);
            newSeries.incrementPostCount();
        } else if (request.seriesId() == null && post.getSeries() != null) {
            post.getSeries().decrementPostCount();
            post.removeSeries();
        }

        String resolvedThumbnail = resolveThumbnail(request.thumbnailUrl(), request.content());
        post.update(request.title(), slug, summary, request.content(), resolvedThumbnail, request.status());

        if (request.tags() != null) {
            tagService.syncPostTags(post, request.tags());
        }

        List<String> tags = tagService.getPostTagNames(post.getId());
        return PostSummaryResponse.from(post, tags);
    }

    @Transactional
    public void deletePost(UUID postId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new BlogException(ErrorCode.POST_NOT_FOUND));

        if (post.getSeries() != null) {
            post.getSeries().decrementPostCount();
        }

        // Zanzibar ReBAC 관계 튜플 삭제
        guardClient.deleteTuple("blog_post", postId.toString(), "author", "user", post.getUser().getId().toString());

        postRepository.delete(post);
    }

    @Transactional(readOnly = true)
    public Page<PostSummaryResponse> getMyPosts(DoroUser doroUser, PostStatus status, int page, int size) {
        if (!doroUser.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }
        Pageable pageable = PageRequest.of(page, size);
        Page<Post> posts = (status != null)
                ? postRepository.findAllByUserIdAndStatusOrderByCreatedAtDesc(doroUser.userId(), status, pageable)
                : postRepository.findAllByUserIdOrderByCreatedAtDesc(doroUser.userId(), pageable);

        return posts.map(p -> PostSummaryResponse.from(p, tagService.getPostTagNames(p.getId())));
    }


    @Transactional(readOnly = true)
    public Page<PostSummaryResponse> getTrendingPosts(String timeframe, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        java.time.Instant since = switch (timeframe != null ? timeframe.toLowerCase() : "week") {
            case "day" -> java.time.Instant.now().minus(java.time.Duration.ofDays(1));
            case "month" -> java.time.Instant.now().minus(java.time.Duration.ofDays(30));
            case "year" -> java.time.Instant.now().minus(java.time.Duration.ofDays(365));
            default -> java.time.Instant.now().minus(java.time.Duration.ofDays(7));
        };

        return postRepository.findTrendingPosts(since, pageable)
                .map(p -> PostSummaryResponse.from(p, tagService.getPostTagNames(p.getId())));
    }

    @Transactional(readOnly = true)
    public Page<PostSummaryResponse> getMyLikedPosts(DoroUser doroUser, int page, int size) {
        if (!doroUser.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }
        Pageable pageable = PageRequest.of(page, size);
        return postRepository.findLikedPostsByUserId(doroUser.userId(), pageable)
                .map(p -> PostSummaryResponse.from(p, tagService.getPostTagNames(p.getId())));
    }

    @Transactional(readOnly = true)
    public Page<PostSummaryResponse> searchPosts(String query, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        if (query == null || query.trim().isEmpty()) {
            return org.springframework.data.domain.Page.empty(pageable);
        }
        return postRepository.searchPublishedPosts(query.trim(), pageable)
                .map(p -> PostSummaryResponse.from(p, tagService.getPostTagNames(p.getId())));
    }

    @Transactional(readOnly = true)
    public Page<PostSummaryResponse> getFollowingPosts(DoroUser doroUser, int page, int size) {
        if (!doroUser.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }
        Pageable pageable = PageRequest.of(page, size);
        return postRepository.findFollowingPosts(doroUser.userId(), pageable)
                .map(p -> PostSummaryResponse.from(p, tagService.getPostTagNames(p.getId())));
    }

    @Transactional(readOnly = true)
    public List<PostSummaryResponse> getRelatedPosts(String username, String slug, int limit) {
        String cleanUsername = username.startsWith("@") ? username.substring(1) : username;
        BlogUser user = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        Post post = postRepository.findByUserIdAndSlug(user.getId(), slug.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.POST_NOT_FOUND));

        List<String> tags = tagService.getPostTagNames(post.getId())
                .stream().map(String::toLowerCase).toList();

        List<UUID> excludeIds = new ArrayList<>();
        excludeIds.add(post.getId());

        List<Post> related = new ArrayList<>();
        if (!tags.isEmpty()) {
            List<Post> tagPosts = postRepository.findRelatedPostsByTags(post.getId(), tags, PageRequest.of(0, limit));
            for (Post p : tagPosts) {
                if (!excludeIds.contains(p.getId()) && related.size() < limit) {
                    related.add(p);
                    excludeIds.add(p.getId());
                }
            }
        }

        // 1차 폴백: 같은 작가의 다른 최신 글
        if (related.size() < limit) {
            List<Post> authorPosts = postRepository.findOtherPostsByAuthor(user.getId(), excludeIds, PageRequest.of(0, limit - related.size()));
            for (Post p : authorPosts) {
                if (!excludeIds.contains(p.getId()) && related.size() < limit) {
                    related.add(p);
                    excludeIds.add(p.getId());
                }
            }
        }

        // 2차 폴백: 전체 인기 트렌딩 글
        if (related.size() < limit) {
            List<Post> trendingPosts = postRepository.findTrendingPostsExcluding(excludeIds, PageRequest.of(0, limit - related.size()));
            for (Post p : trendingPosts) {
                if (!excludeIds.contains(p.getId()) && related.size() < limit) {
                    related.add(p);
                    excludeIds.add(p.getId());
                }
            }
        }

        return related.stream()
                .map(p -> PostSummaryResponse.from(p, tagService.getPostTagNames(p.getId())))
                .toList();
    }

    private static final java.util.regex.Pattern FIRST_IMAGE_PATTERN =
            java.util.regex.Pattern.compile("!\\[.*?\\]\\((https?://[^\\s)]+|/[^\\s)]+)\\)");

    private String resolveThumbnail(String explicitThumbnailUrl, String content) {
        if (explicitThumbnailUrl != null && !explicitThumbnailUrl.isBlank()) {
            return explicitThumbnailUrl.trim();
        }
        return extractFirstImageUrl(content);
    }

    private String extractFirstImageUrl(String content) {
        if (content == null || content.isBlank()) {
            return null;
        }
        java.util.regex.Matcher matcher = FIRST_IMAGE_PATTERN.matcher(content);
        if (matcher.find()) {
            String url = matcher.group(1).trim();
            log.info("Auto-extracted first markdown image as post thumbnail: {}", url);
            return url;
        }
        return null;
    }
}


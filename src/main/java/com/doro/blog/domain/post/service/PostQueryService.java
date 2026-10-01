package com.doro.blog.domain.post.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.common.util.LikeEscape;
import com.doro.blog.common.util.Handles;
import com.doro.blog.domain.like.repository.PostLikeRepository;
import com.doro.blog.domain.post.dto.PostDtos.*;
import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.tag.service.TagService;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.repository.BlogUserRepository;
import com.hunnit_beasts.doro.sdk.client.DoroGuardClient;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PostQueryService {

    private final PostRepository postRepository;
    private final BlogUserRepository userRepository;
    private final PostLikeRepository likeRepository;
    private final com.doro.blog.domain.user.repository.UserFollowRepository followRepository;
    private final TagService tagService;
    private final DoroGuardClient guardClient;
    private final PostCounterService counterService;
    private final PostSummaryMapper summaryMapper;



    @Transactional(readOnly = true)
    public Page<PostSummaryResponse> getFeed(String sort, List<String> tags, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Post> posts;

        List<String> cleanTags = (tags != null) ? tags.stream()
                .filter(t -> t != null && !t.isBlank())
                .map(t -> t.trim().toLowerCase())
                .distinct()
                .toList() : List.of();

        if (cleanTags.size() == 1) {
            posts = postRepository.findAllByTagName(cleanTags.get(0), pageable);
        } else if (cleanTags.size() > 1) {
            posts = postRepository.findAllByAllTagNames(cleanTags, cleanTags.size(), pageable);
        } else if ("popular".equalsIgnoreCase(sort)) {
            posts = postRepository.findAllByStatusOrderByLikeCountDesc(PostStatus.PUBLISHED, pageable);
        } else {
            posts = postRepository.findAllByStatusOrderByPublishedAtDesc(PostStatus.PUBLISHED, pageable);
        }

        return summaryMapper.toSummaries(posts);
    }

    @Transactional(readOnly = true)
    public Page<PostSummaryResponse> getUserPosts(String username, String query, String tag, int page, int size) {
        String cleanUsername = Handles.stripAt(username);
        BlogUser user = userRepository.findByUsername(cleanUsername.toLowerCase().trim())
                .orElseThrow(() -> new BlogException(ErrorCode.USER_NOT_FOUND));

        Pageable pageable = PageRequest.of(page, size);
        String keyword = (query != null && !query.trim().isEmpty()) ? LikeEscape.escape(query.trim()) : null;
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

        return summaryMapper.toSummaries(posts);
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
        String cleanUsername = Handles.stripAt(username);
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
            counterService.incrementView(post);
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

    @Transactional(readOnly = true)
    public Page<PostSummaryResponse> getMyPosts(DoroUser doroUser, PostStatus status, int page, int size) {
        if (!doroUser.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }
        Pageable pageable = PageRequest.of(page, size);
        Page<Post> posts = (status != null)
                ? postRepository.findAllByUserIdAndStatusOrderByCreatedAtDesc(doroUser.userId(), status, pageable)
                : postRepository.findAllByUserIdOrderByCreatedAtDesc(doroUser.userId(), pageable);

        return summaryMapper.toSummaries(posts);
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

        return summaryMapper.toSummaries(postRepository.findTrendingPosts(since, pageable));
    }

    @Transactional(readOnly = true)
    public Page<PostSummaryResponse> getMyLikedPosts(DoroUser doroUser, int page, int size) {
        if (!doroUser.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }
        Pageable pageable = PageRequest.of(page, size);
        return summaryMapper.toSummaries(postRepository.findLikedPostsByUserId(doroUser.userId(), pageable));
    }

    @Transactional(readOnly = true)
    public Page<PostSummaryResponse> searchPosts(String query, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        if (query == null || query.trim().isEmpty()) {
            return org.springframework.data.domain.Page.empty(pageable);
        }
        return summaryMapper.toSummaries(postRepository.searchPublishedPosts(LikeEscape.escape(query.trim()), pageable));
    }

    @Transactional(readOnly = true)
    public Page<PostSummaryResponse> getFollowingPosts(DoroUser doroUser, int page, int size) {
        if (!doroUser.isAuthenticated()) {
            throw new BlogException(ErrorCode.UNAUTHORIZED);
        }
        Pageable pageable = PageRequest.of(page, size);
        return summaryMapper.toSummaries(postRepository.findFollowingPosts(doroUser.userId(), pageable));
    }

    @Transactional(readOnly = true)
    public List<PostSummaryResponse> getRelatedPosts(String username, String slug, int limit) {
        String cleanUsername = Handles.stripAt(username);
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

        return summaryMapper.toSummaries(related);
    }
}

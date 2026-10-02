package com.doro.blog.domain.post.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.common.util.SlugGenerator;
import com.doro.blog.domain.upload.service.MediaCleanup;
import com.doro.blog.domain.upload.service.MediaReferences;
import com.doro.blog.domain.post.dto.PostDtos.*;
import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.post.entity.PostStatus;
import com.doro.blog.domain.post.repository.PostRepository;
import com.doro.blog.domain.series.entity.Series;
import com.doro.blog.domain.series.repository.SeriesRepository;
import com.doro.blog.domain.tag.service.TagService;
import com.doro.blog.domain.user.entity.BlogUser;
import com.doro.blog.domain.user.service.BlogUserService;
import com.doro.blog.infra.guard.GuardTuples;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PostCommandService {

    private final PostRepository postRepository;
    private final SeriesRepository seriesRepository;
    private final BlogUserService userService;
    private final TagService tagService;
    private final GuardTuples guardTuples;
    private final MediaCleanup mediaCleanup;



    @Transactional
    public PostSummaryResponse createPost(DoroUser doroUser, CreatePostRequest request) {
        BlogUser user = userService.getOrCreateUser(doroUser);

        String slug = SlugGenerator.unique(request.slug(), request.title(), "post",
                candidate -> postRepository.existsByUserIdAndSlug(user.getId(), candidate));

        String summary = PostContent.generateSummary(request.summary(), request.content());

        PostStatus status = request.status() != null ? request.status() : PostStatus.DRAFT;
        if (status == PostStatus.PUBLISHED && (request.content() == null || request.content().isBlank())) {
            throw new BlogException(ErrorCode.INVALID_INPUT, "출간 시 본문 내용은 필수입니다.");
        }

        Series series = null;
        Integer seriesOrder = null;
        if (request.seriesId() != null) {
            series = seriesRepository.findByIdForUpdate(request.seriesId())
                    .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));
            requireSeriesOwner(series, user.getId());
            seriesOrder = postRepository.nextSeriesOrder(series.getId());
            seriesRepository.adjustPostCount(series.getId(), 1);
        }

        String resolvedThumbnail = PostContent.resolveThumbnail(request.thumbnailUrl(), request.content());

        Post post = Post.builder()
                .user(user)
                .series(series)
                .seriesOrder(seriesOrder)
                .title(request.title())
                .slug(slug)
                .summary(summary)
                .content(request.content() != null ? request.content() : "")
                .thumbnailUrl(resolvedThumbnail)
                .status(status)
                .publishedAt(status == PostStatus.PUBLISHED ? Instant.now() : null)
                .build();

        Post saved = postRepository.save(post);

        // 태그 동기화
        tagService.syncPostTags(saved, request.tags());

        // Zanzibar ReBAC 관계 튜플 등록: blog_post:<id>#author@user:<userId>
        guardTuples.write("blog_post", saved.getId().toString(), "author", "user", user.getId().toString());

        List<String> tags = tagService.getPostTagNames(saved.getId());
        return PostSummaryResponse.from(saved, tags);
    }

    @Transactional
    public PostSummaryResponse updatePost(UUID postId, UpdatePostRequest request) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new BlogException(ErrorCode.POST_NOT_FOUND));

        String slug = post.getSlug();
        if (request.slug() != null && !request.slug().isBlank()) {
            String requested = SlugGenerator.sanitize(request.slug());
            if (requested.isEmpty()) {
                throw new BlogException(ErrorCode.INVALID_INPUT, "슬러그에 사용할 수 있는 문자가 없습니다.");
            }
            if (!requested.equals(post.getSlug())
                    && postRepository.existsByUserIdAndSlugAndIdNot(post.getUser().getId(), requested, post.getId())) {
                throw new BlogException(ErrorCode.SLUG_ALREADY_EXISTS);
            }
            slug = requested;
        }

        // 본문과 요약이 모두 생략된 부분 수정이면 기존 요약을 그대로 둔다 (null 은 Post.update 에서 무시됨)
        String summary = (request.summary() == null && request.content() == null)
                ? null
                : PostContent.generateSummary(request.summary(), request.content());

        // 시리즈 변경 처리
        if (request.seriesId() != null && (post.getSeries() == null || !post.getSeries().getId().equals(request.seriesId()))) {
            Series newSeries = seriesRepository.findByIdForUpdate(request.seriesId())
                    .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));
            requireSeriesOwner(newSeries, post.getUser().getId());
            if (post.getSeries() != null) {
                seriesRepository.adjustPostCount(post.getSeries().getId(), -1);
            }
            post.assignSeries(newSeries, postRepository.nextSeriesOrder(newSeries.getId()));
            seriesRepository.adjustPostCount(newSeries.getId(), 1);
        } else if (request.seriesId() == null && post.getSeries() != null) {
            seriesRepository.adjustPostCount(post.getSeries().getId(), -1);
            post.removeSeries();
        }

        if (request.status() == PostStatus.PUBLISHED) {
            String newContent = request.content() != null ? request.content() : post.getContent();
            if (newContent == null || newContent.isBlank()) {
                throw new BlogException(ErrorCode.INVALID_INPUT, "출간 시 본문 내용은 필수입니다.");
            }
        }

        String resolvedThumbnail = PostContent.resolveThumbnail(request.thumbnailUrl(), request.content());
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
            seriesRepository.adjustPostCount(post.getSeries().getId(), -1);
        }

        // 이 글이 쓰던 업로드 파일(본문 이미지, 썸네일). 다른 곳에서 안 쓰면 커밋 후 스토리지에서 지운다
        mediaCleanup.deleteUnreferencedAfterCommit(postId, MediaReferences.keysIn(post.getContent(), post.getThumbnailUrl()));

        // 태그별 글 수에서 이 글을 뺀다 (안 빼면 인기 태그 집계가 삭제된 글만큼 영구히 부풀어 오른다)
        tagService.releasePostTags(postId);

        // Zanzibar ReBAC 관계 튜플 삭제
        guardTuples.deleteAfterCommit("blog_post", postId.toString(), "author", "user", post.getUser().getId().toString());

        postRepository.delete(post);
    }

    /** 다른 사용자의 시리즈에 글을 붙이지 못하게 한다. */
    private void requireSeriesOwner(Series series, UUID authorId) {
        if (!series.getUser().getId().equals(authorId)) {
            throw new BlogException(ErrorCode.ACCESS_DENIED, "본인의 시리즈에만 글을 추가할 수 있습니다.");
        }
    }
}

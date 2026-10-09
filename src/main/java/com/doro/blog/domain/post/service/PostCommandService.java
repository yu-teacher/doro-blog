package com.doro.blog.domain.post.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import com.doro.blog.common.tx.Transactions;
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
import java.util.Objects;
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
    private final Transactions transactions;



    /**
     * 글을 만든다. 작성자 튜플(blog_post:<id>#author@user:<userId>)을 Guard 에 먼저 쓴 뒤(트랜잭션 밖) DB 에 저장한다.
     * Guard 호출을 트랜잭션 안에서 하면 Guard 가 느릴 때 DB 연결을 그만큼 쥐고 있게 된다(GuardTuples 설명 참고).
     * 입력이 잘못된 요청은 Guard 를 부르기 전에 거절한다(검증에 걸릴 요청이 Guard 쓰기·정리를 일으키지 않게).
     */
    public PostSummaryResponse createPost(DoroUser doroUser, CreatePostRequest request) {
        PostStatus status = request.status() != null ? request.status() : PostStatus.DRAFT;
        requirePublishableContent(status, request.content());
        if (request.seriesId() != null) {
            transactions.read(() -> {
                Series series = seriesRepository.findById(request.seriesId())
                        .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));
                requireSeriesOwner(series, doroUser.userId());
                return null;
            });
        }

        UUID postId = UUID.randomUUID();
        return guardTuples.writeThen(
                List.of(GuardTuples.Tuple.of("blog_post", postId.toString(), "author", "user", doroUser.userId().toString())),
                () -> transactions.write(() -> savePost(doroUser, request, postId)));
    }

    private static void requirePublishableContent(PostStatus status, String content) {
        if (status == PostStatus.PUBLISHED && (content == null || content.isBlank())) {
            throw new BlogException(ErrorCode.INVALID_INPUT, "출간 시 본문 내용은 필수입니다.");
        }
    }

    private PostSummaryResponse savePost(DoroUser doroUser, CreatePostRequest request, UUID postId) {
        BlogUser user = userService.getOrCreateUser(doroUser);

        String slug = SlugGenerator.unique(request.slug(), request.title(), "post",
                candidate -> postRepository.existsByUserIdAndSlug(user.getId(), candidate));

        String summary = PostContent.generateSummary(request.summary(), request.content());

        PostStatus status = request.status() != null ? request.status() : PostStatus.DRAFT;
        requirePublishableContent(status, request.content());

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
                .id(postId)
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
        tagService.syncPostTags(saved, request.tags(), false);

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

        boolean wasPublished = post.getStatus() == PostStatus.PUBLISHED;
        PostStatus effectiveStatus = request.status() != null ? request.status() : post.getStatus();
        String effectiveContent = request.content() != null ? request.content() : post.getContent();

        // 요약: 보낸 값이 있으면 그 값을 쓴다. 안 보냈는데 본문을 고쳤다면, 지금 요약이 이전 본문에서 자동으로 만든 것일 때만 새 본문으로 다시 만든다.
        // (작성자가 직접 쓴 요약을 본문 수정이 덮어쓰지 않게 한다. null 은 Post.update 에서 "그대로 둠")
        String summary;
        if (request.summary() != null) {
            summary = PostContent.generateSummary(request.summary(), effectiveContent);
        } else if (request.content() != null && hasGeneratedSummary(post)) {
            summary = PostContent.generateSummary(null, request.content());
        } else {
            summary = null;
        }

        // 시리즈 변경 처리
        if (request.seriesId() != null && (post.getSeries() == null || !post.getSeries().getId().equals(request.seriesId()))) {
            // 옮기는 두 시리즈의 행을 항상 id 순으로 잠근다. 글 두 개를 서로 반대 방향으로 동시에 옮기면 한쪽은 A→B, 다른 쪽은 B→A 순으로
            // 잠가 서로를 기다리다 교착이 나기 때문이다(태그 갱신을 id 순으로 하는 것과 같은 이유).
            UUID oldSeriesId = post.getSeries() != null ? post.getSeries().getId() : null;
            Series newSeries = null;
            List<UUID> lockOrder = java.util.stream.Stream.of(oldSeriesId, request.seriesId())
                    .filter(Objects::nonNull).distinct().sorted().toList();
            for (UUID id : lockOrder) {
                Series locked = seriesRepository.findByIdForUpdate(id)
                        .orElseThrow(() -> new BlogException(ErrorCode.SERIES_NOT_FOUND));
                if (id.equals(request.seriesId())) {
                    newSeries = locked;
                }
            }
            requireSeriesOwner(newSeries, post.getUser().getId());
            if (post.getSeries() != null) {
                seriesRepository.adjustPostCount(post.getSeries().getId(), -1);
            }
            post.assignSeries(newSeries, postRepository.nextSeriesOrder(newSeries.getId()));
            seriesRepository.adjustPostCount(newSeries.getId(), 1);
        } else if (request.seriesId() == null && Boolean.TRUE.equals(request.removeFromSeries()) && post.getSeries() != null) {
            // seriesId 를 생략한 것만으로는 시리즈에서 빼지 않는다. 빼려면 removeFromSeries 로 분명히 요청한다.
            seriesRepository.adjustPostCount(post.getSeries().getId(), -1);
            post.removeSeries();
        }

        // 출간 상태가 되는 글(이미 출간된 글을 포함)은 본문이 비어 있으면 안 된다
        if (effectiveStatus == PostStatus.PUBLISHED && (effectiveContent == null || effectiveContent.isBlank())) {
            throw new BlogException(ErrorCode.INVALID_INPUT, "출간 시 본문 내용은 필수입니다.");
        }

        // 썸네일: 직접 보낸 값이 있으면 그 값(빈 값이면 본문 첫 이미지). 안 보냈는데 본문을 고쳤다면, 지금 썸네일이 이전 본문에서
        // 자동으로 뽑은 것(또는 없음)일 때만 새 본문에서 다시 뽑는다. 직접 지정한 썸네일은 본문 이미지로 덮어쓰지 않는다.
        boolean thumbnailChanges = false;
        String newThumbnail = null;
        if (request.thumbnailUrl() != null) {
            newThumbnail = PostContent.resolveThumbnail(request.thumbnailUrl(), effectiveContent);
            thumbnailChanges = true;
        } else if (request.content() != null && hasDerivedThumbnail(post)) {
            newThumbnail = PostContent.resolveThumbnail(null, request.content());
            thumbnailChanges = true;
        }
        post.update(request.title(), slug, summary, request.content(), null, request.status());
        if (thumbnailChanges) {
            post.changeThumbnail(newThumbnail);
        }

        // 태그별 글 수는 공개된 글만 센다: 태그를 바꿨든 공개 여부만 바뀌었든 맞춘다
        if (request.tags() != null) {
            tagService.syncPostTags(post, request.tags(), wasPublished);
        } else {
            tagService.adjustForStatusChange(post, wasPublished);
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
        tagService.releasePostTags(postId, post.getStatus() == PostStatus.PUBLISHED);

        // Zanzibar ReBAC 관계 튜플 삭제
        guardTuples.deleteAfterCommit("blog_post", postId.toString(), "author", "user", post.getUser().getId().toString());

        postRepository.delete(post);
    }

    /** 지금 요약이 이 글의 본문에서 자동으로 만든 것인가(= 작성자가 직접 쓴 요약이 아닌가). */
    private static boolean hasGeneratedSummary(Post post) {
        return Objects.equals(post.getSummary(), PostContent.generateSummary(null, post.getContent()));
    }

    /** 지금 썸네일이 없거나, 이 글의 본문 첫 이미지에서 자동으로 뽑은 것인가(= 작성자가 직접 지정한 썸네일이 아닌가). */
    private static boolean hasDerivedThumbnail(Post post) {
        return post.getThumbnailUrl() == null
                || Objects.equals(post.getThumbnailUrl(), PostContent.resolveThumbnail(null, post.getContent()));
    }

    /** 다른 사용자의 시리즈에 글을 붙이지 못하게 한다. */
    private void requireSeriesOwner(Series series, UUID authorId) {
        if (!series.getUser().getId().equals(authorId)) {
            throw new BlogException(ErrorCode.ACCESS_DENIED, "본인의 시리즈에만 글을 추가할 수 있습니다.");
        }
    }
}

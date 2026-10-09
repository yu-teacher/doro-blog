package com.doro.blog.domain.post.entity;

import com.doro.blog.domain.series.entity.Series;
import com.doro.blog.domain.user.entity.BlogUser;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

// 카운터 컬럼은 PostCounterService 의 원자적 UPDATE 로만 바꾼다. 다른 필드 수정이 오래된 카운터 값을 덮어쓰지 않도록
// 변경된 컬럼만 UPDATE 한다.
@DynamicUpdate
@Entity
@Table(name = "posts", uniqueConstraints = {
        @UniqueConstraint(name = "uk_posts_user_slug", columnNames = {"user_id", "slug"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Post implements Persistable<UUID> {

    /**
     * 앱이 만든 UUID 를 그대로 쓴다. 글·댓글·시리즈를 DB 트랜잭션 밖에서 Guard 에 먼저 쓰려면 저장하기 전에 ID 가 있어야 한다
     * (GuardTuples.writeThen). 저장된 행을 새 행으로 구분하는 일은 Persistable.isNew 가 맡는다.
     */
    @Id
    @Builder.Default
    private UUID id = UUID.randomUUID();

    /** 아직 저장하지 않은 새 객체인가. 직접 ID 를 정하는 엔티티는 이 표시가 없으면 Spring Data 가 save 를 merge(불필요한 SELECT)로 처리한다. */
    @Transient
    @Builder.Default
    private boolean newEntity = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private BlogUser user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "series_id")
    private Series series;

    @Column(name = "series_order")
    private Integer seriesOrder;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, length = 255)
    private String slug;

    @Column(length = 500)
    private String summary;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "thumbnail_url", length = 500)
    private String thumbnailUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private PostStatus status = PostStatus.DRAFT;

    @Column(name = "view_count", nullable = false)
    @Builder.Default
    private long viewCount = 0;

    @Column(name = "like_count", nullable = false)
    @Builder.Default
    private int likeCount = 0;

    @Column(name = "comment_count", nullable = false)
    @Builder.Default
    private int commentCount = 0;

    @Column(name = "published_at")
    private Instant publishedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void update(String title, String slug, String summary, String content, String thumbnailUrl, PostStatus status) {
        if (title != null && !title.isBlank()) this.title = title;
        if (slug != null && !slug.isBlank()) this.slug = slug.toLowerCase().trim();
        if (summary != null) this.summary = summary;
        if (content != null) this.content = content;
        if (thumbnailUrl != null) this.thumbnailUrl = thumbnailUrl;
        if (status != null) {
            if (this.status != PostStatus.PUBLISHED && status == PostStatus.PUBLISHED && this.publishedAt == null) {
                this.publishedAt = Instant.now();
            }
            this.status = status;
        }
    }

    /** 썸네일을 직접 바꾼다. update() 는 null 을 "그대로 둠"으로 보므로, 자동으로 뽑은 썸네일을 비워야 할 때(null)는 이쪽을 쓴다. */
    public void changeThumbnail(String thumbnailUrl) {
        this.thumbnailUrl = thumbnailUrl;
    }

    public void assignSeries(Series series, Integer order) {
        this.series = series;
        this.seriesOrder = order;
    }

    public void removeSeries() {
        this.series = null;
        this.seriesOrder = null;
    }

    public void updateSeriesOrder(Integer order) {
        this.seriesOrder = order;
    }


    @Override
    public boolean isNew() {
        return newEntity;
    }

    @PostPersist
    @PostLoad
    void markNotNew() {
        this.newEntity = false;
    }
}

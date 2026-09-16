package com.doro.blog.domain.post.entity;

import com.doro.blog.domain.series.entity.Series;
import com.doro.blog.domain.user.entity.BlogUser;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "posts", uniqueConstraints = {
        @UniqueConstraint(name = "uk_posts_user_slug", columnNames = {"user_id", "slug"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

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

    public void incrementViewCount() {
        this.viewCount++;
    }

    public void incrementLikeCount() {
        this.likeCount++;
    }

    public void decrementLikeCount() {
        if (this.likeCount > 0) this.likeCount--;
    }

    public void incrementCommentCount() {
        this.commentCount++;
    }

    public void decrementCommentCount() {
        if (this.commentCount > 0) this.commentCount--;
    }
}

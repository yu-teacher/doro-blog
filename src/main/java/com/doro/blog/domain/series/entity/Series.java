package com.doro.blog.domain.series.entity;

import com.doro.blog.domain.user.entity.BlogUser;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.DynamicUpdate;

// 카운터 컬럼은 리포지토리의 원자적 UPDATE 로만 바꾼다. 다른 필드 수정이 오래된 값을 덮어쓰지 않도록 변경된 컬럼만 UPDATE 한다.
@DynamicUpdate
@Entity
@Table(name = "series", uniqueConstraints = {
        @UniqueConstraint(name = "uk_series_user_slug", columnNames = {"user_id", "slug"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Series implements Persistable<UUID> {

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

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 120)
    private String slug;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "thumbnail_url", length = 500)
    private String thumbnailUrl;

    @Column(name = "post_count", nullable = false)
    @Builder.Default
    private int postCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void update(String title, String slug, String description, String thumbnailUrl) {
        if (title != null && !title.isBlank()) this.title = title;
        if (slug != null && !slug.isBlank()) this.slug = slug.toLowerCase().trim();
        if (description != null) this.description = description;
        if (thumbnailUrl != null) this.thumbnailUrl = thumbnailUrl;
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

package com.doro.blog.domain.comment.entity;

import com.doro.blog.domain.post.entity.Post;
import com.doro.blog.domain.user.entity.BlogUser;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "comments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Comment implements Persistable<UUID> {

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
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private BlogUser user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private Comment parent;

    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    @Builder.Default
    private List<Comment> children = new ArrayList<>();

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "is_deleted", nullable = false)
    @Builder.Default
    private boolean isDeleted = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void updateContent(String content) {
        if (this.isDeleted) {
            throw new IllegalStateException("삭제된 댓글은 수정할 수 없습니다.");
        }
        if (content != null && !content.isBlank()) {
            this.content = content;
        }
    }

    public void markDeleted() {
        this.isDeleted = true;
    }

    public boolean isRoot() {
        return this.parent == null;
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

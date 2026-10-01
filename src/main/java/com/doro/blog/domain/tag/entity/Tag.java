package com.doro.blog.domain.tag.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.DynamicUpdate;

// 카운터 컬럼은 리포지토리의 원자적 UPDATE 로만 바꾼다. 다른 필드 수정이 오래된 값을 덮어쓰지 않도록 변경된 컬럼만 UPDATE 한다.
@DynamicUpdate
@Entity
@Table(name = "tags")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Tag {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String name;

    @Column(name = "post_count", nullable = false)
    @Builder.Default
    private int postCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;


}

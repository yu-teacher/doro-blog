package com.doro.blog.domain.series.repository;

import com.doro.blog.domain.series.entity.Series;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SeriesRepository extends JpaRepository<Series, UUID> {
    List<Series> findAllByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<Series> findByUserIdAndSlug(UUID userId, String slug);
    boolean existsByUserIdAndSlug(UUID userId, String slug);

    /** 글 수를 DB 에서 원자적으로 증감한다 (0 아래로는 내려가지 않는다). */
    @Modifying
    @Query("update Series s set s.postCount = case when s.postCount + :delta < 0 then 0 else s.postCount + :delta end where s.id = :id")
    int adjustPostCount(@Param("id") UUID id, @Param("delta") int delta);
}

package com.doro.blog.domain.series.repository;

import com.doro.blog.domain.series.entity.Series;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SeriesRepository extends JpaRepository<Series, UUID> {
    List<Series> findAllByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<Series> findByUserIdAndSlug(UUID userId, String slug);
    boolean existsByUserIdAndSlug(UUID userId, String slug);
}

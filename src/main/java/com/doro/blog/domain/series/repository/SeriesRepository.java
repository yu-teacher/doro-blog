package com.doro.blog.domain.series.repository;

import com.doro.blog.domain.series.entity.Series;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SeriesRepository extends JpaRepository<Series, UUID> {

    boolean existsByThumbnailUrlContaining(String key);

    /**
     * 시리즈 행을 잠그고 읽는다. 회차 번호(max+1)를 계산하기 전에 호출해, 같은 시리즈에 동시에 글이 들어와도
     * 번호가 겹치지 않게 순서대로 처리한다. 잠금은 트랜잭션이 끝날 때 풀린다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Series s where s.id = :id")
    Optional<Series> findByIdForUpdate(@Param("id") UUID id);

    List<Series> findAllByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<Series> findByUserIdAndSlug(UUID userId, String slug);
    boolean existsByUserIdAndSlug(UUID userId, String slug);

    boolean existsByUserIdAndSlugAndIdNot(UUID userId, String slug, UUID id);

    /** 글 수를 DB 에서 원자적으로 증감한다 (0 아래로는 내려가지 않는다). */
    @Modifying
    @Query("update Series s set s.postCount = case when s.postCount + :delta < 0 then 0 else s.postCount + :delta end where s.id = :id")
    int adjustPostCount(@Param("id") UUID id, @Param("delta") int delta);
}

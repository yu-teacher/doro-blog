package com.doro.blog.domain.tag.repository;

import com.doro.blog.domain.tag.entity.Tag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TagRepository extends JpaRepository<Tag, UUID> {
    Optional<Tag> findByName(String name);
    List<Tag> findTop30ByOrderByPostCountDesc();

    /** 글이 있는 태그만, 글 수가 많은 순. (공개된 글만 센 값이다) */
    List<Tag> findTop30ByPostCountGreaterThanOrderByPostCountDesc(int minExclusive);

    /** 글 수를 DB 에서 원자적으로 증감한다 (0 아래로는 내려가지 않는다). */
    @Modifying
    @Query("update Tag t set t.postCount = case when t.postCount + :delta < 0 then 0 else t.postCount + :delta end where t.id = :id")
    int adjustPostCount(@Param("id") UUID id, @Param("delta") int delta);

    /** 같은 새 태그를 동시에 쓰는 요청이 있어도 unique 위반 없이 한 번만 만든다. */
    @Modifying
    @Query(value = "insert into tags (id, name) values (:id, :name) on conflict (name) do nothing", nativeQuery = true)
    int insertIfAbsent(@Param("id") UUID id, @Param("name") String name);
}

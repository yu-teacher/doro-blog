package com.doro.blog.domain.user.repository;

import com.doro.blog.domain.user.entity.BlogUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface BlogUserRepository extends JpaRepository<BlogUser, UUID> {

    boolean existsByProfileImageUrlContaining(String key);
    boolean existsByAboutMarkdownContaining(String key);
    Optional<BlogUser> findByUsername(String username);
    boolean existsByUsername(String username);

    /**
     * 같은 사용자의 첫 요청이 동시에 들어와도, 다른 사용자가 같은 사용자명을 동시에 가져가려 해도 unique 위반으로 실패하지 않도록
     * 충돌하면 아무것도 하지 않는다(반환값 0). 호출하는 쪽이 findById 로 만들어졌는지 확인하고, 사용자명이 충돌했다면 다른 후보로 다시 시도한다.
     * 나머지 컬럼은 DB 기본값을 쓴다.
     */
    @Modifying
    @Query(value = "insert into blog_users (id, username, email, nickname, blog_title) "
            + "values (:id, :username, :email, :nickname, :blogTitle) on conflict do nothing",
            nativeQuery = true)
    int insertIfAbsent(@Param("id") UUID id, @Param("username") String username, @Param("email") String email,
                       @Param("nickname") String nickname, @Param("blogTitle") String blogTitle);

    @Modifying
    @Query("update BlogUser u set u.followerCount = case when u.followerCount + :delta < 0 then 0 else u.followerCount + :delta end where u.id = :id")
    int adjustFollowerCount(@Param("id") UUID id, @Param("delta") int delta);

    @Modifying
    @Query("update BlogUser u set u.followingCount = case when u.followingCount + :delta < 0 then 0 else u.followingCount + :delta end where u.id = :id")
    int adjustFollowingCount(@Param("id") UUID id, @Param("delta") int delta);
}

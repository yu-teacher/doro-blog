package com.doro.blog.domain.user.repository;

import com.doro.blog.domain.user.entity.BlogUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface BlogUserRepository extends JpaRepository<BlogUser, UUID> {
    Optional<BlogUser> findByUsername(String username);
    boolean existsByUsername(String username);
}

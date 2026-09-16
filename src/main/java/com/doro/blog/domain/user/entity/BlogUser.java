package com.doro.blog.domain.user.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "blog_users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class BlogUser {

    @Id
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, length = 100)
    private String email;

    @Column(nullable = false, length = 50)
    private String nickname;

    @Column(length = 255)
    private String bio;

    @Column(name = "profile_image_url", length = 500)
    private String profileImageUrl;

    @Column(name = "blog_title", nullable = false, length = 100)
    @Builder.Default
    private String blogTitle = "My Blog";

    @Column(name = "github_url", length = 255)
    private String githubUrl;

    @Column(name = "twitter_url", length = 255)
    private String twitterUrl;

    @Column(name = "website_url", length = 255)
    private String websiteUrl;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void updateProfile(String nickname, String bio, String profileImageUrl, String blogTitle,
                              String githubUrl, String twitterUrl, String websiteUrl) {
        if (nickname != null && !nickname.isBlank()) this.nickname = nickname;
        if (bio != null) this.bio = bio;
        if (profileImageUrl != null) this.profileImageUrl = profileImageUrl;
        if (blogTitle != null && !blogTitle.isBlank()) this.blogTitle = blogTitle;
        if (githubUrl != null) this.githubUrl = githubUrl;
        if (twitterUrl != null) this.twitterUrl = twitterUrl;
        if (websiteUrl != null) this.websiteUrl = websiteUrl;
    }

    public void updateUsername(String username) {
        if (username != null && !username.isBlank()) {
            this.username = username.toLowerCase().trim();
        }
    }
}

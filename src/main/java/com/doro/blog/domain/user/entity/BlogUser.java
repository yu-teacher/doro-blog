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

    @Column(name = "profile_image_url", columnDefinition = "TEXT")
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

    @Column(name = "public_email", length = 100)
    private String publicEmail;

    @Column(name = "linkedin_url", length = 255)
    private String linkedinUrl;

    @Column(name = "about_markdown", columnDefinition = "TEXT")
    private String aboutMarkdown;

    @Column(name = "follower_count", nullable = false)
    @Builder.Default
    private int followerCount = 0;

    @Column(name = "following_count", nullable = false)
    @Builder.Default
    private int followingCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void updateProfile(String nickname, String bio, String profileImageUrl, String blogTitle,
                              String githubUrl, String twitterUrl, String websiteUrl,
                              String publicEmail, String linkedinUrl, String aboutMarkdown) {
        if (nickname != null && !nickname.isBlank()) this.nickname = nickname;
        if (bio != null) this.bio = bio;
        if (profileImageUrl != null) this.profileImageUrl = profileImageUrl;
        if (blogTitle != null && !blogTitle.isBlank()) this.blogTitle = blogTitle;
        if (githubUrl != null) this.githubUrl = githubUrl;
        if (twitterUrl != null) this.twitterUrl = twitterUrl;
        if (websiteUrl != null) this.websiteUrl = websiteUrl;
        if (publicEmail != null) this.publicEmail = publicEmail;
        if (linkedinUrl != null) this.linkedinUrl = linkedinUrl;
        if (aboutMarkdown != null) this.aboutMarkdown = aboutMarkdown;
    }

    public void incrementFollowerCount() {
        this.followerCount++;
    }

    public void decrementFollowerCount() {
        if (this.followerCount > 0) this.followerCount--;
    }

    public void incrementFollowingCount() {
        this.followingCount++;
    }

    public void decrementFollowingCount() {
        if (this.followingCount > 0) this.followingCount--;
    }

    public void updateUsername(String username) {
        if (username != null && !username.isBlank()) {
            this.username = username.toLowerCase().trim();
        }
    }
}

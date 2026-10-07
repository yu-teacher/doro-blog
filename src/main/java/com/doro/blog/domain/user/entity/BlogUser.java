package com.doro.blog.domain.user.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.DynamicUpdate;

// 카운터 컬럼은 리포지토리의 원자적 UPDATE 로만 바꾼다. 다른 필드 수정이 오래된 값을 덮어쓰지 않도록 변경된 컬럼만 UPDATE 한다.
@DynamicUpdate
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

    /** Doro 계정이 영구 탈퇴해 이 프로필의 개인정보를 익명화한 시각. */
    @Column(name = "deleted_at")
    private Instant deletedAt;

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





    public boolean isDeleted() {
        return deletedAt != null;
    }

    /**
     * Doro 계정 탈퇴에 따라 프로필의 개인정보를 지운다. 글·댓글은 남기되 작성자는 자리표시자로 보이게 된다.
     * 사용자명·이메일은 UNIQUE/NOT NULL 이므로 사용자마다 다른 값을 호출 측이 만들어 넘긴다.
     */
    public void anonymize(String placeholderUsername, String placeholderEmail, String placeholderNickname,
                          String placeholderBlogTitle, Instant now) {
        this.username = placeholderUsername;
        this.email = placeholderEmail;
        this.nickname = placeholderNickname;
        this.blogTitle = placeholderBlogTitle;
        this.bio = null;
        this.profileImageUrl = null;
        this.githubUrl = null;
        this.twitterUrl = null;
        this.websiteUrl = null;
        this.publicEmail = null;
        this.linkedinUrl = null;
        this.aboutMarkdown = null;
        this.followerCount = 0;
        this.followingCount = 0;
        this.deletedAt = now;
    }

    public void updateUsername(String username) {
        if (username != null && !username.isBlank()) {
            this.username = username.toLowerCase().trim();
        }
    }
}
